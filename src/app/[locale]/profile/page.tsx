import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { safeStr, safeStrNullable, safeNumNullable } from "@/lib/db-utils";
import { ProfileForm } from "./ProfileForm";
import type { Database } from "@/lib/supabase/types";

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
}

type City = { id: number; name: string; state: string };

/** FR-AUTH-03 / FR-ORG-01 — Unified profile (personal + organizer fields). */
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  const t = await getTranslations("profile");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(
      "full_name, phone, city_id, preferred_language, role, org_name, org_type, venue_name, social_link, proof_note, verification_status",
    )
    .eq("id", user.id)
    .single();

  const { data: citiesData } = await supabase
    .from("cities")
    .select("id, name, state")
    .eq("is_active", true)
    .order("name");

  type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
  const profile = profileRow as ProfileRow | null;
  const cities = (citiesData ?? []) as City[];

  // Pass only plain primitives to the client component (Next.js requirement).
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("subtitle")}</p>
      <ProfileForm
        fullName={safeStrNullable(profile?.full_name)}
        phone={safeStr(profile?.phone)}
        cityId={safeNumNullable(profile?.city_id)}
        preferredLanguage={
          (safeStr(profile?.preferred_language) as "en" | "hi" | "gu") || "en"
        }
        role={safeStr(profile?.role)}
        cities={cities.map((c) => ({ id: c.id, name: `${c.name}, ${c.state}` }))}
        locale={locale}
        orgName={safeStrNullable(profile?.org_name)}
        orgType={safeStrNullable(profile?.org_type)}
        venueName={safeStrNullable(profile?.venue_name)}
        socialLink={safeStrNullable(profile?.social_link)}
        proofNote={safeStrNullable(profile?.proof_note)}
        verificationStatus={safeStrNullable(profile?.verification_status)}
      />
    </div>
  );
}
