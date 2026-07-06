"use client";

import { Globe, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

// Entry card on the website landing. Links into the full-page setup wizard
// (/dashboard/website/wizard) rather than opening a modal.
export function CreateWebsiteButton({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const t = useTranslations("website");

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Globe className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-brand-ink">
              {t("businessSiteFor", { business: businessName })}
            </h2>
            <p className="text-[13px] text-brand-mute">{t("wizardCardBody")}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/website/wizard?business=${businessId}`}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          <Sparkles className="h-4 w-4" />
          {t("wizardCardCta")}
        </Link>
      </div>
    </div>
  );
}
