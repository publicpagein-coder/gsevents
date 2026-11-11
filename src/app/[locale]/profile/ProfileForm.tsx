"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile, signOut, signOutAll } from "@/app/actions/auth";
import { saveOrganizerProfile } from "@/app/actions/organizer";

interface City {
  id: number;
  name: string;
}

interface ProfileFormProps {
  /** All values are plain primitives — no objects from the server component. */
  fullName: string | null;
  phone: string;
  cityId: number | null;
  preferredLanguage: "en" | "hi" | "gu";
  role: string;
  cities: City[];
  locale: string;
  orgName: string | null;
  orgType: string | null;
  venueName: string | null;
  socialLink: string | null;
  proofNote: string | null;
  verificationStatus: string | null;
}

const LANGUAGE_OPTIONS: { value: "en" | "hi" | "gu"; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "gu", label: "ગુજરાતી" },
];

/** FR-AUTH-03 / FR-ORG-01 — Unified profile form (client component). */
export function ProfileForm({
  fullName,
  phone,
  cityId,
  preferredLanguage,
  role,
  cities,
  locale,
  orgName,
  orgType,
  venueName,
  socialLink,
  proofNote,
  verificationStatus,
}: ProfileFormProps) {
  const t = useTranslations("profile");
  const tOrg = useTranslations("org.profileComplete");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Personal fields
  const [name, setName] = useState(fullName ?? "");
  const [selectedCityId, setSelectedCityId] = useState<string>(
    cityId ? String(cityId) : "none",
  );
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "hi" | "gu">(
    preferredLanguage,
  );

  // Organizer fields
  const [selectedOrgType, setSelectedOrgType] = useState(orgType ?? "");
  const isOrganizer = role === "organizer";
  const orgLocked = verificationStatus === "approved";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const formEl = e.currentTarget;
    const formData = new FormData();
    if (name.trim()) formData.set("full_name", name.trim());
    formData.set("city_id", selectedCityId === "none" ? "" : selectedCityId);
    formData.set("preferred_language", selectedLanguage);

    const orgForm = isOrganizer && !orgLocked ? new FormData(formEl) : null;
    if (orgForm) orgForm.set("org_type", selectedOrgType);

    startTransition(async () => {
      const personalResult = await updateProfile(formData);
      if (!personalResult.success) {
        setError(personalResult.error);
        return;
      }

      if (orgForm) {
        const orgResult = await saveOrganizerProfile(orgForm);
        if (!orgResult.success) {
          setError(orgResult.error);
          if (orgResult.fieldErrors) setFieldErrors(orgResult.fieldErrors);
          return;
        }
        setSuccess(tOrg("successMessage"));
        router.push(`/${locale}/pending`);
        router.refresh();
        return;
      }

      if (selectedLanguage !== locale) {
        setSuccess(t("languageChanged"));
        setTimeout(() => {
          router.push(`/${selectedLanguage}/profile`);
          router.refresh();
        }, 800);
        return;
      }

      setSuccess(t("saveSuccess"));
      router.refresh();
    });
  }

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      router.push(`/${locale}/auth/sign-in`);
      router.refresh();
    });
  }

  function handleSignOutAll() {
    if (!confirm(t("signOutAllDesc"))) return;
    startTransition(async () => {
      await signOutAll();
      router.push(`/${locale}/auth/sign-in`);
      router.refresh();
    });
  }

  function roleLabel(value: string): string {
    switch (value) {
      case "organizer":
        return t("roleOrganizer");
      case "sponsor":
        return t("roleSponsor");
      case "admin":
        return t("roleAdmin");
      case "super_admin":
        return t("roleSuperAdmin");
      default:
        return t("roleGeneral");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{tCommon("error")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="full_name">{t("fullName")}</Label>
              <Input
                id="full_name"
                name="full_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("fullNamePlaceholder")}
                maxLength={200}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("phone")}</Label>
              <Input value={phone} readOnly disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">{t("phoneReadOnly")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city_id">{t("city")}</Label>
              <Select
                value={selectedCityId}
                onValueChange={setSelectedCityId}
                disabled={isPending}
              >
                <SelectTrigger id="city_id">
                  <SelectValue placeholder={t("cityPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("cityNone")}</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="preferred_language">{t("language")}</Label>
              <Select
                value={selectedLanguage}
                onValueChange={(v) => setSelectedLanguage(v as "en" | "hi" | "gu")}
                disabled={isPending}
              >
                <SelectTrigger id="preferred_language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("role")}</Label>
              <Input
                value={roleLabel(role)}
                readOnly
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">{t("roleReadOnly")}</p>
            </div>

            {isOrganizer && (
              <div className="space-y-5 border-t pt-5">
                <div>
                  <h2 className="text-base font-semibold">{t("organizerSection")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("organizerSectionSubtitle")}
                  </p>
                </div>

                {orgLocked && (
                  <Alert>
                    <AlertDescription>{t("organizerApprovedLocked")}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="org_name">
                    {tOrg("orgName")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="org_name"
                    name="org_name"
                    placeholder={tOrg("orgNamePlaceholder")}
                    defaultValue={orgName ?? ""}
                    required={!orgLocked}
                    disabled={isPending || orgLocked}
                  />
                  {fieldErrors["org_name"]?.map((msg) => (
                    <p key={msg} className="text-xs text-destructive">
                      {msg}
                    </p>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="org_type">
                    {tOrg("orgType")} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedOrgType}
                    onValueChange={setSelectedOrgType}
                    disabled={isPending || orgLocked}
                    required={!orgLocked}
                  >
                    <SelectTrigger id="org_type">
                      <SelectValue placeholder={tOrg("orgTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="society">{tOrg("orgTypeSociety")}</SelectItem>
                      <SelectItem value="club">{tOrg("orgTypeClub")}</SelectItem>
                      <SelectItem value="company">{tOrg("orgTypeCompany")}</SelectItem>
                      <SelectItem value="other">{tOrg("orgTypeOther")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldErrors["org_type"]?.map((msg) => (
                    <p key={msg} className="text-xs text-destructive">
                      {msg}
                    </p>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="venue_name">
                    {tOrg("venueName")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="venue_name"
                    name="venue_name"
                    placeholder={tOrg("venueNamePlaceholder")}
                    defaultValue={venueName ?? ""}
                    required={!orgLocked}
                    disabled={isPending || orgLocked}
                  />
                  {fieldErrors["venue_name"]?.map((msg) => (
                    <p key={msg} className="text-xs text-destructive">
                      {msg}
                    </p>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="social_link">
                    {tOrg("socialLink")}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({tCommon("optional")})
                    </span>
                  </Label>
                  <Input
                    id="social_link"
                    name="social_link"
                    type="url"
                    placeholder={tOrg("socialLinkPlaceholder")}
                    defaultValue={socialLink ?? ""}
                    disabled={isPending || orgLocked}
                  />
                  {fieldErrors["social_link"]?.map((msg) => (
                    <p key={msg} className="text-xs text-destructive">
                      {msg}
                    </p>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="proof_note">
                    {tOrg("proofNote")}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({tCommon("optional")})
                    </span>
                  </Label>
                  <Textarea
                    id="proof_note"
                    name="proof_note"
                    placeholder={tOrg("proofNotePlaceholder")}
                    defaultValue={proofNote ?? ""}
                    rows={3}
                    disabled={isPending || orgLocked}
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || (isOrganizer && !orgLocked && !selectedOrgType)}
            >
              {isPending
                ? tCommon("loading")
                : isOrganizer && !orgLocked
                  ? tOrg("submitButton")
                  : tCommon("save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("signOutSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignOut}
            disabled={isPending}
          >
            {t("signOut")}
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleSignOutAll}
            disabled={isPending}
          >
            {t("signOutAll")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("signOutAllDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
