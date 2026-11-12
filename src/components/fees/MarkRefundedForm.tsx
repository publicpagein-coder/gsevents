"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { markFeeRefunded } from "@/app/actions/fees";

interface Props {
  feeId: string;
}

/** FR-ADM-05: support admin marks a fee refunded with a reason. */
export function MarkRefundedForm({ feeId }: Props) {
  const t = useTranslations("fees.refund");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setDone(false);
    formData.set("feeId", feeId);
    startTransition(async () => {
      const result = await markFeeRefunded(formData);
      if (result.success) {
        setDone(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>{tCommon("error")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {done && (
        <Alert>
          <AlertDescription>{t("success")}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1">
        <Label htmlFor={`reason-${feeId}`}>{t("reasonLabel")}</Label>
        <Textarea
          id={`reason-${feeId}`}
          name="reason"
          required
          minLength={3}
          maxLength={500}
          placeholder={t("reasonPlaceholder")}
          rows={2}
        />
      </div>
      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        {isPending ? tCommon("loading") : t("submit")}
      </Button>
    </form>
  );
}
