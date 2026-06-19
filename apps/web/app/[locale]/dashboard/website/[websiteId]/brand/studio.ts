// Brand Studio state model + (de)serialisation helpers. Pure data — shared by the
// client studio shell and its sub-sections. The studio edits the brand (identity
// + logos) and theme (colours + typography + buttons) jsonb together; asset paths
// persist on upload, everything else on Save via `saveBrandStudioAction`.

import {
  DEFAULT_FOOTER,
  DEFAULT_HEADER,
  SITE_FOOTER_LAYOUTS,
  SITE_HEADER_LAYOUTS,
  TYPE_DEFAULTS,
  type SiteButtonStyle,
  type SiteCardRatio,
  type SiteCardStyle,
  type SiteFont,
  type SiteFooterConfig,
  type SiteHeaderConfig,
  type SiteHeroLayout,
  type SitePreset,
  type SiteRadius,
  type SiteShadow,
  type SiteSocialShape,
  type SiteSocialStyle,
  type SiteThemeConfig,
} from "@/lib/site/themes";
import type { SiteBrand, SiteLogoStyle } from "@/lib/site/types";

import type { WebsiteEditorData } from "../loadWebsiteEditorData";
import {
  SIZE_KEYS,
  type BrandAssetSlot,
  type BrandStudioInput,
  type SizeKey,
} from "../../schemas";

export const SOCIAL_KEYS = [
  "instagram",
  "facebook",
  "x",
  "youtube",
  "linkedin",
  "website",
] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

// Each colour role; "" = inherit the preset.
export type StudioColors = {
  bg: string;
  surface: string;
  ink: string;
  mute: string;
  line: string;
  accent: string;
  secondary: string;
};

// Per-element font sizes (px); null = inherit the modular base × scale.
export type StudioSizes = Record<SizeKey, number | null>;

export type StudioImage = {
  radius: number; // px
  borderWidth: number; // px
  borderColor: string; // "" = inherit the line colour
  shadow: SiteShadow;
};

export type StudioCard = {
  style: SiteCardStyle;
  radius: number; // px
  shadow: SiteShadow;
  ratio: SiteCardRatio;
};

export type StudioSocial = {
  shape: SiteSocialShape;
  style: SiteSocialStyle;
};

// Button config for studio editing (primary + secondary)
export type StudioButtonConfig = {
  style: SiteButtonStyle;
  color: string; // "" = inherit accent
  borderWidth: 1 | 2 | 3;
  pill: boolean;
};

export type StudioButtons = {
  primary: StudioButtonConfig;
  secondary: StudioButtonConfig;
};

export type StudioType = {
  headingFont: SiteFont | ""; // "" = inherit preset family
  bodyFont: SiteFont | "";
  headingWeight: number;
  bodyWeight: number;
  baseSize: number;
  scale: number;
  headingLeading: number;
  bodyLeading: number;
  headingTracking: number;
  bodyTracking: number;
  sizes: StudioSizes;
};

const SHADOWS: SiteShadow[] = ["none", "sm", "md", "lg", "xl"];
const CARD_STYLES: SiteCardStyle[] = ["elevated", "bordered", "flat"];
const CARD_RATIOS: SiteCardRatio[] = ["4:3", "16:9", "1:1", "3:2"];
const SOC_SHAPES: SiteSocialShape[] = ["round", "square"];
const SOC_STYLES: SiteSocialStyle[] = ["filled", "outline", "plain"];
const BTN_STYLES: SiteButtonStyle[] = ["solid", "outline"];
const BTN_WIDTHS = [1, 2, 3] as const;

const oneOf = <T extends string>(list: T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

export type StudioState = {
  // Identity
  name: string;
  tagline: string;
  monogram: string;
  logoStyle: SiteLogoStyle;
  logoMaxHeight: number;
  contactEmail: string;
  contactPhone: string;
  socials: Record<SocialKey, string>;
  // Logo/favicon asset URLs (for the preview; paths persist on upload)
  assets: Record<BrandAssetSlot, string | null>;
  // Design — `preset` is the active theme slug; `base` is its resolved
  // palette/font/radius (from the site_themes catalogue) that overrides layer on.
  preset: string;
  base: SitePreset;
  colors: StudioColors;
  palette: string[];
  type: StudioType;
  radius: SiteRadius | "";
  buttons: StudioButtons;
  image: StudioImage;
  card: StudioCard;
  heroLayout: SiteHeroLayout;
  social: StudioSocial;
  iconColor: string; // "" = inherit accent
  header: SiteHeaderConfig;
  footer: SiteFooterConfig;
};

const FONTS: SiteFont[] = ["sans", "serif", "elegant", "grotesk", "editorial"];
const RADII: SiteRadius[] = ["none", "sm", "md", "lg", "xl"];

const asSlug = (v: unknown): string =>
  typeof v === "string" && v.trim() ? v.trim() : "warm";
const asFont = (v: unknown): SiteFont | "" =>
  FONTS.includes(v as SiteFont) ? (v as SiteFont) : "";
const asRadius = (v: unknown): SiteRadius | "" =>
  RADII.includes(v as SiteRadius) ? (v as SiteRadius) : "";
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const hex = (v: unknown): string =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim())
    ? v.trim().toUpperCase()
    : "";

