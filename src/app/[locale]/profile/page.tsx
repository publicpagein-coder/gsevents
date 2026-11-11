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

/** FR-AUTH-03 — View and edit profile (server component). */
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

  // Fetch the profile row for the signed-in user.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, phone, city_id, preferred_language, role")
    .eq("id", user.id)
    .single();

  // Fetch cities list for the city selector.
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
        preferredLanguage={safeStr(profile?.preferred_language) as "en" | "hi" | "gu" || "en"}
        role={safeStr(profile?.role)}
        cities={cities.map((c) => ({ id: c.id, name: `${c.name}, ${c.state}` }))}
        locale={locale}
      />
    </div>
  );
}
