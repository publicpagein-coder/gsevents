import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/** Super-admin-only route group. Redirects admins to /admin. */
export default async function SuperAdminLayout({ children, params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const t = await getTranslations("superAdmin");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/sign-in`);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: UserRole } | null;

  if (profile?.role !== "super_admin") {
    redirect(`/${locale}/admin`);
  }

  return (
    <div>
      <nav className="mb-6 flex gap-6 border-b pb-3 text-sm">
        <span className="font-semibold">{t("title")}</span>
        <Link
          href={`/${locale}/admin/super/admins`}
          className="text-muted-foreground hover:text-foreground"
        >
          {t("adminAccounts.title")}
        </Link>
        <Link
          href={`/${locale}/admin/super/settings`}
          className="text-muted-foreground hover:text-foreground"
        >
          {t("feeSettings.title")}
        </Link>
      </nav>
      {children}
    </div>
  );
}
