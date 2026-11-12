import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckoutButton } from "@/components/fees/CheckoutButton";
import {
  formatPaiseAsInr,
  subscriptionFeeAmounts,
  type FeeSettingsAmounts,
} from "@/lib/fees/amounts";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];
type SponsorRow = Database["public"]["Tables"]["sponsor_profiles"]["Row"];

interface Props {
  params: Promise<{ locale: string }>;
}

/** FR-FEE-02: sponsor yearly subscription checkout. */
export default async function SponsorSubscribePage({ params }: Props) {
  const { locale } = await params;
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
  if (profile?.role !== "sponsor") redirect(`/${locale}/`);

  const admin = createAdminClient();

  const [{ data: sponsorData }, { data: settingsData }] = await Promise.all([
    admin
      .from("sponsor_profiles")
      .select("subscription_expires_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("settings")
      .select(
        "listing_fee_paise, subscription_fee_paise, gst_rate_pct, gstin, launch_offer_text",
      )
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const sponsor = sponsorData as Pick<
    SponsorRow,
    "subscription_expires_at"
  > | null;

  if (!sponsor) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>{t("subscription.noProfile")}</AlertTitle>
        </Alert>
      </main>
    );
  }

  const settingsRow = settingsData as Pick<
    SettingsRow,
    | "listing_fee_paise"
    | "subscription_fee_paise"
    | "gst_rate_pct"
    | "gstin"
    | "launch_offer_text"
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
  const amounts = subscriptionFeeAmounts(settings);
  const amountLabel = formatPaiseAsInr(amounts.amount_paise);

  const expiresAt = sponsor.subscription_expires_at;
  const active =
    !!expiresAt && new Date(expiresAt).getTime() > Date.now();

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("subscription.title")}</CardTitle>
          <CardDescription>{t("subscription.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsRow.launch_offer_text ? (
            <Alert>
              <AlertDescription>{settingsRow.launch_offer_text}</AlertDescription>
            </Alert>
          ) : null}

          <div>
            <p className="text-sm text-muted-foreground">{t("amount")}</p>
            <p className="text-2xl font-semibold">{amountLabel}</p>
            <p className="text-xs text-muted-foreground">
              {t("subscription.breakdown", {
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

          {active ? (
            <Alert>
              <AlertTitle>{t("subscription.activeTitle")}</AlertTitle>
              <AlertDescription>
                {t("subscription.activeBody", {
                  expires: new Date(expiresAt!).toLocaleDateString(locale),
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          <CheckoutButton
            feeType="sponsor_subscription"
            amountLabel={amountLabel}
            description={t("subscription.checkoutDescription")}
          />
        </CardContent>
      </Card>
    </main>
  );
}
