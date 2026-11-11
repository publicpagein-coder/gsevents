"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveOrganizerProfile } from "@/app/actions/organizer";

interface ProfileCompleteFormProps {
  /** Pre-filled values when an organizer is editing a rejected profile. */
  defaultValues?: {
    org_name?: string;
    org_type?: string;
    venue_name?: string;
    social_link?: string;
    proof_note?: string;
  };
}

export function ProfileCompleteForm({ defaultValues }: ProfileCompleteFormProps) {
  const t = useTranslations("org.profileComplete");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [orgType, setOrgType] = useState(defaultValues?.org_type ?? "");

  function handleSubmit(formData: FormData) {
    formData.set("org_type", orgType);
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await saveOrganizerProfile(formData);
      if (result.success) {
        router.push("../pending");
        router.refresh();
      } else {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      }
    });
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{tCommon("error")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* org_name */}
          <div className="space-y-1.5">
            <Label htmlFor="org_name">
              {t("orgName")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="org_name"
              name="org_name"
              placeholder={t("orgNamePlaceholder")}
              defaultValue={defaultValues?.org_name}
              required
            />
            {fieldErrors["org_name"]?.map((e) => (
              <p key={e} className="text-xs text-destructive">
                {e}
              </p>
            ))}
          </div>

          {/* org_type */}
          <div className="space-y-1.5">
            <Label htmlFor="org_type">
              {t("orgType")} <span className="text-destructive">*</span>
            </Label>
            <Select value={orgType} onValueChange={setOrgType} required>
              <SelectTrigger id="org_type">
                <SelectValue placeholder={t("orgTypePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="society">{t("orgTypeSociety")}</SelectItem>
                <SelectItem value="club">{t("orgTypeClub")}</SelectItem>
                <SelectItem value="company">{t("orgTypeCompany")}</SelectItem>
                <SelectItem value="other">{t("orgTypeOther")}</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors["org_type"]?.map((e) => (
              <p key={e} className="text-xs text-destructive">
                {e}
              </p>
            ))}
          </div>

          {/* venue_name */}
          <div className="space-y-1.5">
            <Label htmlFor="venue_name">
              {t("venueName")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="venue_name"
              name="venue_name"
              placeholder={t("venueNamePlaceholder")}
              defaultValue={defaultValues?.venue_name}
              required
            />
            {fieldErrors["venue_name"]?.map((e) => (
              <p key={e} className="text-xs text-destructive">
                {e}
              </p>
            ))}
          </div>

          {/* social_link */}
          <div className="space-y-1.5">
            <Label htmlFor="social_link">
              {t("socialLink")}{" "}
              <span className="text-muted-foreground text-xs">({tCommon("optional")})</span>
            </Label>
            <Input
              id="social_link"
              name="social_link"
              type="url"
              placeholder={t("socialLinkPlaceholder")}
              defaultValue={defaultValues?.social_link}
            />
            {fieldErrors["social_link"]?.map((e) => (
              <p key={e} className="text-xs text-destructive">
                {e}
              </p>
            ))}
          </div>

          {/* proof_note */}
          <div className="space-y-1.5">
            <Label htmlFor="proof_note">
              {t("proofNote")}{" "}
              <span className="text-muted-foreground text-xs">({tCommon("optional")})</span>
            </Label>
            <Textarea
              id="proof_note"
              name="proof_note"
              placeholder={t("proofNotePlaceholder")}
              defaultValue={defaultValues?.proof_note}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending || !orgType}>
            {isPending ? tCommon("loading") : t("submitButton")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
