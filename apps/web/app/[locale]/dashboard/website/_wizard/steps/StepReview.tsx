"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { generatePalettes, isHexColor } from "@/lib/site/palettes";
import type { ThemeOption } from "@/lib/site/themes.server";

import { WizardLivePreview } from "../WizardLivePreview";
import type {
  WizardPaymentMethod,
  WizardPolicy,
  WizardState,
} from "../wizardState";

// Review step: a summary of everything the wizard will build, then the single
// "Build my site" CTA.
export function StepReview({
  themes,
  paymentMethods,
  policies,
  state,
  onBuild,
  onBack,
  embedded = false,
}: {
  themes: ThemeOption[];
  paymentMethods: WizardPaymentMethod[];
  policies: WizardPolicy[];
  state: WizardState;
  onBuild?: () => void;
  onBack?: () => void;
  /** Single-page-scroll shell: hide the title, the internal preview (the shell
   *  frames its own with a device toggle) and the nav (the shell's publish bar
   *  drives the build). Leaves the summary tiles + "what gets built" checklist. */
  embedded?: boolean;
}) {
  const t = useTranslations("website");
  const theme = themes.find((x) => x.id === state.themeId) ?? themes[0];
  // The accent actually in effect (same resolution as the colours step) so the
  // final preview reflects the host's chosen palette.
  const baseAccent = theme?.base?.palette?.accent ?? "#0a7d4b";
  const palettes = generatePalettes(baseAccent);
  const effectiveAccent =
    state.useCustom && isHexColor(state.customAccent)
      ? state.customAccent
      : (palettes[state.paletteIndex]?.accent ?? baseAccent);
  const included = state.pages.filter((p) => p.include);
  const pageNames = included.map((p) => t(`wizardPage_${p.kind}`)).join(", ");
  const paymentsOn = paymentMethods.filter(
    (m) => state.paymentVisibility[m.key],
  ).length;
  const policiesOn = policies.filter(
    (p) => p.configured && state.policyVisibility[p.key],
  ).length;

  return (
    <div className="space-y-5">
      {!embedded ? (
        <div>
          <h3 className="font-display text-lg font-bold text-brand-ink">
            {t("wizardReviewTitle")}
          </h3>
          <p className="mt-0.5 text-[13px] text-brand-mute">
            {t("wizardReviewBody")}
          </p>
        </div>
      ) : null}

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
        <div className="rounded-card border border-brand-line px-4 py-3.5">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-brand-mute">
            {t("wizardReviewPayments")}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-brand-ink">
            {paymentsOn}
          </p>
        </div>
        <div className="rounded-card border border-brand-line px-4 py-3.5">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-brand-mute">
            {t("wizardReviewPolicies")}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-brand-ink">
            {policiesOn}
          </p>
        </div>
      </div>

      {/* What gets built */}
      <div className="rounded-card border border-brand-line bg-brand-light/30 px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          {t("wizardReviewChecklistTitle")}
        </p>
        <ul className="mt-2 space-y-1.5">
          {[
            t("wizardReviewCheck1", { skin: theme?.name ?? "" }),
            t("wizardReviewCheck2"),
            t("wizardReviewCheck3"),
            t("wizardReviewCheck4"),
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-[13px] text-brand-ink"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Final look — the real renderer + skin + chosen accent, so "ready to
          build?" is answered by seeing the actual site. In the single-page shell
          the framed preview (with device toggle) is rendered by the shell. */}
      {!embedded && theme?.slug ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            {t("wizardReviewSkin")} — {theme.name}
          </p>
          <WizardLivePreview
            slug={theme.slug}
            accent={effectiveAccent}
            siteName={state.siteName}
          />
        </div>
      ) : null}

      {!embedded ? (
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
      ) : null}
    </div>
  );
}
