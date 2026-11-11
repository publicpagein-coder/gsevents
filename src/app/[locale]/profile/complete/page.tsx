import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileCompleteForm } from "./ProfileCompleteForm";
import type { Database } from "@/lib/supabase/types";

type OrgProfileRow = Pick<
  Database["public"]["Tables"]["organizer_profiles"]["Row"],
  "org_name" | "org_type" | "venue_name" | "social_link" | "proof_note" | "verification_status"
>;

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * FR-ORG-01: Profile completion screen.
 *
 * If the organizer already has an approved profile they have no business here.
 * Rejected organizers land here with their existing data pre-filled so they
 * can fix and resubmit (FR-ORG-05).
 */
export default async function ProfileCompletePage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/sign-in`);

  const { data: orgProfileData } = await supabase
    .from("organizer_profiles")
    .select("org_name, org_type, venue_name, social_link, proof_note, verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const orgProfile = orgProfileData as OrgProfileRow | null;

  // Approved organizers should not be here
  if (orgProfile?.verification_status === "approved") {
    redirect(`/${locale}/`);
  }

  // Pending organizers wait on the pending screen
  if (orgProfile?.verification_status === "pending") {
    redirect(`/${locale}/pending`);
  }

  // null (no row) or 'rejected' — show the form
  const defaultValues =
    orgProfile
      ? {
          org_name: orgProfile.org_name,
          org_type: orgProfile.org_type,
          venue_name: orgProfile.venue_name ?? "",
          social_link: orgProfile.social_link ?? "",
          proof_note: orgProfile.proof_note ?? "",
        }
      : undefined;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <ProfileCompleteForm defaultValues={defaultValues} />
    </div>
  );
}
