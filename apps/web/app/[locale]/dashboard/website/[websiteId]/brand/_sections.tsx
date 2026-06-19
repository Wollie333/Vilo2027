"use client";

import {
  BadgeCheck,
  Droplet,
  Image as ImageIcon,
  RotateCcw,
  Share2,
  SquareMousePointer,
  Type,
} from "lucide-react";

import { useTranslations } from "next-intl";

import {
  SITE_PRESETS,
  buildSiteVars,
  modularSizes,
  type SiteFont,
  type SitePresetKey,
  type SiteRadius,
  type SiteShadow,
} from "@/lib/site/themes";
import type { SiteLogoStyle } from "@/lib/site/types";
import { siteImageStyle } from "@/components/site/sections/_shared";

import type { SizeKey } from "../../schemas";

import { AssetUploader } from "./_components";
import {
  Acc,
  Ctl,
  CtlLabel,
  Seg,
  Slider,
  SwatchRow,
  ThemeCards,
  bsInput,
  bsSelect,
} from "./_ui";
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

const FONT_SAMPLE: Record<SiteFont, string> = {
  sans: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", ui-serif, serif',
  elegant: '"Cormorant Garamond", Georgia, ui-serif, serif',
  grotesk: '"Trebuchet MS", "Avenir Next", "Segoe UI", Verdana, sans-serif',
  editorial: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
};

// ── Identity ──────────────────────────────────────────────
export function IdentitySection({ websiteId, state, merge }: SectionProps) {
  const t = useTranslations("website");
  const setAsset = (slot: keyof StudioState["assets"], url: string | null) =>
    merge({ assets: { ...state.assets, [slot]: url } });

  const logoStyles: Array<{ value: SiteLogoStyle; label: string }> = [
    { value: "wordmark", label: t("styleWordmark") },
    { value: "mark", label: t("styleMark") },
    { value: "icon", label: t("styleIcon") },
  ];

  return (
    <Acc
      icon={<BadgeCheck className="h-[17px] w-[17px]" />}
      title={t("brandIdentityTitle")}
      subtitle={t("brandIdentitySub")}
      defaultOpen
    >
      <Ctl>
        <CtlLabel>{t("siteNameLabel")}</CtlLabel>
        <input
          value={state.name}
          onChange={(e) => merge({ name: e.target.value })}
          maxLength={120}
          placeholder={t("siteNamePlaceholder")}
          className={bsInput}
        />
      </Ctl>
      <Ctl>
        <CtlLabel hint={t("taglineHint")}>{t("taglineLabel")}</CtlLabel>
        <input
          value={state.tagline}
          onChange={(e) => merge({ tagline: e.target.value })}
          maxLength={200}
          placeholder={t("taglinePlaceholder")}
          className={bsInput}
        />
      </Ctl>

      <Ctl>
        <CtlLabel hint={t("brandLogoSub")}>{t("brandLogoTitle")}</CtlLabel>
        <AssetUploader
          websiteId={websiteId}
          slot="primary"
          url={state.assets.primary}
          onChange={(u) => setAsset("primary", u)}
          preview="wide"
        />
        <div className="mt-3">
          <Seg
            value={state.logoStyle}
            options={logoStyles}
            onChange={(v) => merge({ logoStyle: v })}
          />
        </div>
        <div className="mt-3">
          <Slider
            value={state.logoMaxHeight}
            min={28}
            max={64}
            step={1}
            suffix="px"
            onChange={(v) => merge({ logoMaxHeight: v })}
          />
        </div>
      </Ctl>

      <Ctl>
        <CtlLabel>{t("brandLogoLightTitle")}</CtlLabel>
        <AssetUploader
          websiteId={websiteId}
          slot="light"
          url={state.assets.light}
          onChange={(u) => setAsset("light", u)}
          preview="wide"
        />
      </Ctl>
      <Ctl>
        <CtlLabel hint={t("faviconHint")}>{t("faviconLabel")}</CtlLabel>
        <AssetUploader
          websiteId={websiteId}
          slot="favicon"
          url={state.assets.favicon}
          onChange={(u) => setAsset("favicon", u)}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandAppleIconTitle")}</CtlLabel>
        <AssetUploader
          websiteId={websiteId}
          slot="apple"
          url={state.assets.apple}
          onChange={(u) => setAsset("apple", u)}
        />
      </Ctl>
    </Acc>
  );
}

