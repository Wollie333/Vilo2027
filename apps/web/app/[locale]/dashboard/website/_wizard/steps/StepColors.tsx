"use client";

import { Check, Pipette } from "lucide-react";
import { useTranslations } from "next-intl";

import { generatePalettes, isHexColor } from "@/lib/site/palettes";
import { websiteAssetUrl } from "@/lib/website/assets";
import type { ThemeOption } from "@/lib/site/themes.server";

import { WizardThemePreview } from "../WizardThemePreview";
import { themeBaseAccent, type WizardState } from "../wizardState";

export function StepColors({
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
  const theme = themes.find((x) => x.id === state.themeId) ?? themes[0];
  const baseAccent = themeBaseAccent(themes, state.themeId);
  const palettes = generatePalettes(baseAccent);
  const logoUrl = websiteAssetUrl(state.logoPath ?? undefined);

  // The accent currently in effect (for the big preview).
  const liveAccent =
    state.useCustom && isHexColor(state.customAccent)
      ? state.customAccent
      : (palettes[state.paletteIndex]?.accent ?? baseAccent);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-ink">
          {t("wizardColorsTitle")}
        </h3>
        <p className="mt-0.5 text-[13px] text-brand-mute">
          {t("wizardColorsBody")}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_minmax(0,300px)]">
        {/* palette cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {palettes.map((p, i) => {
            const selected = !state.useCustom && state.paletteIndex === i;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => update({ paletteIndex: i, useCustom: false })}
                className={`relative rounded-card border-2 p-2.5 text-left transition ${
                  selected
                    ? "border-brand-primary"
                    : "border-brand-line hover:border-brand-mute"
                }`}
              >
                <div className="flex gap-1">
                  <span
                    className="h-7 flex-1 rounded"
                    style={{ background: p.accent }}
                  />
                  <span
                    className="h-7 w-3 rounded"
                    style={{
                      background: theme?.base?.palette?.surface ?? "#fff",
                    }}
                  />
                  <span
                    className="h-7 w-3 rounded"
                    style={{ background: theme?.base?.palette?.ink ?? "#111" }}
                  />
                </div>
                <span className="mt-1.5 block text-[12px] font-semibold text-brand-ink">
                  {t(`wizardPalette_${p.key}`)}
                </span>
                {selected ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary text-white">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                ) : null}
              </button>
            );
          })}

          {/* custom */}
          <div
            className={`relative rounded-card border-2 p-2.5 transition ${
              state.useCustom
                ? "border-brand-primary"
                : "border-brand-line hover:border-brand-mute"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Pipette className="h-3.5 w-3.5 text-brand-mute" />
              <input
                type="color"
                value={
                  isHexColor(state.customAccent)
                    ? state.customAccent
                    : baseAccent
                }
                onChange={(e) =>
                  update({ useCustom: true, customAccent: e.target.value })
                }
                className="h-7 w-full cursor-pointer rounded bg-transparent"
                aria-label={t("wizardPalette_custom")}
              />
            </div>
            <span className="mt-1.5 block text-[12px] font-semibold text-brand-ink">
              {t("wizardPalette_custom")}
            </span>
          </div>
        </div>

        {/* live preview */}
        <div className="hidden md:block">
          {theme ? (
            <WizardThemePreview
              base={theme.base}
              slug={theme.slug}
              accent={liveAccent}
              siteName={state.siteName}
              logoUrl={logoUrl}
            />
          ) : null}
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
          onClick={onNext}
          className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          {t("wizardNext")}
        </button>
      </div>
    </div>
  );
}
