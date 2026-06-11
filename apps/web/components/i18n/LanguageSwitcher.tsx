"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Display labels for each locale, shown in the locale's own language.
const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  af: "Afrikaans",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
};

// Compact language picker. Switching navigates to the SAME page in the chosen
// locale (next-intl rewrites the path + persists the NEXT_LOCALE cookie). Under
// localePrefix:"as-needed" the default locale (en) stays on the unprefixed URL.
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <label className={`relative inline-flex items-center ${className ?? ""}`}>
      <span className="sr-only">Language</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => {
            router.replace(pathname, { locale: next });
          });
        }}
        aria-label="Language"
        title="Choose your language"
        className="h-9 cursor-pointer appearance-none rounded-pill border border-brand-line bg-white pl-3 pr-7 text-[12.5px] font-semibold text-brand-ink outline-none transition hover:bg-brand-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l] ?? l}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-brand-mute"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M7 9l5 5 5-5" />
      </svg>
    </label>
  );
}
