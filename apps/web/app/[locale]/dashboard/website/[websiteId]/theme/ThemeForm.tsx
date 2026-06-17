"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { saveThemeAction } from "@/app/[locale]/dashboard/website/actions";
import {
  SITE_PRESETS,
  SITE_PRESET_KEYS,
  buildSiteVars,
  type SiteFont,
  type SitePresetKey,
  type SiteRadius,
} from "@/lib/site/themes";

const FONTS: SiteFont[] = ["sans", "serif", "elegant"];
const RADII: SiteRadius[] = ["none", "sm", "md", "lg", "xl"];

type ThemeState = {
  preset: SitePresetKey;
  accent: string; // "" = preset accent
  font: SiteFont | ""; // "" = preset font
  radius: SiteRadius | ""; // "" = preset radius
};

export function ThemeForm({
  websiteId,
  initial,
}: {
  websiteId: string;
  initial: { preset: string; accent: string; font: string; radius: string };
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [saving, startSave] = useTransition();

  const [state, setState] = useState<ThemeState>({
    preset: (SITE_PRESET_KEYS.includes(initial.preset as SitePresetKey)
      ? initial.preset
      : "classic") as SitePresetKey,
    accent: initial.accent || "",
    font: (FONTS.includes(initial.font as SiteFont) ? initial.font : "") as
      | SiteFont
      | "",
    radius: (RADII.includes(initial.radius as SiteRadius)
      ? initial.radius
      : "") as SiteRadius | "",
  });

  const vars = useMemo(
    () =>
      buildSiteVars({
        preset: state.preset,
        accent: state.accent || undefined,
        font: state.font || undefined,
        radius: state.radius || undefined,
      }),
    [state],
  );

  function onSave() {
    startSave(async () => {
      const res = await saveThemeAction({ websiteId, ...state });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("themeSaved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Presets */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h3 className="text-sm font-semibold text-brand-ink">
          {t("presetLabel")}
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SITE_PRESET_KEYS.map((key) => {
            const p = SITE_PRESETS[key];
            const active = state.preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setState((s) => ({ ...s, preset: key }))}
                className={`relative rounded-card border p-3 text-left transition ${
                  active
                    ? "border-brand-primary ring-1 ring-brand-primary"
                    : "border-brand-line hover:border-brand-mute"
                }`}
              >
                {active ? (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary text-white">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                ) : null}
                <div
                  className="flex h-10 items-center gap-1.5 rounded-[8px] px-2"
                  style={{ background: p.palette.bg }}
                >
                  <span
                    className="h-5 w-5 rounded-full"
                    style={{ background: p.palette.accent }}
                  />
                  <span
                    className="h-3 w-10 rounded-full"
                    style={{ background: p.palette.ink, opacity: 0.85 }}
                  />
                </div>
                <span className="mt-2 block text-[13px] font-semibold text-brand-ink">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Accent + font + radius */}
      <section className="grid gap-5 rounded-card border border-brand-line bg-white p-6 shadow-card sm:grid-cols-3">
        <div>
          <label className="block text-sm font-semibold text-brand-ink">
            {t("accentLabel")}
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              aria-label={t("accentLabel")}
              value={state.accent || SITE_PRESETS[state.preset].palette.accent}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  accent: e.target.value.toUpperCase(),
                }))
              }
              className="h-9 w-12 cursor-pointer rounded-[8px] border border-brand-line bg-white p-1"
            />
            {state.accent ? (
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, accent: "" }))}
                className="text-[12px] font-medium text-brand-mute underline hover:text-brand-ink"
              >
                {t("accentReset")}
              </button>
            ) : (
              <span className="text-[12px] text-brand-mute">
                {t("accentDefault")}
              </span>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="theme-font"
            className="block text-sm font-semibold text-brand-ink"
          >
            {t("fontLabel")}
          </label>
          <select
            id="theme-font"
            value={state.font}
            onChange={(e) =>
              setState((s) => ({ ...s, font: e.target.value as SiteFont | "" }))
            }
            className="mt-2 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
          >
            <option value="">{t("inheritPreset")}</option>
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {t(`font_${f}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="theme-radius"
            className="block text-sm font-semibold text-brand-ink"
          >
            {t("radiusLabel")}
          </label>
          <select
            id="theme-radius"
            value={state.radius}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                radius: e.target.value as SiteRadius | "",
              }))
            }
            className="mt-2 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
          >
            <option value="">{t("inheritPreset")}</option>
            {RADII.map((r) => (
              <option key={r} value={r}>
                {t(`radius_${r}`)}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Live preview */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h3 className="text-sm font-semibold text-brand-ink">
          {t("previewLabel")}
        </h3>
        <div
          className="mt-3 overflow-hidden rounded-card border"
          style={{
            ...vars,
            background: "var(--site-bg)",
            borderColor: "var(--site-line)",
            fontFamily: "var(--site-font-body)",
          }}
        >
          <div className="p-6">
            <div
              style={{
                fontFamily: "var(--site-font-heading)",
                color: "var(--site-ink)",
              }}
              className="text-2xl font-bold"
            >
              {t("previewHeadline")}
            </div>
            <p className="mt-1.5 text-sm" style={{ color: "var(--site-mute)" }}>
              {t("previewBody")}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span
                className="inline-flex items-center px-4 py-2 text-sm font-semibold"
                style={{
                  background: "var(--site-accent)",
                  color: "var(--site-accent-ink)",
                  borderRadius: "var(--site-radius)",
                }}
              >
                {t("previewButton")}
              </span>
              <span
                className="inline-flex items-center px-4 py-2 text-sm font-medium"
                style={{
                  background: "var(--site-surface)",
                  color: "var(--site-ink)",
                  border: "1px solid var(--site-line)",
                  borderRadius: "var(--site-radius)",
                }}
              >
                {t("previewSecondary")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("saveChanges")}
        </button>
      </div>
    </div>
  );
}
