"use client";

import {
  BadgeCheck,
  Droplet,
  Facebook,
  GalleryVerticalEnd,
  Globe,
  Image as ImageIcon,
  Instagram,
  Linkedin,
  Mail,
  PanelBottom,
  PanelTop,
  Phone,
  RotateCcw,
  Share2,
  SquareMousePointer,
  Type,
  Twitter,
  Youtube,
} from "lucide-react";

import { useTranslations } from "next-intl";

import {
  buildSiteVars,
  modularSizes,
  type SiteButtonStyle,
  type SiteFont,
  type SiteFooterLayout,
  type SiteHeaderLayout,
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
  Divider,
  PreviewBox,
  ResetButton,
  Seg,
  SegControl,
  Slider,
  SliderControl,
  SubGroup,
  SwatchRow,
  bsInput,
  bsSelect,
} from "./_ui";
import {
  SOCIAL_KEYS,
  studioThemeConfig,
  type StudioButtonConfig,
  type StudioButtons,
  type StudioColors,
  type StudioState,
} from "./studio";

export type SectionProps = {
  websiteId: string;
  state: StudioState;
  merge: (patch: Partial<StudioState>) => void;
  fallbackName: string;
};

const FONTS: SiteFont[] = [
  "sans",
  "serif",
  "elegant",
  "grotesk",
  "editorial",
  "homely",
  "archivo",
];

const FONT_SAMPLE: Record<SiteFont, string> = {
  sans: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", ui-serif, serif',
  elegant: '"Cormorant Garamond", Georgia, ui-serif, serif',
  grotesk: '"Trebuchet MS", "Avenir Next", "Segoe UI", Verdana, sans-serif',
  editorial: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
  homely: '"Gloock", "Playfair Display", Georgia, ui-serif, serif',
  archivo:
    '"Archivo", "Arial Narrow", "Helvetica Neue", "Segoe UI", sans-serif',
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
        <CtlLabel hint={t("brandMonogramHint")}>{t("brandMonogram")}</CtlLabel>
        <input
          value={state.monogram}
          onChange={(e) => merge({ monogram: e.target.value.slice(0, 2) })}
          maxLength={2}
          placeholder="KS"
          className={`${bsInput} w-24 text-center font-display text-lg font-extrabold uppercase`}
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
  const base = state.base;
  const setColor = (role: keyof StudioColors, hex: string) =>
    merge({ colors: { ...state.colors, [role]: hex } });

  const inheritedFor = (role: keyof StudioColors): string =>
    role === "secondary"
      ? state.colors.accent || base.palette.accent
      : (base.palette[role as keyof typeof base.palette] as string);

  return (
    <Acc
      icon={<Droplet className="h-[17px] w-[17px]" />}
      title={t("brandColoursTitle")}
      subtitle={t("brandColourSub")}
      defaultOpen
    >
      <Ctl>
        <CtlLabel>{t("brandColourPrimary")}</CtlLabel>
        <SwatchRow
          value={state.colors.accent}
          inheritedHex={base.palette.accent}
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

      <Divider />

      {/* Feature icon colour (merged from Icons section) */}
      <Ctl>
        <CtlLabel>{t("brandIconColour")}</CtlLabel>
        <SwatchRow
          value={state.iconColor}
          inheritedHex={state.colors.accent || base.palette.accent}
          onChange={(hex) => merge({ iconColor: hex })}
        />
      </Ctl>
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
  const defaults = state.defaults.type;
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
      {/* Fonts */}
      <SubGroup title={t("typeFonts")}>
        <Ctl>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-brand-mute">
              {t("brandHeadingFontTitle")}
            </span>
            <ResetButton
              isOverridden={ty.headingFont !== ""}
              onReset={() => setType({ headingFont: "" })}
            />
          </div>
          <FontSelect
            value={ty.headingFont}
            onChange={(v) => setType({ headingFont: v })}
          />
        </Ctl>
        <Ctl>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-brand-mute">
              {t("brandBodyFontTitle")}
            </span>
            <ResetButton
              isOverridden={ty.bodyFont !== ""}
              onReset={() => setType({ bodyFont: "" })}
            />
          </div>
          <FontSelect
            value={ty.bodyFont}
            onChange={(v) => setType({ bodyFont: v })}
          />
        </Ctl>
      </SubGroup>

      {/* Scale & Metrics */}
      <SubGroup title={t("typeScale")}>
        <SliderControl
          label={t("brandBaseSize")}
          value={ty.baseSize}
          defaultValue={defaults.baseSize}
          min={12}
          max={22}
          suffix="px"
          onChange={(v) => setType({ baseSize: v })}
        />
        <SliderControl
          label={t("brandScale")}
          value={ty.scale}
          defaultValue={defaults.scale}
          min={1}
          max={1.6}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => setType({ scale: v })}
        />
        <SliderControl
          label={t("brandLineHeight")}
          value={ty.bodyLeading}
          defaultValue={defaults.bodyLeading}
          min={1}
          max={2}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => setType({ bodyLeading: v })}
        />
        <SliderControl
          label={t("brandLetterSpacing")}
          value={ty.headingTracking}
          defaultValue={defaults.headingTracking}
          min={-0.05}
          max={0.1}
          step={0.005}
          suffix="em"
          format={(v) => v.toFixed(3)}
          onChange={(v) => setType({ headingTracking: v })}
        />
      </SubGroup>

      {/* Weights */}
      <SubGroup title={t("typeWeights")}>
        <SliderControl
          label={t("brandHeadingWeight")}
          value={ty.headingWeight}
          defaultValue={defaults.headingWeight}
          min={300}
          max={800}
          step={100}
          onChange={(v) => setType({ headingWeight: v })}
        />
        <SliderControl
          label={t("brandBodyWeight")}
          value={ty.bodyWeight}
          defaultValue={defaults.bodyWeight}
          min={300}
          max={700}
          step={100}
          onChange={(v) => setType({ bodyWeight: v })}
        />
      </SubGroup>

      {/* Size Overrides (collapsed by default) */}
      <SubGroup title={t("brandSizesTitle")} defaultOpen={false}>
        <div className="space-y-2.5 pl-1">
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
      </SubGroup>

      {/* Live Preview */}
      <PreviewBox vars={{ ...vars, background: "var(--site-bg)" }}>
        <div className="w-full">
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
      </PreviewBox>
    </Acc>
  );
}

