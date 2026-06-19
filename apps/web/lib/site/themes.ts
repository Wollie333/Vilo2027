// Static theme presets for hosted micro-sites.
//
// A site themes itself independently of the Vilo dashboard via a scoped set of
// `--site-*` CSS variables (injected by <SiteThemeRoot>). Section components and
// chrome read ONLY these vars — never the app's `brand-*` tokens — so each
// tenant site can look completely different without leaking into the app.
//
// The `host_websites.theme` jsonb is { preset, accent?, font?, radius? }. This
// module resolves that config into a palette + font stack + radius and emits the
// CSS-variable object. Pure data — safe to import in server or client.

export type SiteFont = "sans" | "serif" | "elegant" | "grotesk" | "editorial";
export type SiteRadius = "none" | "sm" | "md" | "lg" | "xl";

export type SitePalette = {
  bg: string; // page background
  surface: string; // cards / raised panels
  ink: string; // primary text
  mute: string; // secondary text
  line: string; // borders / dividers
  accent: string; // buttons, links, highlights
  accentInk: string; // text/icon on top of accent
};

export type SitePreset = {
  label: string;
  palette: SitePalette;
  font: SiteFont;
  radius: SiteRadius;
};

export const SITE_PRESETS = {
  classic: {
    label: "Classic",
    palette: {
      bg: "#FBF9F5",
      surface: "#FFFFFF",
      ink: "#2A2622",
      mute: "#7A716A",
      line: "#E9E2D8",
      accent: "#1F6F54",
      accentInk: "#FFFFFF",
    },
    font: "elegant",
    radius: "md",
  },
  modern: {
    label: "Modern",
    palette: {
      bg: "#FFFFFF",
      surface: "#F6F7F9",
      ink: "#11161C",
      mute: "#5C6773",
      line: "#E5E9EE",
      accent: "#1F6FEB",
      accentInk: "#FFFFFF",
    },
    font: "sans",
    radius: "lg",
  },
  coastal: {
    label: "Coastal",
    palette: {
      bg: "#F4FAFC",
      surface: "#FFFFFF",
      ink: "#0E2A33",
      mute: "#5A7A82",
      line: "#D5E8EE",
      accent: "#0E8FB0",
      accentInk: "#FFFFFF",
    },
    font: "sans",
    radius: "xl",
  },
  warm: {
    label: "Warm",
    palette: {
      bg: "#FCF6F1",
      surface: "#FFFFFF",
      ink: "#34201A",
      mute: "#8A6F63",
      line: "#EEDFD4",
      accent: "#C2522E",
      accentInk: "#FFFFFF",
    },
    font: "serif",
    radius: "md",
  },
  minimal: {
    label: "Minimal",
    palette: {
      bg: "#FFFFFF",
      surface: "#FAFAFA",
      ink: "#0A0A0A",
      mute: "#6B6B6B",
      line: "#E6E6E6",
      accent: "#0A0A0A",
      accentInk: "#FFFFFF",
    },
    font: "sans",
    radius: "none",
  },
  nightfall: {
    label: "Nightfall",
    palette: {
      bg: "#0E1116",
      surface: "#171B22",
      ink: "#F3EEE3",
      mute: "#A0A7B2",
      line: "#2A2F38",
      accent: "#CBA653",
      accentInk: "#14110D",
    },
    font: "elegant",
    radius: "md",
  },
} as const;

export type SitePresetKey = keyof typeof SITE_PRESETS;
export const SITE_PRESET_KEYS = Object.keys(SITE_PRESETS) as SitePresetKey[];
export const DEFAULT_PRESET: SitePresetKey = "classic";

