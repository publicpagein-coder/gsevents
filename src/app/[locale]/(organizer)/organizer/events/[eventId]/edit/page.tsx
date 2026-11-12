import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EventForm, type EventFormMode } from "@/components/events/EventForm";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type PackageRow = Database["public"]["Tables"]["sponsorship_packages"]["Row"];
type CityRow = Database["public"]["Tables"]["cities"]["Row"];
type EventTypeRow = Database["public"]["Tables"]["event_types"]["Row"];

interface Props {
  params: Promise<{ locale: string; eventId: string }>;
}

export default async function EditEventPage({ params }: Props) {
  const { locale, eventId } = await params;
  const t = await getTranslations("events");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profileData as { role: UserRole } | null)?.role !== "organizer") {
    redirect(`/${locale}/`);
  }

  const { data: eventData } = await supabase
    .from("events")
    .select(
      "id, organizer_id, title, description, event_type_id, city_id, venue, season, start_date, end_date, expected_audience, audience_notes, visibility, status, authority_letter_path",
    )
    .eq("id", eventId)
    .maybeSingle();

  const event = eventData as Pick<
    EventRow,
    | "id"
    | "organizer_id"
    | "title"
    | "description"
    | "event_type_id"
    | "city_id"
    | "venue"
    | "season"
    | "start_date"
    | "end_date"
    | "expected_audience"
    | "audience_notes"
    | "visibility"
    | "status"
    | "authority_letter_path"
  > | null;

  if (!event || event.organizer_id !== user.id) notFound();

  let mode: EventFormMode;
  if (event.status === "draft") mode = "edit-draft";
  else if (event.status === "rejected") mode = "edit-rejected";
  else if (event.status === "published") mode = "change-request";
  else {
    redirect(`/${locale}/organizer/events/${event.id}`);
  }

  const [{ data: pkgData }, { data: cityRows }, { data: typeRows }] = await Promise.all([
    supabase
      .from("sponsorship_packages")
      .select("id, name, price_paise, deliverables, slots_total")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true }),
    supabase.from("cities").select("id, name").order("name"),
    supabase.from("event_types").select("id, name").order("name"),
  ]);

  const packages = (pkgData ?? []) as Pick<
    PackageRow,
    "id" | "name" | "price_paise" | "deliverables" | "slots_total"
  >[];

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link
          href={`/${locale}/organizer/events/${event.id}`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {t("backToDetail")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {mode === "change-request" ? t("edit.changeRequestTitle") : t("edit.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "change-request" ? t("edit.changeRequestSubtitle") : t("edit.subtitle")}
        </p>
      </div>

      <EventForm
        mode={mode}
        locale={locale}
        cities={((cityRows ?? []) as Pick<CityRow, "id" | "name">[]).map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        eventTypes={((typeRows ?? []) as Pick<EventTypeRow, "id" | "name">[]).map(
          (et) => ({ id: et.id, name: et.name }),
        )}
        initial={{
          eventId: event.id,
          title: event.title,
          description: event.description ?? "",
          eventTypeId: String(event.event_type_id),
          cityId: String(event.city_id),
          venue: event.venue ?? "",
          season: event.season ?? "",
          startDate: event.start_date,
          endDate: event.end_date,
          expectedAudience:
            event.expected_audience === null ? "" : String(event.expected_audience),
          audienceNotes: event.audience_notes ?? "",
          visibility: event.visibility,
          hasAuthorityLetter: event.authority_letter_path !== null,
          packages:
            packages.length > 0
              ? packages.map((p) => ({
                  key: p.id,
                  id: p.id,
                  name: p.name,
                  priceRupees: String(p.price_paise / 100),
                  deliverables: p.deliverables ?? "",
                  slotsTotal: p.slots_total === null ? "" : String(p.slots_total),
                }))
              : [
                  {
                    key: "pkg-1",
                    name: "",
                    priceRupees: "",
                    deliverables: "",
                    slotsTotal: "",
                  },
                ],
        }}
      />
    </main>
  );
}