// ── Buttons & corners ─────────────────────────────────────
const BORDER_WIDTHS = [
  { value: "1", label: "1px" },
  { value: "2", label: "2px" },
  { value: "3", label: "3px" },
];

function ButtonVariantControls({
  label,
  cfg,
  onChange,
  presetAccent,
  t,
  defaultOpen = true,
}: {
  label: string;
  cfg: StudioButtonConfig;
  onChange: (patch: Partial<StudioButtonConfig>) => void;
  presetAccent: string;
  t: ReturnType<typeof useTranslations<"website">>;
  defaultOpen?: boolean;
}) {
  return (
    <SubGroup title={label} defaultOpen={defaultOpen}>
      <Ctl>
        <CtlLabel>{t("btnStyle")}</CtlLabel>
        <Seg
          value={cfg.style}
          options={[
            { value: "solid", label: t("brandButtonSolid") },
            { value: "outline", label: t("brandButtonOutline") },
          ]}
          onChange={(v) => onChange({ style: v as SiteButtonStyle })}
        />
      </Ctl>

      <Ctl>
        <CtlLabel>{t("btnColor")}</CtlLabel>
        <SwatchRow
          value={cfg.color}
          inheritedHex={presetAccent}
          onChange={(hex) => onChange({ color: hex })}
        />
      </Ctl>

      {cfg.style === "outline" && (
        <Ctl>
          <CtlLabel>{t("btnBorderWidth")}</CtlLabel>
          <Seg
            value={String(cfg.borderWidth)}
            options={BORDER_WIDTHS}
            onChange={(v) => onChange({ borderWidth: Number(v) as 1 | 2 | 3 })}
          />
        </Ctl>
      )}

      <Ctl>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={cfg.pill}
            onChange={(e) => onChange({ pill: e.target.checked })}
            className="h-4 w-4 rounded border-brand-line accent-brand-primary"
          />
          <span className="text-[12px] text-brand-mute">
            {t("btnPillHint")}
          </span>
        </label>
      </Ctl>
    </SubGroup>
  );
}

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

  const presetAccent = state.base.palette.accent;
  const presetSecondary = state.colors.secondary || presetAccent;

  const setBtn = (
    variant: keyof StudioButtons,
    patch: Partial<StudioButtonConfig>,
  ) =>
    merge({
      buttons: {
        ...state.buttons,
        [variant]: { ...state.buttons[variant], ...patch },
      },
    });

  return (
    <Acc
      icon={<SquareMousePointer className="h-[17px] w-[17px]" />}
      title={t("brandButtonsTitle")}
      subtitle={t("brandButtonsSub")}
    >
      {/* Live preview */}
      <PreviewBox vars={buildSiteVars(studioThemeConfig(state))}>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              background: "var(--site-btn-primary-bg)",
              color: "var(--site-btn-primary-color)",
              border: "var(--site-btn-primary-border)",
              borderRadius: "var(--site-btn-primary-radius)",
            }}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            {t("btnPreviewPrimary")}
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              background: "var(--site-btn-secondary-bg)",
              color: "var(--site-btn-secondary-color)",
              border: "var(--site-btn-secondary-border)",
              borderRadius: "var(--site-btn-secondary-radius)",
            }}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            {t("btnPreviewSecondary")}
          </a>
        </div>
      </PreviewBox>

      {/* Site-wide corner radius */}
      <SegControl
        label={t("themeCornersLabel")}
        value={state.radius}
        defaultValue=""
        options={radiusOpts}
        onChange={(v) => merge({ radius: v })}
      />

      <Divider />

      {/* Primary button */}
      <ButtonVariantControls
        label={t("btnPrimaryHeading")}
        cfg={state.buttons.primary}
        onChange={(patch) => setBtn("primary", patch)}
        presetAccent={presetAccent}
        t={t}
      />

      {/* Secondary button */}
      <ButtonVariantControls
        label={t("btnSecondaryHeading")}
        cfg={state.buttons.secondary}
        onChange={(patch) => setBtn("secondary", patch)}
        presetAccent={presetSecondary}
        t={t}
        defaultOpen={false}
      />
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
  const defaults = state.defaults.image;
  const presetLine = state.base.palette.line;
  const setImg = (patch: Partial<StudioState["image"]>) =>
    merge({ image: { ...img, ...patch } });

  return (
    <Acc
      icon={<ImageIcon className="h-[17px] w-[17px]" />}
      title={t("brandImagesTitle")}
      subtitle={t("brandImagesSub")}
    >
      {/* Live preview */}
      <PreviewBox vars={buildSiteVars(studioThemeConfig(state))}>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://picsum.photos/seed/wielo-imgstyle/480/320"
            alt=""
            style={siteImageStyle}
            className="h-28 w-44 object-cover"
          />
        </div>
      </PreviewBox>

      <SliderControl
        label={t("brandImageRadius")}
        value={img.radius}
        defaultValue={defaults.radius}
        min={0}
        max={48}
        suffix="px"
        onChange={(v) => setImg({ radius: v })}
      />
      <SliderControl
        label={t("brandImageBorderWidth")}
        value={img.borderWidth}
        defaultValue={defaults.borderWidth}
        min={0}
        max={12}
        suffix="px"
        onChange={(v) => setImg({ borderWidth: v })}
      />
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
      <SegControl
        label={t("brandImageShadow")}
        value={img.shadow}
        defaultValue={defaults.shadow}
        options={SHADOW_OPTS.map((o) => ({
          value: o.value,
          label: t(o.labelKey),
        }))}
        onChange={(v) => setImg({ shadow: v })}
      />
    </Acc>
  );
}

