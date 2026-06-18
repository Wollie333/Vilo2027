"use client";

import { Check, Loader2, Monitor, RotateCcw, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
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

const FONTS: SiteFont[] = ["sans", "serif", "elegant", "grotesk", "editorial"];
const RADII: SiteRadius[] = ["none", "sm", "md", "lg", "xl"];

// Curated accent swatches (the custom picker stays for anything else).
const ACCENT_SWATCHES = [
  "#1F6F54",
  "#1F6FEB",
  "#0E8FB0",
  "#C2522E",
  "#7C5CFC",
  "#CBA653",
  "#E0506B",
  "#0A0A0A",
];

// Heading stacks for the "Ag" type-card samples (mirrors lib/site/themes).
const FONT_SAMPLE: Record<SiteFont, string> = {
  sans: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", ui-serif, serif',
  elegant: '"Cormorant Garamond", Georgia, ui-serif, serif',
  grotesk: '"Trebuchet MS", "Avenir Next", "Segoe UI", Verdana, sans-serif',
  editorial: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
};

type ThemeState = {
  preset: SitePresetKey;
  accent: string;
  font: SiteFont | "";
  radius: SiteRadius | "";
};

/** Small browser/page mock used on each preset card. */
function PresetMock({ presetKey }: { presetKey: SitePresetKey }) {
  const p = SITE_PRESETS[presetKey].palette;
  return (
    <div
      className="overflow-hidden rounded-[8px] border"
      style={{ background: p.bg, borderColor: p.line }}
    >
      <div
        className="flex h-5 items-center gap-1 px-2"
        style={{ background: p.surface, borderBottom: `1px solid ${p.line}` }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: p.accent }}
        />
        <span
          className="h-1.5 w-8 rounded-full"
          style={{ background: p.ink, opacity: 0.6 }}
        />
        <span
          className="ml-auto h-2.5 w-5 rounded-full"
          style={{ background: p.accent }}
        />
      </div>
      <div className="space-y-1 p-2">
        <span
          className="block h-2 w-3/5 rounded"
          style={{ background: p.ink, opacity: 0.85 }}
        />
        <span
          className="block h-1.5 w-2/5 rounded"
          style={{ background: p.mute, opacity: 0.6 }}
        />
        <span
          className="mt-1 inline-block h-3 w-9 rounded"
          style={{ background: p.accent }}
        />
      </div>
    </div>
  );
}

