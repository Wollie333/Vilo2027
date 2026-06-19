"use client";

import { Check } from "lucide-react";

import { useTranslations } from "next-intl";

import {
  SITE_PRESETS,
  SITE_PRESET_KEYS,
  buildSiteVars,
  type SiteFont,
  type SitePresetKey,
  type SiteRadius,
} from "@/lib/site/themes";
import type { SiteLogoStyle } from "@/lib/site/types";

import {
  AssetUploader,
  ColorField,
  Field,
  RangeRow,
  Segmented,
  StudioCard,
  inputCls,
} from "./_components";
import {
  SOCIAL_KEYS,
  studioThemeConfig,
  type StudioColors,
  type StudioState,
} from "./studio";

export type SectionProps = {
  websiteId: string;
  state: StudioState;
  merge: (patch: Partial<StudioState>) => void;
  fallbackName: string;
};

const FONTS: SiteFont[] = ["sans", "serif", "elegant", "grotesk", "editorial"];
const RADII: SiteRadius[] = ["none", "sm", "md", "lg", "xl"];

const FONT_SAMPLE: Record<SiteFont, string> = {
  sans: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", ui-serif, serif',
  elegant: '"Cormorant Garamond", Georgia, ui-serif, serif',
  grotesk: '"Trebuchet MS", "Avenir Next", "Segoe UI", Verdana, sans-serif',
  editorial: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
};

// Named modular-scale ratios for the type-scale slider readout.
const SCALE_NAMES: Array<{ v: number; label: string }> = [
  { v: 1.125, label: "Major Second" },
  { v: 1.2, label: "Minor Third" },
  { v: 1.25, label: "Major Third" },
  { v: 1.333, label: "Perfect Fourth" },
  { v: 1.414, label: "Augmented Fourth" },
  { v: 1.5, label: "Perfect Fifth" },
  { v: 1.618, label: "Golden" },
];
const scaleName = (v: number) =>
  SCALE_NAMES.reduce((a, b) => (Math.abs(b.v - v) < Math.abs(a.v - v) ? b : a))
    .label;

// ── Identity ──────────────────────────────────────────────
export function IdentitySection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const socialLabels: Record<string, string> = {
    instagram: t("socialInstagram"),
    facebook: t("socialFacebook"),
    x: t("socialX"),
    youtube: t("socialYoutube"),
    linkedin: t("socialLinkedin"),
    website: t("socialWebsite"),
  };
  return (
    <div className="space-y-5">
      <StudioCard title={t("brandIdentityTitle")} hint={t("brandIdentitySub")}>
        <div className="space-y-4">
          <Field label={t("siteNameLabel")}>
            <input
              value={state.name}
              onChange={(e) => merge({ name: e.target.value })}
              maxLength={120}
              placeholder={t("siteNamePlaceholder")}
              className={`mt-1.5 ${inputCls}`}
            />
          </Field>
          <Field label={t("taglineLabel")} hint={t("taglineHint")}>
            <input
              value={state.tagline}
              onChange={(e) => merge({ tagline: e.target.value })}
              maxLength={200}
              placeholder={t("taglinePlaceholder")}
              className={`mt-1.5 ${inputCls}`}
            />
          </Field>
        </div>
      </StudioCard>

      <StudioCard title={t("brandContactTitle")} hint={t("brandContactSub")}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("contactEmailLabel")}>
              <input
                type="email"
                value={state.contactEmail}
                onChange={(e) => merge({ contactEmail: e.target.value })}
                maxLength={160}
                className={`mt-1.5 ${inputCls}`}
              />
            </Field>
            <Field label={t("contactPhoneLabel")}>
              <input
                value={state.contactPhone}
                onChange={(e) => merge({ contactPhone: e.target.value })}
                maxLength={60}
                className={`mt-1.5 ${inputCls}`}
              />
            </Field>
          </div>
          <div>
            <span className="block text-[13px] font-semibold text-brand-ink">
              {t("socialsLabel")}
            </span>
            <div className="mt-2 grid gap-2.5">
              {SOCIAL_KEYS.map((key) => (
                <input
                  key={key}
                  value={state.socials[key]}
                  onChange={(e) =>
                    merge({
                      socials: { ...state.socials, [key]: e.target.value },
                    })
                  }
                  maxLength={300}
                  placeholder={socialLabels[key]}
                  className={inputCls}
                />
              ))}
            </div>
          </div>
        </div>
      </StudioCard>
    </div>
  );
}