// ── Social channels ───────────────────────────────────────
const SOCIAL_ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  x: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  website: Globe,
} as const;

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
      {/* Style controls at top (most important visual choice) */}
      <SegControl
        label={t("brandSocialStyle")}
        value={state.social.style}
        defaultValue={state.defaults.social.style}
        options={[
          { value: "plain", label: t("socialStylePlain") },
          { value: "filled", label: t("socialStyleFilled") },
          { value: "outline", label: t("socialStyleOutline") },
        ]}
        onChange={(v) => merge({ social: { ...state.social, style: v } })}
      />
      <SegControl
        label={t("brandSocialShape")}
        value={state.social.shape}
        defaultValue={state.defaults.social.shape}
        options={[
          { value: "round", label: t("socialShapeRound") },
          { value: "square", label: t("socialShapeSquare") },
        ]}
        onChange={(v) => merge({ social: { ...state.social, shape: v } })}
      />

      <Divider />

      {/* Contact info section */}
      <Ctl>
        <CtlLabel>{t("contactInfoLabel")}</CtlLabel>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light">
              <Mail className="h-4 w-4 text-brand-mute" />
            </span>
            <input
              type="email"
              value={state.contactEmail}
              onChange={(e) => merge({ contactEmail: e.target.value })}
              placeholder={t("contactEmailLabel")}
              maxLength={160}
              className={`${bsInput} flex-1`}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light">
              <Phone className="h-4 w-4 text-brand-mute" />
            </span>
            <input
              value={state.contactPhone}
              onChange={(e) => merge({ contactPhone: e.target.value })}
              placeholder={t("contactPhoneLabel")}
              maxLength={60}
              className={`${bsInput} flex-1`}
            />
          </div>
        </div>
      </Ctl>

      <Divider />

      {/* Social links grid with icons */}
      <Ctl>
        <CtlLabel hint={t("brandSocialHint")}>{t("socialsLabel")}</CtlLabel>
        <div className="space-y-2">
          {SOCIAL_KEYS.map((key) => {
            const Icon = SOCIAL_ICONS[key];
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light">
                  <Icon className="h-4 w-4 text-brand-mute" />
                </span>
                <input
                  value={state.socials[key]}
                  onChange={(e) =>
                    merge({
                      socials: { ...state.socials, [key]: e.target.value },
                    })
                  }
                  maxLength={300}
                  placeholder={socialLabels[key]}
                  className={`${bsInput} flex-1`}
                />
              </div>
            );
          })}
        </div>
      </Ctl>
    </Acc>
  );
}

