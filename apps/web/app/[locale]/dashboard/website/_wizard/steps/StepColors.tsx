"use client";

import { Check, Pipette } from "lucide-react";
import { useTranslations } from "next-intl";

import { accentRamp, generatePalettes, isHexColor } from "@/lib/site/palettes";
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

  const pal = theme?.base?.palette;
  const bg = pal?.bg ?? "#ffffff";
  const ink = pal?.ink ?? "#111111";

  // The accent currently in effect (drives the live preview + the theme recolor).
  const liveAccent =
    state.useCustom && isHexColor(state.customAccent)
      ? state.customAccent
      : (palettes[state.paletteIndex]?.accent ?? baseAccent);

  // Five circles per card: two neutrals from the theme (page + ink) plus the
  // accent shown as a light → base → deep trio, so each card reads as a full,
  // distinct colour scheme rather than a single dull swatch.
  const swatches = (accent: string): string[] => {
    const r = accentRamp(accent);
    return [bg, r.light, r.base, r.deep, ink];
  };

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

      <div className="grid gap-5 md:grid-cols-[1fr_minmax(0,320px)]">
        {/* palette cards — each a 5-circle colour scheme */}
        <div className="grid grid-cols-2 gap-2.5">
          {palettes.map((p, i) => {
            const selected = !state.useCustom && state.paletteIndex === i;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => update({ paletteIndex: i, useCustom: false })}
                className={`relative rounded-card border-2 bg-white px-3 py-3 text-left transition ${
                  selected
                    ? "border-brand-primary shadow-sm"
                    : "border-brand-line hover:border-brand-mute"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {swatches(p.accent).map((c, j) => (
                    <span
                      key={j}
                      className="h-6 w-6 rounded-full ring-1 ring-black/5"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <span className="mt-2 block text-[12px] font-semibold text-brand-ink">
                  {t(`wizardPalette_${p.key}`)}
                </span>
                {selected ? (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary text-white">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                ) : null}
              </button>
            );
          })}

          {/* custom accent card */}
          <label
            className={`relative flex cursor-pointer flex-col justify-between rounded-card border-2 bg-white px-3 py-3 transition ${
              state.useCustom
                ? "border-brand-primary shadow-sm"
                : "border-brand-line hover:border-brand-mute"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {swatches(
                isHexColor(state.customAccent)
                  ? state.customAccent
                  : baseAccent,
              ).map((c, j) => (
                <span
                  key={j}
                  className="h-6 w-6 rounded-full ring-1 ring-black/5"
                  style={{ background: c }}
                />
              ))}
            </div>
            <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-brand-ink">
              <Pipette className="h-3.5 w-3.5 text-brand-mute" />
              {t("wizardPalette_custom")}
            </span>
            <input
              type="color"
              value={
                isHexColor(state.customAccent) ? state.customAccent : baseAccent
              }
              onChange={(e) =>
                update({ useCustom: true, customAccent: e.target.value })
              }
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={t("wizardPalette_custom")}
            />
          </label>
        </div>

        {/* live preview — the selected theme, recoloured by the chosen palette */}
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-brand-mute">
            Live preview
          </p>
          {theme ? (
            <div className="overflow-hidden rounded-card border border-brand-line">
              <WizardThemePreview
                base={theme.base}
                slug={theme.slug}
                accent={liveAccent}
                siteName={state.siteName}
                logoUrl={logoUrl}
              />
            </div>
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