const EMPTY_COLORS: StudioColors = {
  bg: "",
  surface: "",
  ink: "",
  mute: "",
  line: "",
  accent: "",
  secondary: "",
};

const DEFAULT_BUTTON: StudioButtonConfig = {
  style: "solid",
  color: "",
  borderWidth: 2,
  pill: false,
};

/** Parse a button config from saved theme data. */
function deriveButtonConfig(raw: unknown): StudioButtonConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BUTTON };
  const r = raw as Record<string, unknown>;
  return {
    style: oneOf(BTN_STYLES, r.style, "solid"),
    color: hex(r.color),
    borderWidth: BTN_WIDTHS.includes(r.borderWidth as 1 | 2 | 3)
      ? (r.borderWidth as 1 | 2 | 3)
      : 2,
    pill: r.pill === true,
  };
}

/** Emit a button config for SiteThemeConfig (omits blank color). */
function emitButtonConfig(cfg: StudioButtonConfig) {
  return {
    style: cfg.style,
    color: cfg.color || undefined,
    borderWidth: cfg.borderWidth,
    pill: cfg.pill,
  };
}

/**
 * Build the studio's working state from the saved brand + theme jsonb. Tolerates
 * legacy flat `theme.accent`/`theme.font` (dev rows) so nothing is lost.
 */
export function deriveStudioState(
  brand: WebsiteEditorData["brand"],
  theme: SiteThemeConfig,
  assetUrls: Record<BrandAssetSlot, string | null>,
  base: SitePreset,
): StudioState {
  const c = theme.colors ?? {};
  const ty = theme.type ?? {};
  const legacyFont = asFont(theme.font);

  const sizesIn = (ty.sizes ?? {}) as Record<string, unknown>;
  const sizes = Object.fromEntries(
    SIZE_KEYS.map((k) => [
      k,
      typeof sizesIn[k] === "number" ? (sizesIn[k] as number) : null,
    ]),
  ) as StudioSizes;

  const im = (theme.image ?? {}) as Record<string, unknown>;
  const cd = (theme.card ?? {}) as Record<string, unknown>;
  const so = (theme.social ?? {}) as Record<string, unknown>;
  const hd = (theme.header ?? {}) as Record<string, unknown>;
  const ft = (theme.footer ?? {}) as Record<string, unknown>;

  const socials = Object.fromEntries(
    SOCIAL_KEYS.map((k) => [k, brand.socials?.[k] ?? ""]),
  ) as Record<SocialKey, string>;

  return {
    name: brand.name ?? "",
    tagline: brand.tagline ?? "",
    monogram: (brand.monogram ?? "").slice(0, 2),
    logoStyle: brand.logo_style ?? "mark",
    logoMaxHeight: num(brand.logo_max_height, 40),
    contactEmail: brand.contact?.email ?? "",
    contactPhone: brand.contact?.phone ?? "",
    socials,
    assets: assetUrls,
    preset: asSlug(theme.preset),
    base,
    colors: {
      ...EMPTY_COLORS,
      bg: hex(c.bg),
      surface: hex(c.surface),
      ink: hex(c.ink),
      mute: hex(c.mute),
      line: hex(c.line),
      accent: hex(c.accent) || hex(theme.accent),
      secondary: hex(c.secondary),
    },
    palette: Array.isArray(theme.palette)
      ? theme.palette.map(hex).filter(Boolean)
      : [],
    type: {
      headingFont: asFont(ty.headingFont) || legacyFont,
      bodyFont: asFont(ty.bodyFont) || legacyFont,
      headingWeight: num(ty.headingWeight, TYPE_DEFAULTS.headingWeight),
      bodyWeight: num(ty.bodyWeight, TYPE_DEFAULTS.bodyWeight),
      baseSize: num(ty.baseSize, TYPE_DEFAULTS.baseSize),
      scale: num(ty.scale, TYPE_DEFAULTS.scale),
      headingLeading: num(ty.headingLeading, TYPE_DEFAULTS.headingLeading),
      bodyLeading: num(ty.bodyLeading, TYPE_DEFAULTS.bodyLeading),
      headingTracking: num(ty.headingTracking, TYPE_DEFAULTS.headingTracking),
      bodyTracking: num(ty.bodyTracking, TYPE_DEFAULTS.bodyTracking),
      sizes,
    },
    radius: asRadius(theme.radius),
    buttons: {
      primary: deriveButtonConfig(theme.buttons?.primary),
      secondary: deriveButtonConfig(theme.buttons?.secondary),
    },
    image: {
      radius: num(im.radius, 12),
      borderWidth: num(im.borderWidth, 0),
      borderColor: hex(im.borderColor),
      shadow: oneOf(SHADOWS, im.shadow, "none"),
    },
    card: {
      style: oneOf(CARD_STYLES, cd.style, "elevated"),
      radius: num(cd.radius, 14),
      shadow: oneOf(SHADOWS, cd.shadow, "sm"),
      ratio: oneOf(CARD_RATIOS, cd.ratio, "4:3"),
    },
    heroLayout: theme.heroLayout === "left" ? "left" : "center",
    social: {
      shape: oneOf(SOC_SHAPES, so.shape, "round"),
      style: oneOf(SOC_STYLES, so.style, "plain"),
    },
    iconColor: hex(theme.iconColor),
    header: {
      desktop: oneOf(SITE_HEADER_LAYOUTS, hd.desktop, DEFAULT_HEADER.desktop),
      mobile: oneOf(SITE_HEADER_LAYOUTS, hd.mobile, DEFAULT_HEADER.mobile),
    },
    footer: {
      desktop: oneOf(SITE_FOOTER_LAYOUTS, ft.desktop, DEFAULT_FOOTER.desktop),
      mobile: oneOf(SITE_FOOTER_LAYOUTS, ft.mobile, DEFAULT_FOOTER.mobile),
    },
  };
}

