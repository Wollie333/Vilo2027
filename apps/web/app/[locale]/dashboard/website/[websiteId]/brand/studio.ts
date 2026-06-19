// Brand Studio state model + (de)serialisation helpers. Pure data — shared by the
// client studio shell and its sub-sections. The studio edits the brand (identity
// + logos) and theme (colours + typography + buttons) jsonb together; asset paths
// persist on upload, everything else on Save via `saveBrandStudioAction`.

import {
  TYPE_DEFAULTS,
  type SiteButtonStyle,
  type SiteFont,
  type SitePresetKey,
  type SiteRadius,
  type SiteThemeConfig,
} from "@/lib/site/themes";
import type { SiteBrand, SiteLogoStyle } from "@/lib/site/types";

import type { WebsiteEditorData } from "../loadWebsiteEditorData";
import type { BrandAssetSlot, BrandStudioInput } from "../../schemas";

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
};

export type StudioState = {
  // Identity
  name: string;
  tagline: string;
  logoStyle: SiteLogoStyle;
  logoMaxHeight: number;
  contactEmail: string;
  contactPhone: string;
  socials: Record<SocialKey, string>;
  // Logo/favicon asset URLs (for the preview; paths persist on upload)
  assets: Record<BrandAssetSlot, string | null>;
  // Design
  preset: SitePresetKey;
  colors: StudioColors;
  palette: string[];
  type: StudioType;
  radius: SiteRadius | "";
  buttonStyle: SiteButtonStyle;
};

const PRESET_KEYS: SitePresetKey[] = [
  "classic",
  "modern",
  "coastal",
  "warm",
  "minimal",
  "nightfall",
];
const FONTS: SiteFont[] = ["sans", "serif", "elegant", "grotesk", "editorial"];
const RADII: SiteRadius[] = ["none", "sm", "md", "lg", "xl"];

const asPreset = (v: unknown): SitePresetKey =>
  PRESET_KEYS.includes(v as SitePresetKey) ? (v as SitePresetKey) : "classic";
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

/**
 * Build the studio's working state from the saved brand + theme jsonb. Tolerates
 * legacy flat `theme.accent`/`theme.font` (dev rows) so nothing is lost.
 */
export function deriveStudioState(
  brand: WebsiteEditorData["brand"],
  theme: SiteThemeConfig,
  assetUrls: Record<BrandAssetSlot, string | null>,
): StudioState {
  const c = theme.colors ?? {};
  const ty = theme.type ?? {};
  const legacyFont = asFont(theme.font);

  const socials = Object.fromEntries(
    SOCIAL_KEYS.map((k) => [k, brand.socials?.[k] ?? ""]),
  ) as Record<SocialKey, string>;

  return {
    name: brand.name ?? "",
    tagline: brand.tagline ?? "",
    logoStyle: brand.logo_style ?? "mark",
    logoMaxHeight: num(brand.logo_max_height, 40),
    contactEmail: brand.contact?.email ?? "",
    contactPhone: brand.contact?.phone ?? "",
    socials,
    assets: assetUrls,
    preset: asPreset(theme.preset),
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
    },
    radius: asRadius(theme.radius),
    buttonStyle: theme.buttonStyle === "outline" ? "outline" : "solid",
  };
}

/** Live SiteThemeConfig for the preview (drops blank overrides → inherit preset). */
export function studioThemeConfig(state: StudioState): SiteThemeConfig {
  const colors = Object.fromEntries(
    Object.entries(state.colors).filter(([, v]) => v),
  );
  return {
    preset: state.preset,
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
    },
    radius: state.radius || undefined,
    buttonStyle: state.buttonStyle,
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
    buttonStyle: state.buttonStyle,
  };
}
