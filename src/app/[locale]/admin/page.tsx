import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("admin");
  const adminClient = createAdminClient();

  const [{ count: pendingOrgs }, { count: pendingEvents }, { count: pendingChanges }] =
    await Promise.all([
      adminClient
        .from("organizer_profiles")
        .select("*", { count: "exact", head: true })
        .eq("verification_status", "pending"),
      adminClient
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_review"),
      adminClient
        .from("event_change_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

  const queues = [
    {
      label: t("queues.organizers"),
      count: pendingOrgs ?? 0,
      href: `/${locale}/admin/organizers`,
    },
    {
      label: t("queues.events"),
      count: pendingEvents ?? 0,
      href: `/${locale}/admin/events`,
    },
    {
      label: t("queues.changes"),
      count: pendingChanges ?? 0,
      href: `/${locale}/admin/changes`,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {queues.map((q) => (
          <Link key={q.href} href={q.href} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{q.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={q.count > 0 ? "destructive" : "secondary"}
                  className="text-lg px-3 py-1"
                >
                  {q.count}
                </Badge>
                <span className="ml-2 text-sm text-muted-foreground">{t("pending")}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
