import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr } from "@/lib/db-utils";
import { OrganizerQueueClient, type OrganizerRow } from "./OrganizerQueueClient";
import type { Database } from "@/lib/supabase/types";

type OrgRow = Database["public"]["Tables"]["organizer_profiles"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * FR-ADM-01 / FR-ADM-02: Admin organizer verification queue.
 *
 * Phone number is fetched here (admin-only exception to BR-06) and passed as
 * a plain primitive to the client component — never exposed in a public API.
 */
export default async function OrganizerQueuePage() {
  const t = await getTranslations("admin.organizerQueue");
  const adminClient = createAdminClient();

  // Two separate queries — the Relationships array is not populated in the stub
  // types so relational selects don't type-check. Service-role client is used
  // for both (profiles.phone is admin-only per BR-06).
  const { data: orgRows } = await adminClient
    .from("organizer_profiles")
    .select("user_id, org_name, org_type, venue_name, social_link, proof_note, created_at")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  const rows = (orgRows ?? []) as OrgRow[];

  // Fetch phone numbers for each pending organizer
  const userIds = rows.map((r) => safeStr(r.user_id));
  const phoneMap: Record<string, string | null> = {};

  if (userIds.length > 0) {
    const { data: profileRows } = await adminClient
      .from("profiles")
      .select("id, phone")
      .in("id", userIds);

    for (const p of (profileRows ?? []) as Pick<ProfileRow, "id" | "phone">[]) {
      phoneMap[p.id] = p.phone;
    }
  }

  const organizers: OrganizerRow[] = rows.map((r) => ({
    user_id: safeStr(r.user_id),
    org_name: safeStr(r.org_name),
    org_type: safeStr(r.org_type),
    venue_name: r.venue_name,
    social_link: r.social_link,
    proof_note: r.proof_note,
    phone: phoneMap[r.user_id] ?? null,
    created_at: safeStr(r.created_at),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <OrganizerQueueClient organizers={organizers} />
    </div>
  );
}