export function ThemeForm({
  websiteId,
  initial,
  preview,
}: {
  websiteId: string;
  initial: { preset: string; accent: string; font: string; radius: string };
  preview: ReactNode;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");

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

  const customised = state.accent || state.font || state.radius;
  const activeAccent =
    state.accent || SITE_PRESETS[state.preset].palette.accent;

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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
      <div className="space-y-5">
        {/* Presets */}
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("presetLabel")}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {SITE_PRESET_KEYS.map((key) => {
              const active = state.preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      preset: key,
                      accent: "",
                      font: "",
                      radius: "",
                    }))
                  }
                  className={`relative rounded-card border p-2.5 text-left transition ${
                    active
                      ? "border-brand-primary ring-1 ring-brand-primary"
                      : "border-brand-line hover:border-brand-mute"
                  }`}
                >
                  {active ? (
                    <span className="absolute right-2 top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  ) : null}
                  <PresetMock presetKey={key} />
                  <span className="mt-2 flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-brand-ink">
                      {SITE_PRESETS[key].label}
                    </span>
                  </span>
                  <span className="mt-1.5 flex gap-1">
                    {[
                      SITE_PRESETS[key].palette.accent,
                      SITE_PRESETS[key].palette.ink,
                      SITE_PRESETS[key].palette.bg,
                      SITE_PRESETS[key].palette.line,
                    ].map((c, i) => (
                      <span
                        key={i}
                        className="h-3 w-3 rounded-full ring-1 ring-black/5"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Customise */}
        <section className="space-y-5 rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-ink">
              {t("accentLabel")}
            </h3>
            {customised ? (
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, accent: "", font: "", radius: "" }))
                }
                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                {t("accentReset")}
              </button>
            ) : null}
          </div>

          {/* Accent swatches + custom */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setState((s) => ({ ...s, accent: c }))}
                  className={`h-8 w-8 rounded-full ring-1 ring-black/10 transition hover:scale-110 ${
                    activeAccent.toLowerCase() === c.toLowerCase()
                      ? "ring-2 ring-brand-ink ring-offset-2"
                      : ""
                  }`}
                  style={{ background: c }}
                />
              ))}
              <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-brand-line px-2 py-1.5 text-[12px] font-medium text-brand-mute hover:bg-brand-light">
                <input
                  type="color"
                  value={activeAccent}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      accent: e.target.value.toUpperCase(),
                    }))
                  }
                  className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                {t("themeAccentCustom")}
              </label>
            </div>
          </div>

          {/* Typography cards */}
          <div>
            <span className="block text-sm font-semibold text-brand-ink">
              {t("themeTypographyLabel")}
            </span>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, font: "" }))}
                className={`flex items-center gap-3 rounded-[11px] border px-3 py-2 text-left transition ${
                  state.font === ""
                    ? "border-brand-primary bg-brand-light/60"
                    : "border-brand-line hover:bg-brand-light/40"
                }`}
              >
                <span className="text-[11px] font-semibold text-brand-mute">
                  {t("inheritPreset")}
                </span>
              </button>
              {FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, font: f }))}
                  className={`flex items-center gap-3 rounded-[11px] border px-3 py-2 text-left transition ${
                    state.font === f
                      ? "border-brand-primary bg-brand-light/60"
                      : "border-brand-line hover:bg-brand-light/40"
                  }`}
                >
                  <span
                    style={{ fontFamily: FONT_SAMPLE[f] }}
                    className="text-2xl font-bold leading-none text-brand-ink"
                  >
                    Ag
                  </span>
                  <span className="text-[13px] font-semibold text-brand-ink">
                    {t(`font_${f}`)}
                  </span>
                  {state.font === f ? (
                    <Check className="ml-auto h-4 w-4 text-brand-primary" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Corners */}
          <div>
            <span className="block text-sm font-semibold text-brand-ink">
              {t("themeCornersLabel")}
            </span>
            <div className="mt-2 inline-flex w-full rounded-pill border border-brand-line bg-brand-light/60 p-0.5 text-[12px] font-semibold">
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, radius: "" }))}
                className={`flex-1 rounded-pill py-1.5 ${
                  state.radius === ""
                    ? "bg-white text-brand-secondary shadow-sm"
                    : "text-brand-mute"
                }`}
              >
                {t("inheritPreset")}
              </button>
              {RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, radius: r }))}
                  className={`flex-1 rounded-pill py-1.5 ${
                    state.radius === r
                      ? "bg-white text-brand-secondary shadow-sm"
                      : "text-brand-mute"
                  }`}
                >
                  {t(`radius_${r}`)}
                </button>
              ))}
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

      {/* Full-site live preview (real home page re-themed via live vars) */}
      <div className="lg:sticky lg:top-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
            {t("themePreviewLive")}
          </span>
          <div className="inline-flex rounded-pill border border-brand-line bg-brand-light/60 p-0.5">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              title={t("themePreviewDesktop")}
              className={`rounded-pill px-2.5 py-1.5 ${device === "desktop" ? "bg-white text-brand-secondary shadow-sm" : "text-brand-mute"}`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("phone")}
              title={t("themePreviewPhone")}
              className={`rounded-pill px-2.5 py-1.5 ${device === "phone" ? "bg-white text-brand-secondary shadow-sm" : "text-brand-mute"}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-card border border-brand-line shadow-card">
          <div
            className="mx-auto max-h-[640px] overflow-y-auto transition-all"
            style={{
              ...vars,
              background: "var(--site-bg)",
              color: "var(--site-ink)",
              fontFamily: "var(--site-font-body)",
              width: device === "phone" ? 390 : "100%",
            }}
          >
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}
