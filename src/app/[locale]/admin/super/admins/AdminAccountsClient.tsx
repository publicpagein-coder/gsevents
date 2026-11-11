"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdmin, removeAdmin, toggleSupportPermission } from "@/app/actions/super-admin";

export interface AdminRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_support: boolean;
  created_at: string;
}

interface Props {
  admins: AdminRow[];
}

export function AdminAccountsClient({ admins }: Props) {
  const t = useTranslations("superAdmin.adminAccounts");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [removeTarget, setRemoveTarget] = useState<AdminRow | null>(null);

  function handleAdd() {
    if (!newPhone.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("phone", newPhone.trim());
    startTransition(async () => {
      const result = await createAdmin(fd);
      if (result.success) {
        setNewPhone("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleToggleSupport(adminId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("adminId", adminId);
    startTransition(async () => {
      const result = await toggleSupportPermission(fd);
      if (!result.success) setError(result.error);
      router.refresh();
    });
  }

  function handleRemoveConfirm() {
    if (!removeTarget) return;
    setError(null);
    const fd = new FormData();
    fd.set("adminId", removeTarget.id);
    startTransition(async () => {
      const result = await removeAdmin(fd);
      if (result.success) {
        setRemoveTarget(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Add new admin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("addAdmin")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="new-admin-phone" className="sr-only">
                {t("addAdminPhone")}
              </Label>
              <Input
                id="new-admin-phone"
                placeholder={t("addAdminPhone")}
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                type="tel"
              />
            </div>
            <Button disabled={isPending || !newPhone.trim()} onClick={handleAdd}>
              {t("addAdmin")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin list */}
      {admins.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("isSupport")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>{admin.full_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{admin.phone ?? "—"}</TableCell>
                  <TableCell>
                    {admin.is_support ? (
                      <Badge variant="success">Yes</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleToggleSupport(admin.id)}
                      >
                        {admin.is_support
                          ? t("toggleSupportRevoke")
                          : t("toggleSupportGrant")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => setRemoveTarget(admin)}
                      >
                        {t("removeAdmin")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Remove confirmation dialog */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeAdmin")}</DialogTitle>
            <DialogDescription>
              {t("removeAdminConfirm")} — {removeTarget?.full_name ?? removeTarget?.phone}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleRemoveConfirm}>
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
