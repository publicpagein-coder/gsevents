"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr, safeNum } from "@/lib/db-utils";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

type ActionResult = { success: true } | { success: false; error: string };

async function requireSuperAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profileData } = await serverClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: UserRole } | null;

  if (profile?.role !== "super_admin") {
    return { ok: false, error: "Forbidden: super_admin role required" };
  }
  return { ok: true, userId: user.id };
}

// ============================================================
// FR-ADM-09: Create a new admin account
// ============================================================

const CreateAdminSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone number is too short")
    .max(15)
    .regex(/^\+?[0-9]+$/, "Phone number must contain only digits and an optional leading +"),
  full_name: z.string().max(200).optional().or(z.literal("")),
});

export async function createAdmin(formData: FormData): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  // FormData.get() returns null when absent; convert to undefined for Zod .optional()
  const parsed = CreateAdminSchema.safeParse({
    phone: formData.get("phone"),
    full_name: formData.get("full_name") ?? undefined,
  });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { phone, full_name } = parsed.data;
  const adminClient = createAdminClient();

  // Check if a profile with this phone already exists
  const { data: existing } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    if (existing.role === "admin" || existing.role === "super_admin") {
      return { success: false, error: "This user is already an admin" };
    }
    // Promote existing user to admin
    const { error } = await adminClient
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", existing.id);

    if (error) return { success: false, error: safeStr(error.message) };

    await adminClient.from("audit_log").insert({
      actor_id: auth.userId,
      action: "create_admin",
      entity: "profiles",
      entity_id: existing.id,
      details: { promoted_from: existing.role },
    });
    return { success: true };
  }

  // No existing account — create one via admin auth API
  // (In production, Supabase admin auth.admin.createUser would be used here.
  // For Stage 1 we create a profile row directly; the user will need to sign
  // in via OTP to activate their account. The phone column is set to allow
  // lookup before first OTP sign-in.)
  const { data: newUser, error: createError } =
    await adminClient.auth.admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: { role: "admin", full_name: full_name ?? "" },
    });

  if (createError || !newUser.user) {
    return { success: false, error: safeStr(createError?.message ?? "Failed to create user") };
  }

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "create_admin",
    entity: "profiles",
    entity_id: newUser.user.id,
    details: { phone },
  });

  return { success: true };
}

// ============================================================
// FR-ADM-09: Remove admin (demote to organizer)
// ============================================================

const AdminIdSchema = z.object({ adminId: z.string().uuid() });

const RemoveAdminSchema = z.object({
  adminId: z.string().uuid(),
  demoteTo: z.enum(["organizer", "sponsor"]).default("organizer"),
});

export async function removeAdmin(formData: FormData): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = RemoveAdminSchema.safeParse({
    adminId: formData.get("adminId"),
    demoteTo: formData.get("demoteTo") ?? "organizer",
  });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { adminId, demoteTo } = parsed.data;

  if (adminId === auth.userId) {
    return { success: false, error: "Cannot demote yourself" };
  }

  const adminClient = createAdminClient();

  const { data: target } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", adminId)
    .single();

  if (target?.role !== "admin") {
    return { success: false, error: "Target user is not an admin" };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ role: demoteTo, is_support: false })
    .eq("id", adminId);

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "remove_admin",
    entity: "profiles",
    entity_id: adminId,
    details: { demoted_to: demoteTo },
  });

  return { success: true };
}

// ============================================================
// FR-ADM-09 / BR-16: Toggle the support permission on an admin
// ============================================================

export async function toggleSupportPermission(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = AdminIdSchema.safeParse({ adminId: formData.get("adminId") });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { adminId } = parsed.data;
  const adminClient = createAdminClient();

  const { data: target } = await adminClient
    .from("profiles")
    .select("role, is_support")
    .eq("id", adminId)
    .single();

  if (target?.role !== "admin") {
    return { success: false, error: "Target user is not an admin" };
  }

  const newValue = !target.is_support;

  const { error } = await adminClient
    .from("profiles")
    .update({ is_support: newValue })
    .eq("id", adminId);

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: newValue ? "grant_support" : "revoke_support",
    entity: "profiles",
    entity_id: adminId,
  });

  return { success: true };
}

// ============================================================
// FR-ADM-10: Update fee settings (singleton settings row)
// ============================================================

const FeeSettingsSchema = z.object({
  listing_fee_paise: z.coerce.number().int().min(0),
  subscription_fee_paise: z.coerce.number().int().min(0),
  gst_rate_pct: z.coerce.number().min(0).max(100),
  gstin: z.string().max(20).optional().or(z.literal("")),
  launch_offer_text: z.string().max(500).optional().or(z.literal("")),
});

export async function updateFeeSettings(formData: FormData): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = FeeSettingsSchema.safeParse({
    listing_fee_paise: formData.get("listing_fee_paise"),
    subscription_fee_paise: formData.get("subscription_fee_paise"),
    gst_rate_pct: formData.get("gst_rate_pct"),
    gstin: formData.get("gstin") ?? undefined,
    launch_offer_text: formData.get("launch_offer_text") ?? undefined,
  });

  if (!parsed.success) {
    return { success: false, error: "Invalid fee settings" };
  }

  const { listing_fee_paise, subscription_fee_paise, gst_rate_pct, gstin, launch_offer_text } =
    parsed.data;

  const adminClient = createAdminClient();

  const { error } = await adminClient.from("settings").upsert(
    {
      id: 1,
      listing_fee_paise: safeNum(listing_fee_paise),
      subscription_fee_paise: safeNum(subscription_fee_paise),
      gst_rate_pct: safeNum(gst_rate_pct),
      gstin: gstin || null,
      launch_offer_text: launch_offer_text || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "update_fee_settings",
    entity: "settings",
    entity_id: "1",
    details: {
      listing_fee_paise,
      subscription_fee_paise,
      gst_rate_pct,
    },
  });

  return { success: true };
}

// Export for test access
export { requireSuperAdmin };
