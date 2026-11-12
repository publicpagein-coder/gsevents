import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { safeStr } from "@/lib/db-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CityRow = Database["public"]["Tables"]["cities"]["Row"];

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function OrganizerEventsPage({ params }: Props) {
  const { locale } = await params;
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
  const role = (profileData as { role: UserRole } | null)?.role;
  if (role !== "organizer") redirect(`/${locale}/`);

  const { data: eventRows } = await supabase
    .from("events")
    .select("id, title, status, start_date, end_date, city_id, visibility, rejection_reason")
    .eq("organizer_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (eventRows ?? []) as Pick<
    EventRow,
    | "id"
    | "title"
    | "status"
    | "start_date"
    | "end_date"
    | "city_id"
    | "visibility"
    | "rejection_reason"
  >[];

  const cityIds = [...new Set(rows.map((r) => r.city_id))];
  const cityMap: Record<number, string> = {};
  if (cityIds.length > 0) {
    const { data: cities } = await supabase
      .from("cities")
      .select("id, name")
      .in("id", cityIds);
    for (const c of (cities ?? []) as Pick<CityRow, "id" | "name">[]) {
      cityMap[c.id] = c.name;
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("list.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("list.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/organizer/events/new`}>{t("list.create")}</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("list.empty")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((ev) => (
            <li key={ev.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <Link
                  href={`/${locale}/organizer/events/${ev.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {safeStr(ev.title)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {safeStr(cityMap[ev.city_id]) || "—"} · {ev.start_date} → {ev.end_date}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t(`status.${ev.status}`)}</Badge>
                <Badge variant="outline">{t(`visibility.${ev.visibility}`)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