// ── Logos & Favicons ──────────────────────────────────────
export function LogosSection({ websiteId, state, merge }: SectionProps) {
  const t = useTranslations("website");
  const setAsset = (slot: keyof StudioState["assets"], url: string | null) =>
    merge({ assets: { ...state.assets, [slot]: url } });

  const styleOptions: Array<{ value: SiteLogoStyle; label: string }> = [
    { value: "wordmark", label: t("styleWordmark") },
    { value: "mark", label: t("styleMark") },
    { value: "icon", label: t("styleIcon") },
  ];

  return (
    <div className="space-y-5">
      <StudioCard title={t("brandLogoTitle")} hint={t("brandLogoSub")}>
        <div className="space-y-5">
          <AssetUploader
            websiteId={websiteId}
            slot="primary"
            url={state.assets.primary}
            onChange={(u) => setAsset("primary", u)}
            preview="wide"
          />
          <Field label={t("brandLogoStyleLabel")}>
            <div className="mt-2">
              <Segmented
                value={state.logoStyle}
                options={styleOptions}
                onChange={(v) => merge({ logoStyle: v })}
              />
            </div>
          </Field>
          <RangeRow
            label={t("brandLogoHeightLabel")}
            value={state.logoMaxHeight}
            min={28}
            max={64}
            step={1}
            suffix="px"
            onChange={(v) => merge({ logoMaxHeight: v })}
          />
        </div>
      </StudioCard>

      <StudioCard
        title={t("brandLogoLightTitle")}
        hint={t("brandLogoLightSub")}
      >
        <AssetUploader
          websiteId={websiteId}
          slot="light"
          url={state.assets.light}
          onChange={(u) => setAsset("light", u)}
          preview="wide"
        />
      </StudioCard>

      <StudioCard title={t("brandLogoIconTitle")} hint={t("brandLogoIconSub")}>
        <AssetUploader
          websiteId={websiteId}
          slot="icon"
          url={state.assets.icon}
          onChange={(u) => setAsset("icon", u)}
        />
      </StudioCard>

      <StudioCard title={t("faviconLabel")} hint={t("faviconHint")}>
        <AssetUploader
          websiteId={websiteId}
          slot="favicon"
          url={state.assets.favicon}
          onChange={(u) => setAsset("favicon", u)}
        />
      </StudioCard>

      <StudioCard
        title={t("brandAppleIconTitle")}
        hint={t("brandAppleIconSub")}
      >
        <AssetUploader
          websiteId={websiteId}
          slot="apple"
          url={state.assets.apple}
          onChange={(u) => setAsset("apple", u)}
        />
      </StudioCard>
    </div>
  );
}

// ── Colours ───────────────────────────────────────────────
const COLOUR_ROLES: Array<{
  key: keyof StudioColors;
  labelKey: string;
  presetKey: keyof (typeof SITE_PRESETS)["classic"]["palette"];
}> = [
  { key: "bg", labelKey: "brandColourBg", presetKey: "bg" },
  { key: "surface", labelKey: "brandColourSurface", presetKey: "surface" },
  { key: "ink", labelKey: "brandColourText", presetKey: "ink" },
  { key: "mute", labelKey: "brandColourMuted", presetKey: "mute" },
  { key: "line", labelKey: "brandColourBorder", presetKey: "line" },
  { key: "accent", labelKey: "brandColourPrimary", presetKey: "accent" },
  { key: "secondary", labelKey: "brandColourSecondary", presetKey: "accent" },
];