// ── Room / listing cards ──────────────────────────────────
const RATIO_OPTS = ["4:3", "16:9", "1:1", "3:2"] as const;
const RATIO_PADDING: Record<string, string> = {
  "4:3": "75%",
  "16:9": "56.25%",
  "1:1": "100%",
  "3:2": "66.67%",
};
const SHADOW_VALUES: Record<SiteShadow, string> = {
  none: "none",
  sm: "0 1px 2px rgba(0,0,0,0.05)",
  md: "0 4px 6px -1px rgba(0,0,0,0.1)",
  lg: "0 10px 15px -3px rgba(0,0,0,0.1)",
  xl: "0 20px 25px -5px rgba(0,0,0,0.1)",
};

export function CardsSection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const card = state.card;
  const defaults = state.defaults.card;
  const presetLine = state.base.palette.line;
  const setCard = (patch: Partial<StudioState["card"]>) =>
    merge({ card: { ...card, ...patch } });

  // Compute card styles for preview
  const cardBg = card.style === "elevated" ? "#fff" : "transparent";
  const borderColor = card.borderColor || presetLine;
  const cardBorder =
    card.style === "bordered" ? `1px solid ${borderColor}` : "none";
  const cardShadow =
    card.style === "elevated" ? SHADOW_VALUES[card.shadow] : "none";

  return (
    <Acc
      icon={<GalleryVerticalEnd className="h-[17px] w-[17px]" />}
      title={t("brandCardsTitle")}
      subtitle={t("brandCardsSub")}
    >
      {/* Live card preview */}
      <PreviewBox vars={{ background: "#f8f9fa" }}>
        <div className="flex justify-center">
          <div
            style={{
              width: 180,
              background: cardBg,
              border: cardBorder,
              boxShadow: cardShadow,
              borderRadius: card.radius,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                paddingBottom: RATIO_PADDING[card.ratio],
                background: "linear-gradient(135deg, #ddd 0%, #bbb 100%)",
                position: "relative",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-white/60" />
              </div>
            </div>
            <div className="p-3">
              <div className="text-sm font-semibold text-gray-800">
                Room Title
              </div>
              <div className="text-xs text-gray-500">R1,200 / night</div>
            </div>
          </div>
        </div>
      </PreviewBox>

      <SegControl
        label={t("brandCardStyle")}
        value={card.style}
        defaultValue={defaults.style}
        options={[
          { value: "elevated", label: t("cardStyleElevated") },
          { value: "bordered", label: t("cardStyleBordered") },
          { value: "flat", label: t("cardStyleFlat") },
        ]}
        onChange={(v) => setCard({ style: v })}
      />

      <SliderControl
        label={t("brandCardRadius")}
        value={card.radius}
        defaultValue={defaults.radius}
        min={0}
        max={40}
        suffix="px"
        onChange={(v) => setCard({ radius: v })}
      />

      {/* Border color - only for bordered style */}
      {card.style === "bordered" && (
        <Ctl>
          <CtlLabel>{t("brandCardBorderColor")}</CtlLabel>
          <SwatchRow
            value={card.borderColor}
            inheritedHex={presetLine}
            onChange={(hex) => setCard({ borderColor: hex })}
          />
        </Ctl>
      )}

      {/* Shadow - only for elevated style */}
      {card.style === "elevated" && (
        <SegControl
          label={t("brandCardShadow")}
          value={card.shadow}
          defaultValue={defaults.shadow}
          options={SHADOW_OPTS.map((o) => ({
            value: o.value,
            label: t(o.labelKey),
          }))}
          onChange={(v) => setCard({ shadow: v })}
        />
      )}

      <SegControl
        label={t("brandCardRatio")}
        value={card.ratio}
        defaultValue={defaults.ratio}
        options={RATIO_OPTS.map((r) => ({ value: r, label: r }))}
        onChange={(v) => setCard({ ratio: v })}
      />
    </Acc>
  );
}

// ── Header layout (desktop + mobile) ──────────────────────
const HEADER_OPTS: Array<{ value: SiteHeaderLayout; labelKey: string }> = [
  { value: "classic", labelKey: "headerClassic" },
  { value: "centered", labelKey: "headerCentered" },
  { value: "minimal", labelKey: "headerMinimal" },
];

export function HeaderSection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const headerDefaults = state.defaults.header;
  const heroDefault = state.defaults.heroLayout;
  const setHeader = (patch: Partial<StudioState["header"]>) =>
    merge({ header: { ...state.header, ...patch } });
  const opts = HEADER_OPTS.map((o) => ({
    value: o.value,
    label: t(o.labelKey),
  }));
  return (
    <Acc
      icon={<PanelTop className="h-[17px] w-[17px]" />}
      title={t("brandHeaderTitle")}
      subtitle={t("brandHeaderSub")}
    >
      {/* Hero layout (merged from Homepage section) */}
      <SegControl
        label={t("brandHeroLayout")}
        value={state.heroLayout}
        defaultValue={heroDefault}
        options={[
          { value: "center", label: t("heroCenter") },
          { value: "left", label: t("heroLeft") },
        ]}
        onChange={(v) => merge({ heroLayout: v })}
      />

      <Divider />

      <SegControl
        label={t("layoutDesktop")}
        value={state.header.desktop}
        defaultValue={headerDefaults.desktop}
        options={opts}
        onChange={(v) => setHeader({ desktop: v })}
      />
      <SegControl
        label={t("layoutMobile")}
        value={state.header.mobile}
        defaultValue={headerDefaults.mobile}
        options={opts}
        onChange={(v) => setHeader({ mobile: v })}
      />
    </Acc>
  );
}

