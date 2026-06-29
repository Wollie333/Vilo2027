"use client";

import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { websiteAssetUrl } from "@/lib/website/assets";

import type { WizardState } from "../wizardState";

export function StepBasics({
  state,
  update,
  onNext,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  onNext: () => void;
}) {
  const t = useTranslations("website");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";
  const logoUrl = websiteAssetUrl(state.logoPath ?? undefined);
  const canNext =
    state.siteName.trim().length > 0 && state.subdomain.length >= 3;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-ink">
          {t("wizardBasicsTitle")}
        </h3>
        <p className="mt-0.5 text-[13px] text-brand-mute">
          {t("wizardBasicsBody")}
        </p>
      </div>

      {/* Logo (prefilled from the business; change later in Brand Studio) */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-card border border-brand-line bg-brand-light">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageOff className="h-5 w-5 text-brand-mute" />
          )}
        </div>
        <p className="text-[12px] text-brand-mute">{t("wizardLogoNote")}</p>
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-brand-ink">
          {t("wizardSiteName")}
        </label>
        <input
          value={state.siteName}
          onChange={(e) => update({ siteName: e.target.value })}
          maxLength={120}
          className="mt-1.5 w-full rounded-[10px] border border-brand-line px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-primary"
          placeholder={t("wizardSiteNamePh")}
        />
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-brand-ink">
          {t("subdomainLabel")}
        </label>
        <div className="mt-1.5 flex max-w-md items-stretch overflow-hidden rounded-[10px] border border-brand-line focus-within:border-brand-primary">
          <input
            value={state.subdomain}
            onChange={(e) =>
              update({
                subdomain: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, ""),
              })
            }
            spellCheck={false}
            autoCapitalize="none"
            className="min-w-0 flex-1 px-3 py-2.5 font-mono text-sm text-brand-ink outline-none"
            placeholder="your-place"
          />
          <span className="flex items-center bg-brand-light px-3 font-mono text-[13px] text-brand-mute">
            .{root}
          </span>
        </div>
        <p className="mt-1.5 text-[11.5px] text-brand-mute">
          {t("subdomainHint")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[13px] font-semibold text-brand-ink">
            {t("wizardContactEmail")}
          </label>
          <input
            type="email"
            value={state.contactEmail}
            onChange={(e) => update({ contactEmail: e.target.value })}
            maxLength={160}
            className="mt-1.5 w-full rounded-[10px] border border-brand-line px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-primary"
            placeholder="hello@example.com"
          />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-brand-ink">
            {t("wizardContactPhone")}
          </label>
          <input
            value={state.contactPhone}
            onChange={(e) => update({ contactPhone: e.target.value })}
            maxLength={40}
            className="mt-1.5 w-full rounded-[10px] border border-brand-line px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-primary"
            placeholder="+27 ..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("wizardNext")}
        </button>
      </div>
    </div>
  );
}
