"use client";

import { useTranslations } from "next-intl";

import type { ThemeOption } from "@/lib/site/themes.server";

import type { WizardState } from "../wizardState";

// Review step: a summary of everything the wizard will build, then the single
// "Build my site" CTA. Payment/policy counts fill in once the Payments step is
// wired to account data (later phase); skin + pages are live now.
export function StepReview({
  themes,
  state,
  onBuild,
  onBack,
}: {
  themes: ThemeOption[];
  state: WizardState;
  onBuild: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("website");
  const theme = themes.find((x) => x.id === state.themeId) ?? themes[0];
  const included = state.pages.filter((p) => p.include);
  const pageNames = included.map((p) => t(`wizardPage_${p.kind}`)).join(", ");

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-ink">
          {t("wizardReviewTitle")}
        </h3>
        <p className="mt-0.5 text-[13px] text-brand-mute">
          {t("wizardReviewBody")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-brand-line px-4 py-3.5">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-brand-mute">
            {t("wizardReviewSkin")}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-brand-ink">
            {theme?.name ?? "—"}
          </p>
        </div>
        <div className="rounded-card border border-brand-line px-4 py-3.5">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-brand-mute">
            {t("wizardReviewPages")}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-brand-ink">
            {included.length}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-brand-mute">
            {pageNames}
          </p>
        </div>
      </div>

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
          onClick={onBuild}
          className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          {t("wizardBuild")}
        </button>
      </div>
    </div>
  );
}
