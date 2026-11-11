import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPaiseAsInr } from "@/lib/fees/amounts";
import { safeStr } from "@/lib/db-utils";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type FeeRow = Database["public"]["Tables"]["platform_fees"]["Row"];
type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];

interface Props {
  params: Promise<{ locale: string; feeId: string }>;
}

/** FR-FEE-05: single fee receipt — amount split; GSTIN optional from settings. */
export default async function FeeReceiptPage({ params }: Props) {
  const { locale, feeId } = await params;
  const t = await getTranslations("fees");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, is_support")
    .eq("id", user.id)
    .single();

  const profile = profileData as {
    role: UserRole;
    is_support: boolean;
  } | null;

  const admin = createAdminClient();
  const [{ data: feeData }, { data: settingsData }] = await Promise.all([
    admin
      .from("platform_fees")
      .select(
        "id, user_id, fee_type, amount_paise, base_paise, gst_paise, status, paid_at, created_at, gateway_order_id, gateway_payment_id, event_id, refund_reason",
      )
      .eq("id", feeId)
      .maybeSingle(),
    admin.from("settings").select("gstin").eq("id", 1).maybeSingle(),
  ]);

  const fee = feeData as FeeRow | null;
  if (!fee) notFound();

  const isOwner = fee.user_id === user.id;
  const isAdmin =
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.is_support === true;

  if (!isOwner && !isAdmin) {
    notFound();
  }

  const gstin =
    (settingsData as Pick<SettingsRow, "gstin"> | null)?.gstin ?? null;

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <Button asChild variant="outline" size="sm">
        <Link href={`/${locale}/fees`}>{t("history.backToHistory")}</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("receipt.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row
            label={t("receipt.type")}
            value={
              fee.fee_type === "event_listing"
                ? t("types.event_listing")
                : t("types.sponsor_subscription")
            }
          />
          <Row label={t("receipt.status")} value={fee.status} />
          <Row
            label={t("receipt.amount")}
            value={formatPaiseAsInr(fee.amount_paise)}
          />
          {fee.base_paise != null ? (
            <Row
              label={t("receipt.base")}
              value={formatPaiseAsInr(fee.base_paise)}
            />
          ) : null}
          {fee.gst_paise != null ? (
            <Row
              label={t("receipt.gst")}
              value={formatPaiseAsInr(fee.gst_paise)}
            />
          ) : null}
          {gstin ? <Row label={t("receipt.gstin")} value={gstin} /> : null}
          <Row
            label={t("receipt.created")}
            value={new Date(fee.created_at).toLocaleString(locale)}
          />
          {fee.paid_at ? (
            <Row
              label={t("receipt.paidAt")}
              value={new Date(fee.paid_at).toLocaleString(locale)}
            />
          ) : null}
          {fee.gateway_order_id ? (
            <Row
              label={t("receipt.orderId")}
              value={safeStr(fee.gateway_order_id)}
            />
          ) : null}
          {fee.refund_reason ? (
            <Row label={t("receipt.refundReason")} value={fee.refund_reason} />
          ) : null}
          {!gstin ? (
            <p className="text-xs text-muted-foreground">{t("history.noGstin")}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