// ── Colour ────────────────────────────────────────────────
const COLOUR_ROLES: Array<{ key: keyof StudioColors; labelKey: string }> = [
  { key: "bg", labelKey: "brandColourBg" },
  { key: "surface", labelKey: "brandColourSurface" },
  { key: "ink", labelKey: "brandColourText" },
  { key: "mute", labelKey: "brandColourMuted" },
  { key: "line", labelKey: "brandColourBorder" },
  { key: "secondary", labelKey: "brandColourSecondary" },
];

export function ColourSection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const preset = SITE_PRESETS[state.preset];
  const setColor = (role: keyof StudioColors, hex: string) =>
    merge({ colors: { ...state.colors, [role]: hex } });

  const inheritedFor = (role: keyof StudioColors): string =>
    role === "secondary"
      ? state.colors.accent || preset.palette.accent
      : (preset.palette[role as keyof typeof preset.palette] as string);

  return (
    <Acc
      icon={<Droplet className="h-[17px] w-[17px]" />}
      title={t("brandColoursTitle")}
      subtitle={t("brandColourSub")}
      defaultOpen
    >
      <Ctl>
        <CtlLabel>{t("presetLabel")}</CtlLabel>
        <ThemeCards
          value={state.preset}
          onChange={(key) =>
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
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandColourPrimary")}</CtlLabel>
        <SwatchRow
          value={state.colors.accent}
          inheritedHex={preset.palette.accent}
          onChange={(hex) => setColor("accent", hex)}
        />
      </Ctl>
      {COLOUR_ROLES.map((r) => (
        <Ctl key={r.key}>
          <CtlLabel>{t(r.labelKey)}</CtlLabel>
          <SwatchRow
            value={state.colors[r.key]}
            inheritedHex={inheritedFor(r.key)}
            onChange={(hex) => setColor(r.key, hex)}
          />
        </Ctl>
      ))}
    </Acc>
  );
}

// ── Typography ────────────────────────────────────────────
const SIZE_ROWS: Array<{ key: SizeKey; labelKey: string }> = [
  { key: "h1", labelKey: "brandSizeH1" },
  { key: "h2", labelKey: "brandSizeH2" },
  { key: "h3", labelKey: "brandSizeH3" },
  { key: "h4", labelKey: "brandSizeH4" },
  { key: "h5", labelKey: "brandSizeH5" },
  { key: "h6", labelKey: "brandSizeH6" },
  { key: "body", labelKey: "brandSizeBody" },
  { key: "accent", labelKey: "brandSizeAccent" },
];

function FontSelect({
  value,
  onChange,
}: {
  value: SiteFont | "";
  onChange: (v: SiteFont | "") => void;
}) {
  const t = useTranslations("website");
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SiteFont | "")}
      className={bsSelect}
      style={value ? { fontFamily: FONT_SAMPLE[value as SiteFont] } : undefined}
    >
      <option value="">{t("inheritPreset")}</option>
      {FONTS.map((f) => (
        <option key={f} value={f}>
          {t(`font_${f}`)}
        </option>
      ))}
    </select>
  );
}

