"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { safeStr, safeNumNullable } from "@/lib/db-utils";

/** 5 OTP send requests per phone per 10 minutes. FR-AUTH-01, FR-AUTH-05 */
const OTP_REQUEST_MAX = 5;
const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;

/** 5 verification attempts per phone per 10 minutes. FR-AUTH-01, FR-AUTH-05 */
const OTP_VERIFY_MAX = 5;
const OTP_VERIFY_WINDOW_MS = 10 * 60 * 1000;

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format, e.g. +919876543210");

/** Roles selectable at signup — admin/super_admin are never allowed (FR-AUTH-02, FR-AUTH-03). */
const signupRoleSchema = z.enum(["organizer", "sponsor"]);


type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// FR-AUTH-01: Request OTP
// ---------------------------------------------------------------------------

/**
 * Send a phone OTP via Supabase Auth.
 *
 * Rate-limited to 5 requests per phone per 10 minutes.
 *
 * For new users, `role` must be passed here so Supabase can store it in
 * `raw_user_meta_data` at sign-up time. The existing `handle_new_user`
 * DB trigger reads this metadata to create the `profiles` row.
 * The server validates that `role` is only "organizer" or "sponsor"
 * (FR-AUTH-02, FR-AUTH-03).
 */
export async function requestOtp(phone: string, role?: string): Promise<ActionResult> {
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid phone number" };
  }

  // Validate role when provided — admin/super_admin are blocked (FR-AUTH-03).
  if (role !== undefined) {
    const roleParsed = signupRoleSchema.safeParse(role);
    if (!roleParsed.success) {
      return {
        success: false,
        error: "Role must be organizer or sponsor",
      };
    }
  }

  const rl = checkRateLimit(`otp_req:${parsed.data}`, OTP_REQUEST_MAX, OTP_REQUEST_WINDOW_MS);
  if (!rl.allowed) {
    const minutes = Math.ceil((rl.retryAfterMs ?? OTP_REQUEST_WINDOW_MS) / 60_000);
    return {
      success: false,
      error: `Too many OTP requests. Please wait ${minutes} minute(s) and try again.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: parsed.data,
    options: {
      channel: "sms",
      // Role metadata is picked up by the handle_new_user trigger on INSERT
      // into auth.users. Supabase stores it in raw_user_meta_data. For
      // returning users this is a no-op (trigger has a NOT EXISTS guard).
      ...(role ? { data: { role } } : {}),
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// FR-AUTH-01: Verify OTP
// ---------------------------------------------------------------------------

/**
 * Verify a phone OTP token.
 *
 * Role metadata is already embedded in the `signInWithOtp` call (see
 * `requestOtp`). No role parameter is accepted here — the trigger already
 * has the metadata it needs.
 */
export async function verifyOtp(phone: string, token: string): Promise<ActionResult> {
  const parsedPhone = phoneSchema.safeParse(phone);
  if (!parsedPhone.success) {
    return {
      success: false,
      error: parsedPhone.error.errors[0]?.message ?? "Invalid phone number",
    };
  }

  const tokenParsed = z.string().length(6).regex(/^\d{6}$/).safeParse(token.trim());
  if (!tokenParsed.success) {
    return { success: false, error: "OTP must be exactly 6 digits" };
  }

  const rl = checkRateLimit(
    `otp_verify:${parsedPhone.data}`,
    OTP_VERIFY_MAX,
    OTP_VERIFY_WINDOW_MS,
  );
  if (!rl.allowed) {
    const minutes = Math.ceil((rl.retryAfterMs ?? OTP_VERIFY_WINDOW_MS) / 60_000);
    return {
      success: false,
      error: `Too many attempts. Please wait ${minutes} minute(s) and try again.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: parsedPhone.data,
    token: tokenParsed.data,
    type: "sms",
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// FR-AUTH-03: Profile update
// ---------------------------------------------------------------------------

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1).max(200).optional(),
  city_id: z.coerce.number().int().positive().nullable().optional(),
  preferred_language: z.enum(["en", "hi", "gu"]).optional(),
});

/**
 * Update the signed-in user's own profile.
 *
 * Only full_name, city_id, and preferred_language may be changed.
 * role, verification_status, is_support and other protected fields are
 * explicitly rejected here, and are also protected by DB triggers.
 */
export async function updateProfile(
  formData: FormData,
): Promise<ActionResult<{ preferred_language?: "en" | "hi" | "gu" }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // FR-AUTH-03: Reject any attempt to pass protected fields.
  const PROTECTED_FIELDS = ["role", "verification_status", "is_support", "id", "phone"];
  for (const field of PROTECTED_FIELDS) {
    if (formData.has(field)) {
      return { success: false, error: `Field "${field}" cannot be changed` };
    }
  }

  const raw = {
    full_name: formData.get("full_name") ?? undefined,
    city_id: (() => {
      const v = formData.get("city_id");
      if (v === null || v === "" || v === "none") return null;
      return v;
    })(),
    preferred_language: formData.get("preferred_language") ?? undefined,
  };

  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join("; "),
    };
  }

  const { full_name, city_id: parsedCityId, preferred_language } = parsed.data;

  // Build only the fields that were submitted — skip undefined ones so we
  // don't accidentally null-out fields the user didn't intend to change.
  const hasFullName = full_name !== undefined;
  const hasCityId = Object.prototype.hasOwnProperty.call(parsed.data, "city_id");
  const hasLanguage = preferred_language !== undefined;

  if (!hasFullName && !hasCityId && !hasLanguage) {
    return { success: true };
  }

  const resolvedCityId = hasCityId
    ? (() => {
        const n = safeNumNullable(parsedCityId);
        return n && n > 0 ? n : null;
      })()
    : undefined;

  // Use the admin client for the write. @supabase/ssr@0.5.2 + supabase-js@2.119
  // have a type mismatch that makes .update() on the server client resolve to
  // parameter type `never`. The admin client uses the stable createClient from
  // @supabase/supabase-js directly and has correct types. Security is maintained
  // by the explicit .eq("id", user.id) filter and the field whitelist above.
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({
      ...(hasFullName ? { full_name: safeStr(full_name) } : {}),
      ...(hasCityId ? { city_id: resolvedCityId } : {}),
      ...(hasLanguage ? { preferred_language } : {}),
    })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: preferred_language ? { preferred_language } : {},
  };
}

// ---------------------------------------------------------------------------
// FR-AUTH-04: Sign out
// ---------------------------------------------------------------------------

/** Sign out of the current session only. */
export async function signOut(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Sign out of all sessions across all devices. FR-AUTH-04 */
export async function signOutAll(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
