import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr } from "@/lib/db-utils";
import { EventQueueClient, type EventRow } from "./EventQueueClient";
import type { Database } from "@/lib/supabase/types";

type EventDbRow = Database["public"]["Tables"]["events"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type CityRow = Database["public"]["Tables"]["cities"]["Row"];
type FeeRow = Database["public"]["Tables"]["platform_fees"]["Row"];

/**
 * FR-ADM-01 / FR-ADM-02: Event review queue.
 *
 * Shows pending_review events with time since paid_at (BR-12 48-hour target)
 * and a flag for events without an authority letter (FR-ADM-13).
 */
export default async function EventQueuePage() {
  const t = await getTranslations("admin.eventQueue");
  const adminClient = createAdminClient();

  const { data: eventRows } = await adminClient
    .from("events")
    .select(
      "id, title, organizer_id, city_id, start_date, end_date, authority_letter_path",
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });

  const rows = (eventRows ?? []) as Pick<
    EventDbRow,
    "id" | "title" | "organizer_id" | "city_id" | "start_date" | "end_date" | "authority_letter_path"
  >[];

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <EventQueueClient events={[]} />
      </div>
    );
  }

  // Fetch related data in parallel
  const organizerIds = [...new Set(rows.map((r) => r.organizer_id))];
  const cityIds = [...new Set(rows.map((r) => r.city_id))];
  const eventIds = rows.map((r) => r.id);

  const [{ data: orgRows }, { data: cityRows }, { data: feeRows }] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, org_name")
      .in("id", organizerIds),
    adminClient.from("cities").select("id, name").in("id", cityIds),
    adminClient
      .from("platform_fees")
      .select("event_id, fee_type, status, paid_at")
      .in("event_id", eventIds)
      .eq("fee_type", "event_listing")
      .eq("status", "paid"),
  ]);

  const orgMap: Record<string, string> = {};
  for (const o of (orgRows ?? []) as Pick<ProfileRow, "id" | "org_name">[]) {
    orgMap[o.id] = o.org_name ?? "";
  }

  const cityMap: Record<number, string> = {};
  for (const c of (cityRows ?? []) as Pick<CityRow, "id" | "name">[]) {
    cityMap[c.id] = c.name;
  }

  const feeMap: Record<string, string | null> = {};
  for (const f of (feeRows ?? []) as Pick<FeeRow, "event_id" | "paid_at">[]) {
    if (f.event_id) feeMap[f.event_id] = f.paid_at;
  }

  const events: EventRow[] = rows.map((r) => ({
    id: safeStr(r.id),
    title: safeStr(r.title),
    organizer_name: safeStr(orgMap[r.organizer_id]) || "—",
    city_name: safeStr(cityMap[r.city_id]) || "—",
    start_date: safeStr(r.start_date),
    end_date: safeStr(r.end_date),
    paid_at: feeMap[r.id] ?? null,
    has_authority_letter: r.authority_letter_path !== null,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <EventQueueClient events={events} />
    </div>
  );
}