function SizeRow({
  label,
  value,
  derived,
  onSet,
}: {
  label: string;
  value: number | null;
  derived: number;
  onSet: (v: number | null) => void;
}) {
  const t = useTranslations("website");
  const effective = value ?? Math.round(derived);
  return (
    <div className="flex items-center gap-3">
      <span className="w-[78px] shrink-0 text-[12px] font-semibold text-brand-ink">
        {label}
      </span>
      <input
        type="range"
        min={8}
        max={200}
        step={1}
        value={effective}
        onChange={(e) => onSet(Number(e.target.value))}
        className="h-[5px] flex-1 cursor-pointer appearance-none rounded-full bg-brand-line accent-brand-primary"
      />
      {value == null ? (
        <span className="w-[58px] shrink-0 text-right font-mono text-[11.5px] text-brand-mute">
          {effective}
          <span className="text-brand-mute/60"> A</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onSet(null)}
          title={t("brandSizeReset")}
          className="inline-flex w-[58px] shrink-0 items-center justify-end gap-1 font-mono text-[11.5px] font-semibold text-brand-secondary"
        >
          {effective}
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function TypographySection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const ty = state.type;
  const setType = (patch: Partial<StudioState["type"]>) =>
    merge({ type: { ...ty, ...patch } });
  const vars = buildSiteVars(studioThemeConfig(state));
  const derived = modularSizes(ty.baseSize, ty.scale);

  return (
    <Acc
      icon={<Type className="h-[17px] w-[17px]" />}
      title={t("brandTypographyTitle")}
      subtitle={t("brandTypographySub")}
    >
      <Ctl>
        <CtlLabel>{t("brandHeadingFontTitle")}</CtlLabel>
        <FontSelect
          value={ty.headingFont}
          onChange={(v) => setType({ headingFont: v })}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandBodyFontTitle")}</CtlLabel>
        <FontSelect
          value={ty.bodyFont}
          onChange={(v) => setType({ bodyFont: v })}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandHeadingWeight")}</CtlLabel>
        <Slider
          value={ty.headingWeight}
          min={300}
          max={800}
          step={100}
          onChange={(v) => setType({ headingWeight: v })}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandBodyWeight")}</CtlLabel>
        <Slider
          value={ty.bodyWeight}
          min={300}
          max={700}
          step={100}
          onChange={(v) => setType({ bodyWeight: v })}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandBaseSize")}</CtlLabel>
        <Slider
          value={ty.baseSize}
          min={12}
          max={22}
          step={1}
          suffix="px"
          onChange={(v) => setType({ baseSize: v })}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandScale")}</CtlLabel>
        <Slider
          value={ty.scale}
          min={1}
          max={1.6}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => setType({ scale: v })}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandLineHeight")}</CtlLabel>
        <Slider
          value={ty.bodyLeading}
          min={1}
          max={2}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => setType({ bodyLeading: v })}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandLetterSpacing")}</CtlLabel>
        <Slider
          value={ty.headingTracking}
          min={-0.05}
          max={0.1}
          step={0.005}
          suffix="em"
          format={(v) => v.toFixed(3)}
          onChange={(v) => setType({ headingTracking: v })}
        />
      </Ctl>

      <Ctl>
        <CtlLabel hint={t("brandSizeAuto")}>{t("brandSizesTitle")}</CtlLabel>
        <div className="space-y-2.5">
          {SIZE_ROWS.map((row) => (
            <SizeRow
              key={row.key}
              label={t(row.labelKey)}
              value={ty.sizes[row.key]}
              derived={derived[row.key]}
              onSet={(v) => setType({ sizes: { ...ty.sizes, [row.key]: v } })}
            />
          ))}
        </div>
      </Ctl>

      <div
        style={{ ...vars, background: "var(--site-bg)" }}
        className="mt-4 rounded-[13px] border-[1.5px] border-brand-line/70 p-4"
      >
        <div
          style={{
            fontFamily: "var(--site-font-heading)",
            fontWeight: "var(--site-weight-heading)" as unknown as number,
            fontSize: "var(--site-h3)",
            lineHeight: "var(--site-leading-heading)" as unknown as number,
            letterSpacing: "var(--site-tracking-heading)",
            color: "var(--site-ink)",
          }}
        >
          {t("brandSpecimenHeading")}
        </div>
        <div
          style={{
            fontFamily: "var(--site-font-body)",
            fontSize: "var(--site-text-base)",
            lineHeight: "var(--site-leading-body)" as unknown as number,
            color: "var(--site-mute)",
          }}
          className="mt-1.5"
        >
          {t("brandSpecimenBody")}
        </div>
      </div>
    </Acc>
  );
}

// ── Buttons & corners ─────────────────────────────────────
export function ButtonsSection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const radiusOpts: Array<{ value: SiteRadius | ""; label: string }> = [
    { value: "", label: t("inheritPreset") },
    { value: "none", label: t("radius_none") },
    { value: "sm", label: t("radius_sm") },
    { value: "md", label: t("radius_md") },
    { value: "lg", label: t("radius_lg") },
    { value: "xl", label: t("radius_xl") },
  ];
  return (
    <Acc
      icon={<SquareMousePointer className="h-[17px] w-[17px]" />}
      title={t("brandButtonsTitle")}
      subtitle={t("brandButtonsSub")}
    >
      <Ctl>
        <CtlLabel>{t("themeCornersLabel")}</CtlLabel>
        <Seg
          value={state.radius}
          options={radiusOpts}
          onChange={(v) => merge({ radius: v })}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandButtonShape")}</CtlLabel>
        <Seg
          value={state.buttonStyle}
          options={[
            {
              value: "solid",
              label: t("brandButtonSolid"),
              diagram: <span className="h-3.5 w-8 rounded bg-brand-primary" />,
            },
            {
              value: "outline",
              label: t("brandButtonOutline"),
              diagram: (
                <span className="h-3.5 w-8 rounded border-[1.5px] border-brand-primary" />
              ),
            },
          ]}
          onChange={(v) =>
            merge({ buttonStyle: v as StudioState["buttonStyle"] })
          }
        />
      </Ctl>
    </Acc>
  );
}

