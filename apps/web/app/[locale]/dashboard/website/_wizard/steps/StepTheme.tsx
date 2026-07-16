"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { websiteAssetUrl } from "@/lib/website/assets";
import type { ThemeOption } from "@/lib/site/themes.server";

import { WizardThemePreview } from "../WizardThemePreview";
import type { WizardState } from "../wizardState";

export function StepTheme({
  themes,
  state,
  update,
  onNext,
  onBack,
}: {
  themes: ThemeOption[];
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("website");
  const logoUrl = websiteAssetUrl(state.logoPath ?? undefined);
  const selectedTheme = themes.find((x) => x.id === state.themeId);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-ink">
          {t("wizardThemeTitle")}
        </h3>
        <p className="mt-0.5 text-[13px] text-brand-mute">
          {t("wizardThemeBody")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {themes.map((theme) => {
          const selected = theme.id === state.themeId;
          const accent = theme.base?.palette?.accent ?? "#0a7d4b";
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => update({ themeId: theme.id })}
              className={`group relative overflow-hidden rounded-card border-2 text-left transition ${
                selected
                  ? "border-brand-primary"
                  : "border-brand-line hover:border-brand-mute"
              }`}
            >
              {theme.previewUrl ? (
                <div className="aspect-[16/10] w-full overflow-hidden bg-brand-light">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={theme.previewUrl}
                    alt={theme.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ) : (
                <WizardThemePreview
                  base={theme.base}
                  slug={theme.slug}
                  accent={accent}
                  siteName={state.siteName}
                  logoUrl={logoUrl}
                  compact
                />
              )}
              <div className="flex items-center justify-between border-t border-brand-line bg-white px-3 py-2">
                <span className="text-[13px] font-semibold text-brand-ink">
                  {theme.name}
                  {theme.isPremium ? (
                    <span className="ml-2 rounded-pill bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-mute">
                      {t("wizardPremium")}
                    </span>
                  ) : null}
                </span>
                {selected ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-white">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Larger preview of the currently-selected theme (updates on selection). */}
      {selectedTheme ? (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-brand-mute">
            Preview — {selectedTheme.name}
          </p>
          <div className="overflow-hidden rounded-card border border-brand-line">
            {selectedTheme.previewUrl ? (
              <div className="aspect-[16/10] w-full overflow-hidden bg-brand-light">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedTheme.previewUrl}
                  alt={selectedTheme.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <WizardThemePreview
                base={selectedTheme.base}
                slug={selectedTheme.slug}
                accent={selectedTheme.base?.palette?.accent ?? "#0a7d4b"}
                siteName={state.siteName}
                logoUrl={logoUrl}
              />
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[10px] border border-brand-line px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light"
        >
          {t("wizardBack")}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!state.themeId}
          className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-50"
        >
          {t("wizardNext")}
        </button>
      </div>
    </div>
  );
}
