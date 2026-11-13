import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { safeStr } from "@/lib/db-utils";
import { formatRupees } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EventActions } from "@/components/events/EventActions";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type PackageRow = Database["public"]["Tables"]["sponsorship_packages"]["Row"];
type CityRow = Database["public"]["Tables"]["cities"]["Row"];
type EventTypeRow = Database["public"]["Tables"]["event_types"]["Row"];
type ChangeRequestRow = Database["public"]["Tables"]["event_change_requests"]["Row"];

interface Props {
  params: Promise<{ locale: string; eventId: string }>;
}

export default async function OrganizerEventDetailPage({ params }: Props) {
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
      "id, organizer_id, title, description, event_type_id, city_id, venue, season, start_date, end_date, expected_audience, audience_notes, visibility, status, rejection_reason, authority_letter_path",
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
    | "rejection_reason"
    | "authority_letter_path"
  > | null;

  if (!event || event.organizer_id !== user.id) notFound();

  const [{ data: pkgData }, { data: cityData }, { data: typeData }, { data: crData }] =
    await Promise.all([
      supabase
        .from("sponsorship_packages")
        .select("id, name, price_paise, deliverables, slots_total")
        .eq("event_id", event.id)
        .order("created_at", { ascending: true }),
      supabase.from("cities").select("id, name").eq("id", event.city_id).maybeSingle(),
      supabase
        .from("event_types")
        .select("id, name")
        .eq("id", event.event_type_id)
        .maybeSingle(),
      supabase
        .from("event_change_requests")
        .select("id, status, submitted_at, rejection_reason")
        .eq("event_id", event.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);

  const packages = (pkgData ?? []) as Pick<
    PackageRow,
    "id" | "name" | "price_paise" | "deliverables" | "slots_total"
  >[];
  const city = cityData as Pick<CityRow, "id" | "name"> | null;
  const eventType = typeData as Pick<EventTypeRow, "id" | "name"> | null;
  const pendingCr = crData as Pick<
    ChangeRequestRow,
    "id" | "status" | "submitted_at" | "rejection_reason"
  > | null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link
          href={`/${locale}/organizer/events`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {t("backToList")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{safeStr(event.title)}</h1>
          <Badge variant="secondary">{t(`status.${event.status}`)}</Badge>
        </div>
      </div>

      {event.status === "rejected" && event.rejection_reason ? (
        <Alert variant="destructive">
          <AlertTitle>{t("detail.rejectedTitle")}</AlertTitle>
          <AlertDescription>{safeStr(event.rejection_reason)}</AlertDescription>
        </Alert>
      ) : null}

      {pendingCr ? (
        <Alert>
          <AlertTitle>{t("detail.pendingChangeTitle")}</AlertTitle>
          <AlertDescription>
            {t("detail.pendingChangeBody", {
              date: new Date(pendingCr.submitted_at).toLocaleString(),
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <EventActions
        locale={locale}
        eventId={event.id}
        status={event.status}
        hasAuthorityLetter={event.authority_letter_path !== null}
      />

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">{t("detail.summary")}</h2>
        <p>
          <span className="text-muted-foreground">{t("form.city")}: </span>
          {safeStr(city?.name) || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">{t("form.eventType")}: </span>
          {safeStr(eventType?.name) || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">{t("form.venue")}: </span>
          {safeStr(event.venue) || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">{t("form.season")}: </span>
          {safeStr(event.season) || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">{t("form.dates")}: </span>
          {event.start_date} → {event.end_date}
        </p>
        <p>
          <span className="text-muted-foreground">{t("form.visibility")}: </span>
          {t(`visibility.${event.visibility}`)}
        </p>
        <p>
          <span className="text-muted-foreground">{t("form.expectedAudience")}: </span>
          {event.expected_audience ?? "—"}
        </p>
        {event.description ? (
          <p className="whitespace-pre-wrap pt-2">{safeStr(event.description)}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("packages.title")}</h2>
        {packages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("packages.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {packages.map((p) => (
              <li key={p.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{safeStr(p.name)}</p>
                  <p className="text-sm">{formatRupees(p.price_paise)}</p>
                </div>
                {p.deliverables ? (
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {safeStr(p.deliverables)}
                  </p>
                ) : null}
                {p.slots_total ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("packages.slotsCount", { count: p.slots_total })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
