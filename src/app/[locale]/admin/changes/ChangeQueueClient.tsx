"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { approveChangeRequest, rejectChangeRequest } from "@/app/actions/admin";

export interface ChangeRequestRow {
  id: string;
  event_id: string;
  event_title: string;
  proposed_fields: Record<string, unknown>;
  new_authority_letter_path: string | null;
  submitted_at: string;
}

interface Props {
  changeRequests: ChangeRequestRow[];
}

export function ChangeQueueClient({ changeRequests }: Props) {
  const t = useTranslations("admin.changeQueue");
  const tCommon = useTranslations("common");
  const tDialog = useTranslations("admin.rejectDialog");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectTarget, setRejectTarget] = useState<ChangeRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApprove(changeRequestId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("changeRequestId", changeRequestId);
    startTransition(async () => {
      const result = await approveChangeRequest(fd);
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
    fd.set("changeRequestId", rejectTarget.id);
    fd.set("reason", rejectReason);
    startTransition(async () => {
      const result = await rejectChangeRequest(fd);
      if (result.success) {
        setRejectTarget(null);
        setRejectReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (changeRequests.length === 0) {
    return <p className="text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {changeRequests.map((cr) => {
          const changedKeys = Object.keys(cr.proposed_fields);
          return (
            <div key={cr.id} className="rounded-md border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{cr.event_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("submittedAt")}: {new Date(cr.submitted_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" disabled={isPending} onClick={() => handleApprove(cr.id)}>
                    {tCommon("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => {
                      setRejectTarget(cr);
                      setRejectReason("");
                      setError(null);
                    }}
                  >
                    {tCommon("reject")}
                  </Button>
                </div>
              </div>

              {/* Proposed changes summary */}
              {changedKeys.length > 0 && (
                <div className="overflow-x-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Field</TableHead>
                        <TableHead>{t("proposedValue")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {changedKeys.map((key) => (
                        <TableRow key={key}>
                          <TableCell className="font-mono text-xs">{key}</TableCell>
                          <TableCell className="text-sm">
                            {String(cr.proposed_fields[key] ?? "")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {cr.new_authority_letter_path && (
                <p className="text-sm">
                  {t("newLetter")}:{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {cr.new_authority_letter_path}
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDialog("title")}</DialogTitle>
            <DialogDescription>{rejectTarget?.event_title}</DialogDescription>
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
