"use client";

import { Globe, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ThemeOption } from "@/lib/site/themes.server";

import { WebsiteWizard } from "../_wizard/WebsiteWizard";

export function CreateWebsiteButton({
  businessId,
  businessName,
  defaultSubdomain,
  logoPath,
  themes,
}: {
  businessId: string;
  businessName: string;
  defaultSubdomain: string;
  logoPath: string | null;
  themes: ThemeOption[];
}) {
  const t = useTranslations("website");
  const [open, setOpen] = useState(false);

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
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          <Sparkles className="h-4 w-4" />
          {t("wizardCardCta")}
        </button>
      </div>

      <WebsiteWizard
        open={open}
        onClose={() => setOpen(false)}
        businessId={businessId}
        defaultName={businessName}
        defaultSubdomain={defaultSubdomain}
        logoPath={logoPath}
        themes={themes}
      />
    </div>
  );
}
