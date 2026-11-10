import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function HomePage() {
  const t = useTranslations();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("home.title")}</h1>
      <p className="mt-4 max-w-md text-muted-foreground">{t("home.subtitle")}</p>
      <div className="mt-8">
        <LanguageSwitcher />
      </div>
    </main>
  );
}
