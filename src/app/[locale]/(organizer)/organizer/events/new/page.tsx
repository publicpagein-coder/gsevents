import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/events/EventForm";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type CityRow = Database["public"]["Tables"]["cities"]["Row"];
type EventTypeRow = Database["public"]["Tables"]["event_types"]["Row"];

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function NewEventPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("events");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, verification_status")
    .eq("id", user.id)
    .single();
  const profile = profileData as {
    role: UserRole;
    verification_status: string | null;
  } | null;
  if (profile?.role !== "organizer") redirect(`/${locale}/`);
  if (profile.verification_status !== "approved") redirect(`/${locale}/pending`);

  const [{ data: cityRows }, { data: typeRows }] = await Promise.all([
    supabase.from("cities").select("id, name").order("name"),
    supabase.from("event_types").select("id, name").order("name"),
  ]);

  const cities = ((cityRows ?? []) as Pick<CityRow, "id" | "name">[]).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const eventTypes = ((typeRows ?? []) as Pick<EventTypeRow, "id" | "name">[]).map(
    (et) => ({ id: et.id, name: et.name }),
  );

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link
          href={`/${locale}/organizer/events`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {t("backToList")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("new.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("new.subtitle")}</p>
      </div>

      <EventForm
        mode="create"
        locale={locale}
        cities={cities}
        eventTypes={eventTypes}
        initial={{
          title: "",
          description: "",
          eventTypeId: eventTypes[0] ? String(eventTypes[0].id) : "",
          cityId: cities[0] ? String(cities[0].id) : "",
          venue: "",
          season: "",
          startDate: "",
          endDate: "",
          expectedAudience: "",
          audienceNotes: "",
          visibility: "public",
          hasAuthorityLetter: false,
          packages: [
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
