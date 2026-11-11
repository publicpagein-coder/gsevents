import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr } from "@/lib/db-utils";
import { OrganizerQueueClient, type OrganizerRow } from "./OrganizerQueueClient";
import type { Database } from "@/lib/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * FR-ADM-01 / FR-ADM-02: Admin organizer verification queue.
 *
 * Reads pending organizers from the unified profiles table
 * (role=organizer, verification_status=pending).
 * Phone is passed as a plain primitive — never exposed in a public API (BR-06).
 */
export default async function OrganizerQueuePage() {
  const t = await getTranslations("admin.organizerQueue");
  const adminClient = createAdminClient();

  const { data: profileRows } = await adminClient
    .from("profiles")
    .select("id, org_name, org_type, venue_name, social_link, proof_note, phone, created_at")
    .eq("role", "organizer")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  const rows = (profileRows ?? []) as Pick<
    ProfileRow,
    "id" | "org_name" | "org_type" | "venue_name" | "social_link" | "proof_note" | "phone" | "created_at"
  >[];

  const organizers: OrganizerRow[] = rows.map((r) => ({
    user_id: safeStr(r.id),
    org_name: safeStr(r.org_name),
    org_type: safeStr(r.org_type),
    venue_name: r.venue_name,
    social_link: r.social_link,
    proof_note: r.proof_note,
    phone: r.phone,
    created_at: safeStr(r.created_at),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <OrganizerQueueClient organizers={organizers} />
    </div>
  );
}
