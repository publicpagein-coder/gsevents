"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr } from "@/lib/db-utils";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

// FR-ORG-01: organizer_type uses the existing schema enum
const OrgTypeValues = ["society", "club", "company", "other"] as const;

const SaveProfileSchema = z.object({
  org_name: z.string().min(1, "Organization name is required").max(200),
  org_type: z.enum(OrgTypeValues),
  venue_name: z.string().min(1, "Venue name is required").max(200),
  social_link: z
    .string()
    .url("Must be a valid URL")
    .max(500)
    .optional()
    .or(z.literal("")),
  proof_note: z.string().max(1000).optional().or(z.literal("")),
});

export type SaveProfileInput = z.infer<typeof SaveProfileSchema>;

export type SaveProfileResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * FR-ORG-01: Upsert the organizer_profiles row for the signed-in user.
 * Uses the service-role client so the write is not blocked by RLS during
 * initial profile creation (the RLS insert policy requires the row to not
 * exist yet, which is fine, but we use admin client for consistency with
 * all privileged writes in this codebase).
 *
 * verification_status is left at 'pending' — the trigger already sets it
 * and the guard trigger prevents the organizer from changing it.
 */
export async function saveOrganizerProfile(
  formData: FormData,
): Promise<SaveProfileResult> {
  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify the caller is actually an organizer (never trust the client for role)
  const { data: profileData } = await serverClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: UserRole } | null;

  if (profile?.role !== "organizer") {
    return { success: false, error: "Only organizers can complete an organizer profile" };
  }

  const raw = {
    org_name: formData.get("org_name"),
    org_type: formData.get("org_type"),
    venue_name: formData.get("venue_name"),
    social_link: formData.get("social_link"),
    proof_note: formData.get("proof_note"),
  };

  const parsed = SaveProfileSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = issues ?? [];
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const { org_name, org_type, venue_name, social_link, proof_note } = parsed.data;

  const adminClient = createAdminClient();

  // Check whether a row already exists (upsert path for profile edits)
  const { data: existing } = await adminClient
    .from("organizer_profiles")
    .select("user_id, verification_status")
    .eq("user_id", user.id)
    .single();

  // Do not allow editing verification-sensitive fields once approved
  if (existing?.verification_status === "approved") {
    return {
      success: false,
      error:
        "Your profile is already approved. Contact support to request changes.",
    };
  }

  const { error: upsertError } = await adminClient
    .from("organizer_profiles")
    .upsert(
      {
        user_id: user.id,
        org_name,
        org_type,
        venue_name,
        social_link: social_link || null,
        proof_note: proof_note || null,
        // Keep verification_status at 'pending' — always re-set on resubmission
        verification_status: "pending",
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    return { success: false, error: safeStr(upsertError.message) };
  }

  // Audit log
  await adminClient.from("audit_log").insert({
    actor_id: user.id,
    action: existing ? "resubmit_organizer_profile" : "create_organizer_profile",
    entity: "organizer_profiles",
    entity_id: user.id,
  });

  return { success: true };
}
