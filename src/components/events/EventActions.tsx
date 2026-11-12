"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  cancelEvent,
  deleteDraftEvent,
  getAuthorityLetterSignedUrl,
  resubmitRejectedEvent,
} from "@/app/actions/events";

interface Props {
  locale: string;
  eventId: string;
  status: string;
  hasAuthorityLetter: boolean;
}

export function EventActions({
  locale,
  eventId,
  status,
  hasAuthorityLetter,
}: Props) {
  const t = useTranslations("events.actions");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    const fd = new FormData();
    fd.set("eventId", eventId);
    startTransition(async () => {
      const result = await action(fd);
      if (!result.success) {
        setError(result.error ?? tCommon("error"));
        return;
      }
      router.refresh();
      if (action === deleteDraftEvent) {
        router.push(`/${locale}/organizer/events`);
      }
    });
  }

  function openLetter() {
    setError(null);
    const fd = new FormData();
    fd.set("eventId", eventId);
    startTransition(async () => {
      const result = await getAuthorityLetterSignedUrl(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(status === "draft" || status === "rejected" || status === "published") && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/organizer/events/${eventId}/edit`}>
              {status === "published" ? t("requestChanges") : tCommon("edit")}
            </Link>
          </Button>
        )}

        {status === "draft" && (
          <Button asChild size="sm">
            <Link href={`/${locale}/fees/pay/${eventId}`}>{t("payAndSubmit")}</Link>
          </Button>
        )}

        {status === "rejected" && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => run(resubmitRejectedEvent)}
          >
            {t("resubmit")}
          </Button>
        )}

        {status === "draft" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              if (window.confirm(t("deleteConfirm"))) run(deleteDraftEvent);
            }}
          >
            {tCommon("delete")}
          </Button>
        )}

        {(status === "draft" ||
          status === "pending_review" ||
          status === "published") && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              if (window.confirm(t("cancelConfirm"))) run(cancelEvent);
            }}
          >
            {t("cancelEvent")}
          </Button>
        )}

        {hasAuthorityLetter && (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={openLetter}>
            {t("viewLetter")}
          </Button>
        )}
      </div>
    </div>
  );
}
