import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr } from "@/lib/db-utils";
import { ChangeQueueClient, type ChangeRequestRow } from "./ChangeQueueClient";
import type { Database } from "@/lib/supabase/types";
import type { Json } from "@/lib/supabase/types";

type CrRow = Database["public"]["Tables"]["event_change_requests"]["Row"];
type EventDbRow = Database["public"]["Tables"]["events"]["Row"];

/** FR-ADM-12: Change-request review queue. */
export default async function ChangeQueuePage() {
  const t = await getTranslations("admin.changeQueue");
  const adminClient = createAdminClient();

  const { data: crRows } = await adminClient
    .from("event_change_requests")
    .select("id, event_id, proposed_fields, new_authority_letter_path, submitted_at")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  const rows = (crRows ?? []) as Pick<
    CrRow,
    "id" | "event_id" | "proposed_fields" | "new_authority_letter_path" | "submitted_at"
  >[];

  // Fetch event titles in a separate query
  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  const titleMap: Record<string, string> = {};

  if (eventIds.length > 0) {
    const { data: evRows } = await adminClient
      .from("events")
      .select("id, title")
      .in("id", eventIds);

    for (const e of (evRows ?? []) as Pick<EventDbRow, "id" | "title">[]) {
      titleMap[e.id] = e.title;
    }
  }

  function toPlainRecord(json: Json): Record<string, unknown> {
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return json as Record<string, unknown>;
    }
    return {};
  }

  const changeRequests: ChangeRequestRow[] = rows.map((r) => ({
    id: safeStr(r.id),
    event_id: safeStr(r.event_id),
    event_title: safeStr(titleMap[r.event_id]) || "—",
    proposed_fields: toPlainRecord(r.proposed_fields),
    new_authority_letter_path: r.new_authority_letter_path,
    submitted_at: safeStr(r.submitted_at),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <ChangeQueueClient changeRequests={changeRequests} />
    </div>
  );
}