const FONT_STACKS: Record<SiteFont, { heading: string; body: string }> = {
  sans: {
    heading:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  serif: {
    heading:
      'Georgia, Cambria, "Times New Roman", "Noto Serif", ui-serif, serif',
    body: 'Georgia, Cambria, "Times New Roman", "Noto Serif", ui-serif, serif',
  },
  elegant: {
    // Serif display headings over a clean sans body — the "boutique" look.
    heading:
      '"Cormorant Garamond", Georgia, Cambria, "Times New Roman", ui-serif, serif',
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  grotesk: {
    // Geometric, slightly characterful sans (system fonts, no web-font load).
    heading:
      '"Trebuchet MS", "Avenir Next", "Segoe UI", Verdana, system-ui, sans-serif',
    body: '"Segoe UI", "Avenir Next", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif',
  },
  editorial: {
    // Classic editorial serif for both heading and body.
    heading:
      '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, "Times New Roman", ui-serif, serif',
    body: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, ui-serif, serif',
  },
};

const RADIUS_REM: Record<SiteRadius, string> = {
  none: "0px",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.875rem",
  xl: "1.25rem",
};

export type SiteButtonStyle = "solid" | "outline";

/** Per-role colour overrides — each blank/absent value inherits the preset. */
export type SiteColors = {
  bg?: string;
  surface?: string;
  ink?: string;
  mute?: string;
  line?: string;
  accent?: string;
  secondary?: string;
};

/** Typography overrides — each absent value falls back to a hard default below. */
export type SiteType = {
  headingFont?: SiteFont;
  bodyFont?: SiteFont;
  headingWeight?: number; // 300..800
  bodyWeight?: number;
  baseSize?: number; // px, 12..22
  scale?: number; // modular ratio, 1.0..1.6
  headingLeading?: number; // unitless, 1.0..2.0
  bodyLeading?: number;
  headingTracking?: number; // em, -0.05..0.1
  bodyTracking?: number;
};

// Hard defaults for the type system (used when neither the override nor the
// preset supplies a value). The preset only owns the font *family*; everything
// else (weights, sizes, leading, tracking) defaults here.
export const TYPE_DEFAULTS = {
  headingWeight: 600,
  bodyWeight: 400,
  baseSize: 16,
  scale: 1.2,
  headingLeading: 1.15,
  bodyLeading: 1.6,
  headingTracking: -0.01,
  bodyTracking: 0,
} as const;

export type SiteThemeConfig = {
  preset?: string;
  colors?: SiteColors;
  palette?: string[]; // saved brand swatches — feed the pickers, not rendered
  type?: SiteType;
  radius?: SiteRadius;
  buttonStyle?: SiteButtonStyle;
  // Legacy flat keys (pre-Brand-Studio dev rows). Read as a fallback so old
  // themes keep rendering without a data migration.
  accent?: string;
  font?: SiteFont;
};

function resolvePreset(key?: string): SitePreset {
  if (key && key in SITE_PRESETS) {
    return SITE_PRESETS[key as SitePresetKey];
  }
  return SITE_PRESETS[DEFAULT_PRESET];
}

const clampNum = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

const px = (n: number) => `${Math.round(n * 10) / 10}px`;

/** Hex accent → readable on-accent text (black/white by luminance). */
export function accentInkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Relative luminance (sRGB, simplified).
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0A0A0A" : "#FFFFFF";
}

/** True when the theme's resolved surface colour is dark (chrome wants a light logo). */
export function siteSurfaceIsDark(
  theme: SiteThemeConfig | null | undefined,
): boolean {
  const preset = resolvePreset(theme?.preset);
  const surface =
    (theme?.colors?.surface || "").trim() || preset.palette.surface;
  return accentInkFor(surface) === "#FFFFFF";
}

/**
 * Resolve a theme config into the scoped `--site-*` CSS variables. Returns a
 * style object to spread onto a wrapping element.
 *
 * Resolution order for every token: explicit override → preset value → hard
 * default. Legacy flat `accent`/`font` keys are read as a final fallback so
 * pre-Brand-Studio dev rows keep rendering.
 */
export function buildSiteVars(
  theme: SiteThemeConfig | null | undefined,
): React.CSSProperties {
  const preset = resolvePreset(theme?.preset);
  const c = theme?.colors ?? {};
  const ty = theme?.type ?? {};

  // --- Colours ---
  const accentOverride = (c.accent || theme?.accent || "").trim();
  const accent = accentOverride || preset.palette.accent;
  const accentInk = accentOverride
    ? accentInkFor(accentOverride)
    : preset.palette.accentInk;

  // Secondary accent has no preset value — default to the primary accent so an
  // un-set secondary is harmless (renders the same as primary).
  const secondary = (c.secondary || "").trim() || accent;
  const secondaryInk = accentInkFor(secondary);

  // --- Typography families ---
  const headingFont = ty.headingFont ?? theme?.font ?? preset.font;
  const bodyFont = ty.bodyFont ?? theme?.font ?? preset.font;
  const headingStack = FONT_STACKS[headingFont].heading;
  const bodyStack = FONT_STACKS[bodyFont].body;

  // --- Typography scale (modular: base × ratio^step) ---
  const base = clampNum(ty.baseSize ?? TYPE_DEFAULTS.baseSize, 12, 22);
  const r = clampNum(ty.scale ?? TYPE_DEFAULTS.scale, 1, 1.6);

  return {
    "--site-bg": c.bg || preset.palette.bg,
    "--site-surface": c.surface || preset.palette.surface,
    "--site-ink": c.ink || preset.palette.ink,
    "--site-mute": c.mute || preset.palette.mute,
    "--site-line": c.line || preset.palette.line,
    "--site-accent": accent,
    "--site-accent-ink": accentInk,
    "--site-secondary": secondary,
    "--site-secondary-ink": secondaryInk,
    "--site-radius": RADIUS_REM[theme?.radius ?? preset.radius],

    "--site-font-heading": headingStack,
    "--site-font-body": bodyStack,
    "--site-weight-heading": String(
      ty.headingWeight ?? TYPE_DEFAULTS.headingWeight,
    ),
    "--site-weight-body": String(ty.bodyWeight ?? TYPE_DEFAULTS.bodyWeight),
    "--site-leading-heading": String(
      ty.headingLeading ?? TYPE_DEFAULTS.headingLeading,
    ),
    "--site-leading-body": String(ty.bodyLeading ?? TYPE_DEFAULTS.bodyLeading),
    "--site-tracking-heading": `${ty.headingTracking ?? TYPE_DEFAULTS.headingTracking}em`,
    "--site-tracking-body": `${ty.bodyTracking ?? TYPE_DEFAULTS.bodyTracking}em`,

    "--site-text-sm": px(base / r),
    "--site-text-base": px(base),
    "--site-h4": px(base * r),
    "--site-h3": px(base * r * r),
    "--site-h2": px(base * r * r * r),
    "--site-h1": px(base * r * r * r * r),
  } as React.CSSProperties;
}

/** The default button fill style for a theme (used by site buttons). */
export function resolveButtonStyle(
  theme: SiteThemeConfig | null | undefined,
): SiteButtonStyle {
  return theme?.buttonStyle === "outline" ? "outline" : "solid";
}
