import { useTranslations } from "next-intl";

export default function AdminPage() {
  const t = useTranslations("nav");
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">{t("admin")}</h1>
      <p className="mt-2 text-muted-foreground">Admin panel — coming in a later module.</p>
    </main>
  );
}