// ── Footer layout (desktop + mobile) ──────────────────────
const FOOTER_OPTS: Array<{ value: SiteFooterLayout; labelKey: string }> = [
  { value: "centered", labelKey: "footerCentered" },
  { value: "columns", labelKey: "footerColumns" },
  { value: "simple", labelKey: "footerSimple" },
];

export function FooterSection({ state, merge }: SectionProps) {
  const t = useTranslations("website");
  const defaults = state.defaults.footer;
  const setFooter = (patch: Partial<StudioState["footer"]>) =>
    merge({ footer: { ...state.footer, ...patch } });
  const opts = FOOTER_OPTS.map((o) => ({
    value: o.value,
    label: t(o.labelKey),
  }));
  return (
    <Acc
      icon={<PanelBottom className="h-[17px] w-[17px]" />}
      title={t("brandFooterTitle")}
      subtitle={t("brandFooterSub")}
    >
      <SegControl
        label={t("layoutDesktop")}
        value={state.footer.desktop}
        defaultValue={defaults.desktop}
        options={opts}
        onChange={(v) => setFooter({ desktop: v })}
      />
      <SegControl
        label={t("layoutMobile")}
        value={state.footer.mobile}
        defaultValue={defaults.mobile}
        options={opts}
        onChange={(v) => setFooter({ mobile: v })}
      />
    </Acc>
  );
}
