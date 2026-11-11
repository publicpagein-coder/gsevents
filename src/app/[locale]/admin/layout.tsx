import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * FR-ADM: Admin route group.
 * Accessible to users with role 'admin' or 'super_admin' only.
 * The middleware handles unauthenticated redirects; this layout
 * double-checks the role server-side for defence in depth.
 */
export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const t = await getTranslations("admin");

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

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    redirect(`/${locale}/`);
  }

  const isSuperAdmin = profile?.role === "super_admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
          <span className="font-semibold">{t("title")}</span>
          <Link
            href={`/${locale}/admin/organizers`}
            className="text-muted-foreground hover:text-foreground"
          >
            {t("queues.organizers")}
          </Link>
          <Link
            href={`/${locale}/admin/events`}
            className="text-muted-foreground hover:text-foreground"
          >
            {t("queues.events")}
          </Link>
          <Link
            href={`/${locale}/admin/changes`}
            className="text-muted-foreground hover:text-foreground"
          >
            {t("queues.changes")}
          </Link>
          {isSuperAdmin && (
            <Link
              href={`/${locale}/admin/super`}
              className="ml-auto font-medium text-primary hover:text-primary/80"
            >
              Super Admin
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
