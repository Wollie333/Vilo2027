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

export type SiteFont = "sans" | "serif" | "elegant";
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
};

const RADIUS_REM: Record<SiteRadius, string> = {
  none: "0px",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.875rem",
  xl: "1.25rem",
};

export type SiteThemeConfig = {
  preset?: string;
  accent?: string;
  font?: SiteFont;
  radius?: SiteRadius;
};

function resolvePreset(key?: string): SitePreset {
  if (key && key in SITE_PRESETS) {
    return SITE_PRESETS[key as SitePresetKey];
  }
  return SITE_PRESETS[DEFAULT_PRESET];
}

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

/**
 * Resolve a theme config into the scoped `--site-*` CSS variables. Returns a
 * style object to spread onto a wrapping element.
 */
export function buildSiteVars(
  theme: SiteThemeConfig | null | undefined,
): React.CSSProperties {
  const preset = resolvePreset(theme?.preset);
  const accent = theme?.accent?.trim() || preset.palette.accent;
  const accentInk =
    theme?.accent && theme.accent.trim()
      ? accentInkFor(theme.accent)
      : preset.palette.accentInk;
  const font = FONT_STACKS[theme?.font ?? preset.font];
  const radius = RADIUS_REM[theme?.radius ?? preset.radius];

  return {
    "--site-bg": preset.palette.bg,
    "--site-surface": preset.palette.surface,
    "--site-ink": preset.palette.ink,
    "--site-mute": preset.palette.mute,
    "--site-line": preset.palette.line,
    "--site-accent": accent,
    "--site-accent-ink": accentInk,
    "--site-radius": radius,
    "--site-font-heading": font.heading,
    "--site-font-body": font.body,
  } as React.CSSProperties;
}
