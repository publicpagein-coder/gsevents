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
import { MarkRefundedForm } from "@/components/fees/MarkRefundedForm";
import { formatPaiseAsInr } from "@/lib/fees/amounts";
import { safeStr } from "@/lib/db-utils";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type FeeRow = Database["public"]["Tables"]["platform_fees"]["Row"];

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * FR-ADM-05 / FR-ADM-15 (thin): recent fees for support admins to mark refunds.
 */
export default async function AdminFeesPage({ params }: Props) {
  const { locale } = await params;
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

  const isAdmin =
    profile?.role === "admin" || profile?.role === "super_admin";
  if (!isAdmin) redirect(`/${locale}/`);

  const canRefund = profile?.is_support === true;

  const admin = createAdminClient();
  const { data: feeRows } = await admin
    .from("platform_fees")
    .select(
      "id, user_id, fee_type, amount_paise, status, paid_at, created_at, gateway_order_id, refund_reason",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const fees = (feeRows ?? []) as Pick<
    FeeRow,
    | "id"
    | "user_id"
    | "fee_type"
    | "amount_paise"
    | "status"
    | "paid_at"
    | "created_at"
    | "gateway_order_id"
    | "refund_reason"
  >[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("admin.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.subtitle")}</p>
      </div>

      {!canRefund ? (
        <p className="text-sm text-muted-foreground">{t("admin.supportOnly")}</p>
      ) : null}

      {fees.length === 0 ? (
        <p className="text-muted-foreground">{t("admin.empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("history.type")}</TableHead>
              <TableHead>{t("history.amount")}</TableHead>
              <TableHead>{t("history.status")}</TableHead>
              <TableHead>{t("history.date")}</TableHead>
              <TableHead>{t("admin.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.map((fee) => (
              <TableRow key={fee.id}>
                <TableCell>
                  {fee.fee_type === "event_listing"
                    ? t("types.event_listing")
                    : t("types.sponsor_subscription")}
                  <div className="text-xs text-muted-foreground">
                    {safeStr(fee.gateway_order_id)}
                  </div>
                </TableCell>
                <TableCell>{formatPaiseAsInr(fee.amount_paise)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{fee.status}</Badge>
                  {fee.refund_reason ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {fee.refund_reason}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {fee.paid_at
                    ? new Date(fee.paid_at).toLocaleString(locale)
                    : new Date(fee.created_at).toLocaleString(locale)}
                </TableCell>
                <TableCell>
                  {canRefund && fee.status === "paid" ? (
                    <MarkRefundedForm feeId={fee.id} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
