import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNum } from "@/lib/db-utils";
import { SettingsForm } from "./SettingsForm";

/** FR-ADM-10: Fee settings management (super admin only). */
export default async function FeeSettingsPage() {
  const t = await getTranslations("superAdmin.feeSettings");
  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("settings")
    .select("listing_fee_paise, subscription_fee_paise, gst_rate_pct, gstin, launch_offer_text")
    .eq("id", 1)
    .single();

  const values = {
    listing_fee_paise: safeNum(data?.listing_fee_paise ?? 10000),
    subscription_fee_paise: safeNum(data?.subscription_fee_paise ?? 50000),
    gst_rate_pct: safeNum(data?.gst_rate_pct ?? 18),
    gstin: data?.gstin ?? null,
    launch_offer_text: data?.launch_offer_text ?? null,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <SettingsForm values={values} />
    </div>
  );
}
