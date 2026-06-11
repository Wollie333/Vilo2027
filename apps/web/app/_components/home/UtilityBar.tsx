"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { CurrencySwitcher } from "@/components/currency/CurrencySwitcher";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Link } from "@/i18n/navigation";

// Thin top utility strip for the public/guest chrome. Rendered by SiteHeader, so
// it sits above the main header on every public page. Home of the canonical
// language + currency switchers.
export function UtilityBar() {
  const t = useTranslations("nav");
  return (
    <div className="hidden bg-brand-dark text-brand-accent/80 md:block">
      <div className="mx-auto flex h-9 max-w-7xl items-center gap-6 px-5 text-[12px] lg:px-8">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
          {t("tagline")}
        </span>
        <div className="ml-auto flex items-center gap-4">
          <LanguageSwitcher variant="dark" />
          <span className="h-3.5 w-px bg-white/15" />
          <CurrencySwitcher variant="dark" />
          <span className="h-3.5 w-px bg-white/15" />
          <Link
            href="/booking-management"
            className="inline-flex items-center gap-1 hover:text-white"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {t("listProperty")}
          </Link>
          <a href="#" className="hover:text-white">
            {t("help")}
          </a>
        </div>
      </div>
    </div>
  );
}
