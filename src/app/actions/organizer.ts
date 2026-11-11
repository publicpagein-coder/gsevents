"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr } from "@/lib/db-utils";
import { isOrganizerProfileIncomplete } from "@/lib/organizer-profile";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type VerificationStatus = Database["public"]["Enums"]["verification_status"];

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

export { isOrganizerProfileIncomplete };

/**
 * FR-ORG-01: Save organizer fields onto the signed-in user's profiles row.
 * verification_status is set to 'pending' on create/resubmit; the guard
 * trigger prevents the organizer from changing verification fields themselves.
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
    .select("role, verification_status, org_name, org_type, venue_name")
    .eq("id", user.id)
    .single();

  const profile = profileData as {
    role: UserRole;
    verification_status: VerificationStatus | null;
    org_name: string | null;
    org_type: string | null;
    venue_name: string | null;
  } | null;

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

  // Do not allow editing verification-sensitive fields once approved
  if (profile.verification_status === "approved") {
    return {
      success: false,
      error:
        "Your profile is already approved. Contact support to request changes.",
    };
  }

  const hadOrgFields = !isOrganizerProfileIncomplete({
    org_name: profile.org_name,
    org_type: profile.org_type,
    venue_name: profile.venue_name,
  });

  const adminClient = createAdminClient();

  // Service-role write so verification_status can be set to pending on resubmit
  // (organizer RLS + guard would block self-updating verification fields).
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({
      org_name,
      org_type,
      venue_name,
      social_link: social_link || null,
      proof_note: proof_note || null,
      verification_status: "pending",
      rejection_reason: null,
    })
    .eq("id", user.id);

  if (updateError) {
    return { success: false, error: safeStr(updateError.message) };
  }

  // Audit log
  await adminClient.from("audit_log").insert({
    actor_id: user.id,
    action: hadOrgFields ? "resubmit_organizer_profile" : "create_organizer_profile",
    entity: "profiles",
    entity_id: user.id,
  });

  return { success: true };
}
