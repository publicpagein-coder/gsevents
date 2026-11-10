"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";

/**
 * Language switcher placeholder.
 * Renders simple buttons for each supported locale.
 * Replace with a full dropdown (shadcn Select) in Prompt 1.
 */
export function LanguageSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleLocaleChange(next: Locale) {
    router.replace(pathname, { locale: next });
  }

  return (
    <nav aria-label={t("switchLanguage")} className="flex gap-2">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => handleLocaleChange(l)}
          disabled={l === locale}
          className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-default disabled:opacity-100 enabled:cursor-pointer enabled:text-muted-foreground enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:bg-primary disabled:text-primary-foreground"
        >
          {t(l)}
        </button>
      ))}
    </nav>
  );
}
