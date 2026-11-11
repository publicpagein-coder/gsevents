"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}

const LANGUAGE_OPTIONS: { value: "en" | "hi" | "gu"; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "gu", label: "ગુજરાતી" },
];

const ROLE_LABELS: Record<string, string> = {
  organizer: "Event Organizer",
  sponsor: "Sponsor",
  admin: "Admin",
  super_admin: "Super Admin",
  general: "General",
};

/** FR-AUTH-03 — Profile edit form (client component). */
export function ProfileForm({
  fullName,
  phone,
  cityId,
  preferredLanguage,
  role,
  cities,
  locale,
}: ProfileFormProps) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Controlled fields
  const [name, setName] = useState(fullName ?? "");
  const [selectedCityId, setSelectedCityId] = useState<string>(cityId ? String(cityId) : "none");
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "hi" | "gu">(preferredLanguage);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    if (name.trim()) formData.set("full_name", name.trim());
    formData.set("city_id", selectedCityId === "none" ? "" : selectedCityId);
    formData.set("preferred_language", selectedLanguage);

    startTransition(async () => {
      const result = await updateProfile(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      // If language changed, navigate to the same page under the new locale.
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

  return (
    <div className="space-y-6">
      {/* Profile fields */}
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

            {/* Full name */}
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

            {/* Phone — display only */}
            <div className="space-y-1.5">
              <Label>{t("phone")}</Label>
              <Input value={phone} readOnly disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">{t("phoneReadOnly")}</p>
            </div>

            {/* City */}
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

            {/* Preferred language */}
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

            {/* Role — read-only display */}
            <div className="space-y-1.5">
              <Label>{t("role")}</Label>
              <Input
                value={ROLE_LABELS[role] ?? role}
                readOnly
                disabled
                className="bg-muted capitalize"
              />
              <p className="text-xs text-muted-foreground">{t("roleReadOnly")}</p>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? tCommon("loading") : tCommon("save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sign out section — FR-AUTH-04 */}
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
