import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPaiseAsInr } from "@/lib/fees/amounts";
import type { Database } from "@/lib/supabase/types";

type FeeRow = Database["public"]["Tables"]["platform_fees"]["Row"];
type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];

interface Props {
  params: Promise<{ locale: string }>;
}

/** FR-FEE-05: own fee history with amount receipt (GSTIN optional). */
export default async function FeeHistoryPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("fees");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);

  const admin = createAdminClient();
  const [{ data: feeRows }, { data: settingsData }] = await Promise.all([
    admin
      .from("platform_fees")
      .select(
        "id, fee_type, amount_paise, base_paise, gst_paise, status, paid_at, created_at, event_id, gateway_order_id",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin.from("settings").select("gstin").eq("id", 1).maybeSingle(),
  ]);

  const fees = (feeRows ?? []) as Pick<
    FeeRow,
    | "id"
    | "fee_type"
    | "amount_paise"
    | "base_paise"
    | "gst_paise"
    | "status"
    | "paid_at"
    | "created_at"
    | "event_id"
    | "gateway_order_id"
  >[];

  const gstin =
    (settingsData as Pick<SettingsRow, "gstin"> | null)?.gstin ?? null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("history.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("history.subtitle")}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/`}>{t("history.back")}</Link>
        </Button>
      </div>

      {gstin ? (
        <p className="text-xs text-muted-foreground">{t("gstin", { gstin })}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("history.noGstin")}</p>
      )}

      {fees.length === 0 ? (
        <p className="text-muted-foreground">{t("history.empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("history.type")}</TableHead>
              <TableHead>{t("history.amount")}</TableHead>
              <TableHead>{t("history.status")}</TableHead>
              <TableHead>{t("history.date")}</TableHead>
              <TableHead>{t("history.receipt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.map((fee) => (
              <TableRow key={fee.id}>
                <TableCell>
                  {fee.fee_type === "event_listing"
                    ? t("types.event_listing")
                    : t("types.sponsor_subscription")}
                </TableCell>
                <TableCell>
                  <div>{formatPaiseAsInr(fee.amount_paise)}</div>
                  {fee.base_paise != null && fee.gst_paise != null ? (
                    <div className="text-xs text-muted-foreground">
                      {t("history.split", {
                        base: formatPaiseAsInr(fee.base_paise),
                        gst: formatPaiseAsInr(fee.gst_paise),
                      })}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{fee.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {fee.paid_at
                    ? new Date(fee.paid_at).toLocaleString(locale)
                    : new Date(fee.created_at).toLocaleString(locale)}
                </TableCell>
                <TableCell>
                  <Button asChild variant="link" size="sm" className="px-0">
                    <Link href={`/${locale}/fees/${fee.id}`}>
                      {t("history.viewReceipt")}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