// ── Images ────────────────────────────────────────────────
const SHADOW_OPTS: Array<{ value: SiteShadow; labelKey: string }> = [
  { value: "none", labelKey: "shadowNone" },
  { value: "sm", labelKey: "shadowSm" },
  { value: "md", labelKey: "shadowMd" },
  { value: "lg", labelKey: "shadowLg" },
  { value: "xl", labelKey: "shadowXl" },
];

export function ImagesSection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const img = state.image;
  const presetLine = SITE_PRESETS[state.preset].palette.line;
  const setImg = (patch: Partial<StudioState["image"]>) =>
    merge({ image: { ...img, ...patch } });

  return (
    <Acc
      icon={<ImageIcon className="h-[17px] w-[17px]" />}
      title={t("brandImagesTitle")}
      subtitle={t("brandImagesSub")}
    >
      <div
        style={buildSiteVars(studioThemeConfig(state))}
        className="flex items-center justify-center rounded-[13px] border-[1.5px] border-brand-line/70 bg-brand-light/50 p-5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://picsum.photos/seed/vilo-imgstyle/480/320"
          alt=""
          style={siteImageStyle}
          className="h-28 w-44 object-cover"
        />
      </div>
      <Ctl>
        <CtlLabel>{t("brandImageRadius")}</CtlLabel>
        <Slider
          value={img.radius}
          min={0}
          max={48}
          step={1}
          suffix="px"
          onChange={(v) => setImg({ radius: v })}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("brandImageBorderWidth")}</CtlLabel>
        <Slider
          value={img.borderWidth}
          min={0}
          max={12}
          step={1}
          suffix="px"
          onChange={(v) => setImg({ borderWidth: v })}
        />
      </Ctl>
      {img.borderWidth > 0 ? (
        <Ctl>
          <CtlLabel>{t("brandImageBorderColor")}</CtlLabel>
          <SwatchRow
            value={img.borderColor}
            inheritedHex={presetLine}
            onChange={(hex) => setImg({ borderColor: hex })}
          />
        </Ctl>
      ) : null}
      <Ctl>
        <CtlLabel>{t("brandImageShadow")}</CtlLabel>
        <Seg
          value={img.shadow}
          options={SHADOW_OPTS.map((o) => ({
            value: o.value,
            label: t(o.labelKey),
          }))}
          onChange={(v) => setImg({ shadow: v })}
        />
      </Ctl>
    </Acc>
  );
}

// ── Social channels ───────────────────────────────────────
export function SocialSection({ state, merge }: SectionProps) {
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
    <Acc
      icon={<Share2 className="h-[17px] w-[17px]" />}
      title={t("brandSocialTitle")}
      subtitle={t("brandSocialSub")}
    >
      <Ctl>
        <CtlLabel>{t("contactEmailLabel")}</CtlLabel>
        <input
          type="email"
          value={state.contactEmail}
          onChange={(e) => merge({ contactEmail: e.target.value })}
          maxLength={160}
          className={bsInput}
        />
      </Ctl>
      <Ctl>
        <CtlLabel>{t("contactPhoneLabel")}</CtlLabel>
        <input
          value={state.contactPhone}
          onChange={(e) => merge({ contactPhone: e.target.value })}
          maxLength={60}
          className={bsInput}
        />
      </Ctl>
      <Ctl>
        <CtlLabel hint={t("brandSocialHint")}>{t("socialsLabel")}</CtlLabel>
        <div className="space-y-2.5">
          {SOCIAL_KEYS.map((key) => (
            <input
              key={key}
              value={state.socials[key]}
              onChange={(e) =>
                merge({ socials: { ...state.socials, [key]: e.target.value } })
              }
              maxLength={300}
              placeholder={socialLabels[key]}
              className={`${bsInput} h-10`}
            />
          ))}
        </div>
      </Ctl>
    </Acc>
  );
}
