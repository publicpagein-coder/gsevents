import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckoutButton } from "@/components/fees/CheckoutButton";
import {
  formatPaiseAsInr,
  listingFeeAmounts,
  type FeeSettingsAmounts,
} from "@/lib/fees/amounts";
import { canPayListingFee } from "@/lib/fees/deadline";
import { safeStr } from "@/lib/db-utils";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];
type FeeRow = Database["public"]["Tables"]["platform_fees"]["Row"];

interface Props {
  params: Promise<{ locale: string; eventId: string }>;
}

/**
 * FR-FEE-01 stub: organizer pays listing fee for a draft event by id.
 * Full FR-EVT draft UI is out of scope; this page is the fee hook.
 */
export default async function PayListingFeePage({ params }: Props) {
  const { locale, eventId } = await params;
  const t = await getTranslations("fees");
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
  const profile = profileData as { role: UserRole } | null;
  if (profile?.role !== "organizer") redirect(`/${locale}/`);

  const admin = createAdminClient();
  const { data: eventData } = await admin
    .from("events")
    .select("id, title, start_date, end_date, status, organizer_id")
    .eq("id", eventId)
    .maybeSingle();

  const event = eventData as Pick<
    EventRow,
    "id" | "title" | "start_date" | "end_date" | "status" | "organizer_id"
  > | null;

  if (!event || event.organizer_id !== user.id) {
    notFound();
  }

  const { data: settingsData } = await admin
    .from("settings")
    .select("listing_fee_paise, subscription_fee_paise, gst_rate_pct, gstin")
    .eq("id", 1)
    .maybeSingle();

  const settingsRow = settingsData as Pick<
    SettingsRow,
    "listing_fee_paise" | "subscription_fee_paise" | "gst_rate_pct" | "gstin"
  > | null;

  if (!settingsRow) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>{t("settingsUnavailable")}</AlertTitle>
        </Alert>
      </main>
    );
  }

  const settings: FeeSettingsAmounts = {
    listing_fee_paise: settingsRow.listing_fee_paise,
    subscription_fee_paise: settingsRow.subscription_fee_paise,
    gst_rate_pct: Number(settingsRow.gst_rate_pct),
  };
  const amounts = listingFeeAmounts(settings);
  const amountLabel = formatPaiseAsInr(amounts.amount_paise);
  const withinDeadline = canPayListingFee(event.start_date);

  const { data: paidFeeData } = await admin
    .from("platform_fees")
    .select("id, status, amount_paise, paid_at")
    .eq("event_id", event.id)
    .eq("fee_type", "event_listing")
    .eq("status", "paid")
    .maybeSingle();

  const paidFee = paidFeeData as Pick<
    FeeRow,
    "id" | "status" | "amount_paise" | "paid_at"
  > | null;

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("listing.title")}</CardTitle>
          <CardDescription>{t("listing.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("listing.event")}</p>
            <p className="font-medium">{safeStr(event.title)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t("listing.startDate")}</p>
              <p>{event.start_date}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("listing.status")}</p>
              <p>{event.status}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("amount")}</p>
            <p className="text-2xl font-semibold">{amountLabel}</p>
            <p className="text-xs text-muted-foreground">
              {t("listing.gstIncluded", {
                base: formatPaiseAsInr(amounts.base_paise),
                gst: formatPaiseAsInr(amounts.gst_paise),
              })}
            </p>
            {settingsRow.gstin ? (
              <p className="text-xs text-muted-foreground">
                {t("gstin", { gstin: settingsRow.gstin })}
              </p>
            ) : null}
          </div>

          {paidFee ? (
            <Alert>
              <AlertTitle>{t("listing.alreadyPaidTitle")}</AlertTitle>
              <AlertDescription>
                {t("listing.alreadyPaidBody", {
                  amount: formatPaiseAsInr(paidFee.amount_paise),
                })}
              </AlertDescription>
            </Alert>
          ) : event.status !== "draft" ? (
            <Alert>
              <AlertTitle>{t("listing.notDraftTitle")}</AlertTitle>
              <AlertDescription>{t("listing.notDraftBody")}</AlertDescription>
            </Alert>
          ) : !withinDeadline ? (
            <Alert variant="destructive">
              <AlertTitle>{t("listing.deadlineTitle")}</AlertTitle>
              <AlertDescription>{t("listing.deadlineBody")}</AlertDescription>
            </Alert>
          ) : (
            <CheckoutButton
              feeType="event_listing"
              eventId={event.id}
              amountLabel={amountLabel}
              description={t("listing.checkoutDescription", {
                title: safeStr(event.title),
              })}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
