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
import { approveOrganizer, rejectOrganizer } from "@/app/actions/admin";

export interface OrganizerRow {
  user_id: string;
  org_name: string;
  org_type: string;
  venue_name: string | null;
  social_link: string | null;
  proof_note: string | null;
  phone: string | null;
  created_at: string;
}

interface Props {
  organizers: OrganizerRow[];
}

export function OrganizerQueueClient({ organizers }: Props) {
  const t = useTranslations("admin.organizerQueue");
  const tCommon = useTranslations("common");
  const tDialog = useTranslations("admin.rejectDialog");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectTarget, setRejectTarget] = useState<OrganizerRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApprove(organizerId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("organizerId", organizerId);
    startTransition(async () => {
      const result = await approveOrganizer(fd);
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
    fd.set("organizerId", rejectTarget.user_id);
    fd.set("reason", rejectReason);
    startTransition(async () => {
      const result = await rejectOrganizer(fd);
      if (result.success) {
        setRejectTarget(null);
        setRejectReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (organizers.length === 0) {
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
              <TableHead>{t("orgName")}</TableHead>
              <TableHead>{t("orgType")}</TableHead>
              <TableHead>{t("venueName")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("proofNote")}</TableHead>
              <TableHead>{t("socialLink")}</TableHead>
              <TableHead>{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizers.map((org) => (
              <TableRow key={org.user_id}>
                <TableCell className="font-medium">{org.org_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{org.org_type}</Badge>
                </TableCell>
                <TableCell>{org.venue_name ?? "—"}</TableCell>
                {/* Phone is an admin-only exception to the privacy rule (BR-06) */}
                <TableCell className="font-mono text-xs">{org.phone ?? "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {org.proof_note ?? "—"}
                </TableCell>
                <TableCell>
                  {org.social_link ? (
                    <a
                      href={org.social_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline text-xs"
                    >
                      {org.social_link}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isPending}
                      onClick={() => handleApprove(org.user_id)}
                    >
                      {tCommon("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => {
                        setRejectTarget(org);
                        setRejectReason("");
                        setError(null);
                      }}
                    >
                      {tCommon("reject")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDialog("title")}</DialogTitle>
            <DialogDescription>{rejectTarget?.org_name}</DialogDescription>
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