/** Live SiteThemeConfig for the preview (drops blank overrides → inherit preset). */
export function studioThemeConfig(state: StudioState): SiteThemeConfig {
  const colors = Object.fromEntries(
    Object.entries(state.colors).filter(([, v]) => v),
  );
  // Only the pinned per-element sizes (drop nulls → inherit the modular scale).
  const sizes = Object.fromEntries(
    Object.entries(state.type.sizes).filter(([, v]) => typeof v === "number"),
  );
  return {
    preset: state.preset,
    base: state.base,
    colors,
    palette: state.palette,
    type: {
      headingFont: state.type.headingFont || undefined,
      bodyFont: state.type.bodyFont || undefined,
      headingWeight: state.type.headingWeight,
      bodyWeight: state.type.bodyWeight,
      baseSize: state.type.baseSize,
      scale: state.type.scale,
      headingLeading: state.type.headingLeading,
      bodyLeading: state.type.bodyLeading,
      headingTracking: state.type.headingTracking,
      bodyTracking: state.type.bodyTracking,
      sizes,
    },
    radius: state.radius || undefined,
    buttons: {
      primary: emitButtonConfig(state.buttons.primary),
      secondary: emitButtonConfig(state.buttons.secondary),
    },
    image: {
      radius: state.image.radius,
      borderWidth: state.image.borderWidth,
      borderColor: state.image.borderColor || undefined,
      shadow: state.image.shadow,
    },
    card: { ...state.card },
    heroLayout: state.heroLayout,
    social: { ...state.social },
    iconColor: state.iconColor || undefined,
    header: { ...state.header },
    footer: { ...state.footer },
  };
}

/** Live SiteBrand for the preview chrome (reflects unsaved identity + logos). */
export function studioBrand(
  state: StudioState,
  fallbackName: string,
): SiteBrand {
  return {
    name: state.name.trim() || fallbackName,
    tagline: state.tagline.trim() || null,
    monogram: state.monogram.trim() || null,
    logoUrl: state.assets.primary,
    logoLightUrl: state.assets.light,
    logoIconUrl: state.assets.icon,
    faviconUrl: state.assets.favicon,
    appleIconUrl: state.assets.apple,
    logoMaxHeight: state.logoMaxHeight,
    logoStyle: state.logoStyle,
    contactEmail: state.contactEmail.trim() || null,
    contactPhone: state.contactPhone.trim() || null,
    socials: state.socials,
  };
}

/** Flatten the state into the save-action payload. */
export function studioToSaveInput(
  websiteId: string,
  state: StudioState,
): BrandStudioInput {
  return {
    websiteId,
    name: state.name,
    tagline: state.tagline,
    monogram: state.monogram,
    logoStyle: state.logoStyle,
    logoMaxHeight: state.logoMaxHeight,
    contactEmail: state.contactEmail,
    contactPhone: state.contactPhone,
    socials: state.socials,
    preset: state.preset,
    colors: state.colors,
    palette: state.palette,
    type: state.type,
    radius: state.radius,
    buttons: state.buttons,
    image: state.image,
    card: state.card,
    heroLayout: state.heroLayout,
    social: state.social,
    iconColor: state.iconColor,
    header: state.header,
    footer: state.footer,
  };
}
