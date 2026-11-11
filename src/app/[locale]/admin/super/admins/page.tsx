import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr, safeBool } from "@/lib/db-utils";
import { AdminAccountsClient, type AdminRow } from "./AdminAccountsClient";

/** FR-ADM-09: Admin accounts management. */
export default async function AdminAccountsPage() {
  const t = await getTranslations("superAdmin.adminAccounts");
  const adminClient = createAdminClient();

  const { data: rows } = await adminClient
    .from("profiles")
    .select("id, full_name, phone, is_support, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  const admins: AdminRow[] = (rows ?? []).map((r) => ({
    id: safeStr(r.id),
    full_name: r.full_name,
    phone: r.phone,
    is_support: safeBool(r.is_support),
    created_at: safeStr(r.created_at),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <AdminAccountsClient admins={admins} />
    </div>
  );
}
