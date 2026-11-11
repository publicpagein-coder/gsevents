"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateFeeSettings } from "@/app/actions/super-admin";

interface SettingsValues {
  listing_fee_paise: number;
  subscription_fee_paise: number;
  gst_rate_pct: number;
  gstin: string | null;
  launch_offer_text: string | null;
}

interface Props {
  values: SettingsValues;
}

export function SettingsForm({ values }: Props) {
  const t = useTranslations("superAdmin.feeSettings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateFeeSettings(formData);
      if (result.success) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("note")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{tCommon("error")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {saved && (
            <Alert variant="success">
              <AlertDescription>{t("saveSuccess")}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="listing_fee_paise">{t("listingFee")}</Label>
            <Input
              id="listing_fee_paise"
              name="listing_fee_paise"
              type="number"
              min={0}
              defaultValue={values.listing_fee_paise}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subscription_fee_paise">{t("subscriptionFee")}</Label>
            <Input
              id="subscription_fee_paise"
              name="subscription_fee_paise"
              type="number"
              min={0}
              defaultValue={values.subscription_fee_paise}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gst_rate_pct">{t("gstRate")}</Label>
            <Input
              id="gst_rate_pct"
              name="gst_rate_pct"
              type="number"
              step="0.01"
              min={0}
              max={100}
              defaultValue={values.gst_rate_pct}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gstin">{t("gstin")}</Label>
            <Input
              id="gstin"
              name="gstin"
              placeholder={t("gstinPlaceholder")}
              defaultValue={values.gstin ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="launch_offer_text">{t("launchOffer")}</Label>
            <Textarea
              id="launch_offer_text"
              name="launch_offer_text"
              placeholder={t("launchOfferPlaceholder")}
              defaultValue={values.launch_offer_text ?? ""}
              rows={3}
            />
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? tCommon("loading") : tCommon("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
