import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr, safeNumNullable } from "@/lib/db-utils";

/**
 * PATCH /api/auth/profile
 *
 * Updates the signed-in user's own profile.
 * Only full_name, city_id, and preferred_language are accepted.
 * FR-AUTH-03: role, verification_status, is_support and all other
 * protected fields are explicitly rejected.
 */

const PROTECTED_FIELDS = [
  "role",
  "verification_status",
  "is_support",
  "id",
  "phone",
  "created_at",
  "updated_at",
];

const patchSchema = z.object({
  full_name: z.string().trim().min(1).max(200).optional(),
  city_id: z.number().int().positive().nullable().optional(),
  preferred_language: z.enum(["en", "hi", "gu"]).optional(),
});

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  // Reject any protected field present in the request body.
  for (const field of PROTECTED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      return NextResponse.json(
        { error: `Field "${field}" cannot be changed` },
        { status: 422 },
      );
    }
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join("; ") },
      { status: 422 },
    );
  }

  const { full_name, city_id: parsedCityId, preferred_language } = parsed.data;

  const hasFullName = full_name !== undefined;
  const hasCityId = Object.prototype.hasOwnProperty.call(parsed.data, "city_id");
  const hasLanguage = preferred_language !== undefined;

  if (!hasFullName && !hasCityId && !hasLanguage) {
    return NextResponse.json({ success: true });
  }

  const resolvedCityId = hasCityId
    ? (() => {
        const n = safeNumNullable(parsedCityId);
        return n && n > 0 ? n : null;
      })()
    : undefined;

  // Use the admin client for the write — see auth.ts comment on ssr/supabase-js type mismatch.
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({
      ...(hasFullName ? { full_name: safeStr(full_name) } : {}),
      ...(hasCityId ? { city_id: resolvedCityId } : {}),
      ...(hasLanguage ? { preferred_language } : {}),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
