"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { approveEvent, rejectEvent } from "@/app/actions/admin";

export interface EventRow {
  id: string;
  title: string;
  organizer_name: string;
  city_name: string;
  start_date: string;
  end_date: string;
  paid_at: string | null;
  has_authority_letter: boolean;
}

interface Props {
  events: EventRow[];
}

/** Returns hours elapsed since the given ISO timestamp, or null. */
function hoursElapsed(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
}

export function EventQueueClient({ events }: Props) {
  const t = useTranslations("admin.eventQueue");
  const tCommon = useTranslations("common");
  const tDialog = useTranslations("admin.rejectDialog");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectTarget, setRejectTarget] = useState<EventRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApprove(eventId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("eventId", eventId);
    startTransition(async () => {
      const result = await approveEvent(fd);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRejectConfirm() {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setError(t("rejectReasonRequired"));
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("eventId", rejectTarget.id);
    fd.set("reason", rejectReason);
    startTransition(async () => {
      const result = await rejectEvent(fd);
      if (result.success) {
        setRejectTarget(null);
        setRejectReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("eventName")}</TableHead>
              <TableHead>{t("organizer")}</TableHead>
              <TableHead>{t("city")}</TableHead>
              <TableHead>{t("dates")}</TableHead>
              <TableHead>{t("timeInQueue")}</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev) => {
              const hours = hoursElapsed(ev.paid_at);
              const isOverdue = hours !== null && hours >= 48;
              return (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">{ev.title}</TableCell>
                  <TableCell>{ev.organizer_name}</TableCell>
                  <TableCell>{ev.city_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ev.start_date} – {ev.end_date}
                  </TableCell>
                  <TableCell>
                    {hours !== null ? (
                      <span
                        className={
                          isOverdue ? "font-semibold text-destructive" : "text-muted-foreground"
                        }
                      >
                        {hours}h {isOverdue && `(${t("overdueLabel")})`}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!ev.has_authority_letter && (
                        <Badge variant="warning">{t("noLetter")}</Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="destructive">{t("overdueLabel")}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleApprove(ev.id)}
                      >
                        {tCommon("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => {
                          setRejectTarget(ev);
                          setRejectReason("");
                          setError(null);
                        }}
                      >
                        {tCommon("reject")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDialog("title")}</DialogTitle>
            <DialogDescription>{rejectTarget?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{tDialog("reasonLabel")}</Label>
            <Textarea
              placeholder={tDialog("reasonPlaceholder")}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleRejectConfirm}>
              {tDialog("confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