export function ColoursSection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const preset = SITE_PRESETS[state.preset];
  const setColor = (role: keyof StudioColors, hex: string) =>
    merge({ colors: { ...state.colors, [role]: hex } });

  const inheritedFor = (role: keyof StudioColors): string => {
    if (role === "secondary")
      return state.colors.accent || preset.palette.accent;
    return preset.palette[role as keyof typeof preset.palette] as string;
  };

  const addSwatch = (hex: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    if (state.palette.includes(hex.toUpperCase()) || state.palette.length >= 12)
      return;
    merge({ palette: [...state.palette, hex.toUpperCase()] });
  };

  return (
    <div className="space-y-5">
      <StudioCard title={t("presetLabel")} hint={t("brandPresetSub")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SITE_PRESET_KEYS.map((key) => {
            const active = state.preset === key;
            const p = SITE_PRESETS[key].palette;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  merge({
                    preset: key as SitePresetKey,
                    colors: {
                      bg: "",
                      surface: "",
                      ink: "",
                      mute: "",
                      line: "",
                      accent: "",
                      secondary: "",
                    },
                  })
                }
                className={`relative rounded-card border p-2.5 text-left transition ${
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
                <span className="flex gap-1">
                  {[p.bg, p.surface, p.ink, p.accent].map((c, i) => (
                    <span
                      key={i}
                      className="h-6 flex-1 rounded ring-1 ring-black/5"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <span className="mt-1.5 block text-[12.5px] font-semibold text-brand-ink">
                  {SITE_PRESETS[key].label}
                </span>
              </button>
            );
          })}
        </div>
      </StudioCard>

      <StudioCard title={t("brandPaletteTitle")} hint={t("brandPaletteSub")}>
        <div className="flex flex-wrap items-center gap-2">
          {state.palette.map((c) => (
            <span key={c} className="group relative">
              <span
                className="block h-8 w-8 rounded-full ring-1 ring-black/10"
                style={{ background: c }}
              />
              <button
                type="button"
                onClick={() =>
                  merge({ palette: state.palette.filter((x) => x !== c) })
                }
                aria-label={t("remove")}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-brand-ink text-[10px] text-white group-hover:flex"
              >
                ×
              </button>
            </span>
          ))}
          {state.palette.length < 12 ? (
            <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-brand-line text-brand-mute hover:border-brand-primary hover:text-brand-primary">
              <span className="text-lg leading-none">+</span>
              <input
                type="color"
                onChange={(e) => addSwatch(e.target.value.toUpperCase())}
                className="absolute h-0 w-0 opacity-0"
              />
            </label>
          ) : null}
        </div>
      </StudioCard>

      <StudioCard title={t("brandColoursTitle")} hint={t("brandColoursSub")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {COLOUR_ROLES.map((r) => (
            <ColorField
              key={r.key}
              label={t(r.labelKey)}
              value={state.colors[r.key]}
              inheritedHex={inheritedFor(r.key)}
              palette={state.palette}
              onChange={(hex) => setColor(r.key, hex)}
            />
          ))}
        </div>
      </StudioCard>
    </div>
  );
}

// ── Typography ────────────────────────────────────────────
function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SiteFont | "";
  onChange: (v: SiteFont | "") => void;
}) {
  const t = useTranslations("website");
  return (
    <Field label={label}>
      <div className="mt-2 grid gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`flex items-center gap-3 rounded-[11px] border px-3 py-2 text-left transition ${
            value === ""
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
            onClick={() => onChange(f)}
            className={`flex items-center gap-3 rounded-[11px] border px-3 py-2 text-left transition ${
              value === f
                ? "border-brand-primary bg-brand-light/60"
                : "border-brand-line hover:bg-brand-light/40"
            }`}
          >
            <span
              style={{ fontFamily: FONT_SAMPLE[f] }}
              className="text-xl font-bold leading-none text-brand-ink"
            >
              Ag
            </span>
            <span className="text-[13px] font-semibold text-brand-ink">
              {t(`font_${f}`)}
            </span>
            {value === f ? (
              <Check className="ml-auto h-4 w-4 text-brand-primary" />
            ) : null}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function TypographySection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const ty = state.type;
  const setType = (patch: Partial<StudioState["type"]>) =>
    merge({ type: { ...ty, ...patch } });
  const vars = buildSiteVars(studioThemeConfig(state));

  const weightOpts = [300, 400, 500, 600, 700, 800];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <StudioCard title={t("brandHeadingFontTitle")}>
          <FontSelect
            label={t("brandHeadingFontLabel")}
            value={ty.headingFont}
            onChange={(v) => setType({ headingFont: v })}
          />
        </StudioCard>
        <StudioCard title={t("brandBodyFontTitle")}>
          <FontSelect
            label={t("brandBodyFontLabel")}
            value={ty.bodyFont}
            onChange={(v) => setType({ bodyFont: v })}
          />
        </StudioCard>
      </div>

      <StudioCard
        title={t("brandTypeScaleTitle")}
        hint={t("brandTypeScaleSub")}
      >
        <div className="space-y-5">
          <RangeRow
            label={t("brandBaseSize")}
            value={ty.baseSize}
            min={12}
            max={22}
            step={1}
            suffix="px"
            onChange={(v) => setType({ baseSize: v })}
          />
          <RangeRow
            label={t("brandScale")}
            value={ty.scale}
            min={1.0}
            max={1.6}
            step={0.001}
            format={(v) => `${v.toFixed(3)} · ${scaleName(v)}`}
            onChange={(v) => setType({ scale: v })}
          />
        </div>
      </StudioCard>

      <div className="grid gap-5 sm:grid-cols-2">
        <StudioCard title={t("brandHeadingStyleTitle")}>
          <div className="space-y-5">
            <Field label={t("brandWeight")}>
              <div className="mt-2">
                <Segmented
                  value={String(ty.headingWeight)}
                  options={weightOpts.map((w) => ({
                    value: String(w),
                    label: String(w),
                  }))}
                  onChange={(v) => setType({ headingWeight: Number(v) })}
                />
              </div>
            </Field>
            <RangeRow
              label={t("brandLineHeight")}
              value={ty.headingLeading}
              min={1.0}
              max={2.0}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => setType({ headingLeading: v })}
            />
            <RangeRow
              label={t("brandLetterSpacing")}
              value={ty.headingTracking}
              min={-0.05}
              max={0.1}
              step={0.005}
              suffix="em"
              format={(v) => v.toFixed(3)}
              onChange={(v) => setType({ headingTracking: v })}
            />
          </div>
        </StudioCard>

        <StudioCard title={t("brandBodyStyleTitle")}>
          <div className="space-y-5">
            <Field label={t("brandWeight")}>
              <div className="mt-2">
                <Segmented
                  value={String(ty.bodyWeight)}
                  options={[300, 400, 500, 600, 700].map((w) => ({
                    value: String(w),
                    label: String(w),
                  }))}
                  onChange={(v) => setType({ bodyWeight: Number(v) })}
                />
              </div>
            </Field>
            <RangeRow
              label={t("brandLineHeight")}
              value={ty.bodyLeading}
              min={1.0}
              max={2.0}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => setType({ bodyLeading: v })}
            />
            <RangeRow
              label={t("brandLetterSpacing")}
              value={ty.bodyTracking}
              min={-0.05}
              max={0.1}
              step={0.005}
              suffix="em"
              format={(v) => v.toFixed(3)}
              onChange={(v) => setType({ bodyTracking: v })}
            />
          </div>
        </StudioCard>
      </div>

      {/* Live type specimen */}
      <StudioCard title={t("brandSpecimenTitle")}>
        <div
          style={{ ...vars, background: "var(--site-bg)" }}
          className="space-y-3 rounded-[12px] border border-brand-line p-5"
        >
          {(["h1", "h2", "h3"] as const).map((step) => (
            <div
              key={step}
              style={{
                fontFamily: "var(--site-font-heading)",
                fontWeight: "var(--site-weight-heading)" as unknown as number,
                fontSize: `var(--site-${step})`,
                lineHeight: "var(--site-leading-heading)" as unknown as number,
                letterSpacing: "var(--site-tracking-heading)",
                color: "var(--site-ink)",
              }}
            >
              {t("brandSpecimenHeading")}
            </div>
          ))}
          <p
            style={{
              fontFamily: "var(--site-font-body)",
              fontWeight: "var(--site-weight-body)" as unknown as number,
              fontSize: "var(--site-text-base)",
              lineHeight: "var(--site-leading-body)" as unknown as number,
              letterSpacing: "var(--site-tracking-body)",
              color: "var(--site-ink)",
            }}
          >
            {t("brandSpecimenBody")}
          </p>
        </div>
      </StudioCard>
    </div>
  );
}

// ── Buttons & Corners ─────────────────────────────────────
export function ButtonsSection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const vars = buildSiteVars(studioThemeConfig(state));
  return (
    <div className="space-y-5">
      <StudioCard title={t("themeCornersLabel")} hint={t("brandCornersSub")}>
        <Segmented
          value={state.radius || "inherit"}
          options={[
            { value: "inherit", label: t("inheritPreset") },
            ...RADII.map((r) => ({ value: r, label: t(`radius_${r}`) })),
          ]}
          onChange={(v) =>
            merge({ radius: v === "inherit" ? "" : (v as SiteRadius) })
          }
        />
      </StudioCard>

      <StudioCard title={t("brandButtonsTitle")} hint={t("brandButtonsSub")}>
        <div className="space-y-4">
          <Segmented
            value={state.buttonStyle}
            options={[
              { value: "solid", label: t("brandButtonSolid") },
              { value: "outline", label: t("brandButtonOutline") },
            ]}
            onChange={(v) =>
              merge({ buttonStyle: v as StudioState["buttonStyle"] })
            }
          />
          <div
            style={{ ...vars, background: "var(--site-surface)" }}
            className="flex items-center gap-3 rounded-[12px] border border-brand-line p-5"
          >
            <span
              style={
                state.buttonStyle === "outline"
                  ? {
                      color: "var(--site-accent)",
                      border: "1px solid var(--site-accent)",
                      borderRadius: "var(--site-radius)",
                    }
                  : {
                      background: "var(--site-accent)",
                      color: "var(--site-accent-ink)",
                      borderRadius: "var(--site-radius)",
                    }
              }
              className="inline-flex items-center px-5 py-2.5 text-sm font-semibold"
            >
              {t("brandButtonPreview")}
            </span>
          </div>
        </div>
      </StudioCard>
    </div>
  );
}
