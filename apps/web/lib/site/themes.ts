// Static theme presets for hosted micro-sites.
//
// A site themes itself independently of the Wielo dashboard via a scoped set of
// `--site-*` CSS variables (injected by <SiteThemeRoot>). Section components and
// chrome read ONLY these vars — never the app's `brand-*` tokens — so each
// tenant site can look completely different without leaking into the app.
//
// The `host_websites.theme` jsonb is { preset, accent?, font?, radius? }. This
// module resolves that config into a palette + font stack + radius and emits the
// CSS-variable object. Pure data — safe to import in server or client.

export type SiteFont =
  | "sans"
  | "serif"
  | "elegant"
  | "grotesk"
  | "editorial"
  | "homely"
  | "archivo"
  | "fraunces";
export type SiteRadius = "none" | "sm" | "md" | "lg" | "xl";

export type SitePalette = {
  bg: string; // page background
  surface: string; // cards / raised panels
  ink: string; // primary text
  mute: string; // secondary text
  line: string; // borders / dividers
  accent: string; // buttons, links, highlights
  accentInk: string; // text/icon on top of accent
  secondary?: string; // optional secondary/accent-2 (themes that ship one)
};

export type SitePreset = {
  label: string;
  palette: SitePalette;
  font: SiteFont;
  radius: SiteRadius;
};

// Production themes: warm (default) + coastal. The DB (site_themes) is the
// source of truth after the two_themes migration; these are kept as a defensive
// fallback in case the DB is unavailable.
export const SITE_PRESETS = {
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
  // Safari — unfenced wilderness lodge. Warm bone/sand ground, espresso ink,
  // savanna-ochre accent; warm editorial soft-serif display (Fraunces — its OWN
  // face, distinct from Sabela's Cormorant so the two lodges don't share a
  // typeface, Phase C), near-sharp corners.
  safari: {
    label: "Safari",
    palette: {
      bg: "#F4EDE0",
      surface: "#FBF6EC",
      ink: "#221A11",
      mute: "#6E6048",
      line: "#DBCFB8",
      accent: "#B26C2E",
      accentInk: "#FFFFFF",
    },
    font: "fraunces",
    radius: "sm",
  },
  // Oceans View — bright Mediterranean beach resort. Airy white ground, deep
  // teal-navy ink, aqua accent; bold grotesk display, soft rounded corners.
  // Fallback for when the DB theme base is unavailable (else it collapses to
  // "warm"); the coral secondary + navy bands come from the .wielo-oceansview skin.
  oceansview: {
    label: "Oceans View",
    palette: {
      bg: "#FFFFFF",
      surface: "#FFFFFF",
      ink: "#0E2C3A",
      mute: "#5E7884",
      line: "#E9E1D1",
      accent: "#12A5B5",
      accentInk: "#FFFFFF",
      secondary: "#FF6B57", // coral — the reference's conversion-CTA colour
    },
    font: "grotesk",
    radius: "lg",
  },
  // Hotel — dark-first editorial safari lodge (Ebony default). Deep ebony
  // ground, warm-bone ink, brand-gold accent; editorial serif display, sharp
  // corners. Fallback for when the DB theme base is unavailable (else it
  // collapses to "warm", the wrong palette); the dark bands + gold details come
  // from the .wielo-hotel skin.
  hotel: {
    label: "Hotel",
    palette: {
      bg: "#14120D",
      surface: "#1C1913",
      ink: "#F1EADB",
      mute: "#A99B7F",
      line: "#2B2618",
      accent: "#C9A24A",
      accentInk: "#15120B",
    },
    font: "elegant",
    radius: "sm",
  },
  // Marmalade House — warm guesthouse "postcards". Butter-cream ground, warm
  // near-black ink, marmalade accent; display serif headings, soft corners.
  // Fallback for when the DB theme base is unavailable (else it collapses to
  // "warm"); the berry secondary + postcard treatment come from the
  // .wielo-marmalade skin.
  marmalade: {
    label: "Marmalade House",
    palette: {
      bg: "#F4ECDB",
      surface: "#FFFFFF",
      ink: "#2C2620",
      mute: "#6F6354",
      line: "#E4D6BE",
      accent: "#C8702E",
      accentInk: "#FFFFFF",
      secondary: "#9C3B52", // berry — the reference's stamp/seal + secondary CTA
    },
    // "homely" = Gloock display heading + Karla body (the reference's fonts);
    // plain "serif" fell back to Georgia, losing the Gloock postcard voice.
    font: "homely",
    radius: "lg",
  },
  // Royal Hotel — clean contemporary GRAND HOTEL. White ground, warm-charcoal
  // ink, a single champagne-gold accent + espresso secondary; tight modern
  // grotesk display, refined small corners + generous whitespace. Reuses the
  // OceansView page layout re-skinned via `.wielo-royal` (its own palette makes
  // it read as urban luxury, not a beach resort). Fallback when the DB base is
  // unavailable (else it collapses to "warm", the wrong palette).
  royal: {
    label: "Royal Hotel",
    palette: {
      bg: "#FFFFFF",
      surface: "#FFFFFF",
      ink: "#1B1915",
      mute: "#6B655B",
      line: "#E7E1D6",
      accent: "#B08948", // champagne gold
      accentInk: "#FFFFFF",
      secondary: "#23201B", // espresso — tags, "Book" CTA, quote marks
    },
    // Archivo — the reference's own grand-hotel face (geometric, authoritative),
    // over a Manrope body. Its bespoke `.rhome` layout (Phase B) reads as a grand
    // hotel, not the OceansView resort.
    font: "archivo",
    // Refined small corners (~8px) vs Oceans View's chunky "lg"; the .wielo-royal
    // skin sets the exact per-element radii (12px cards, 6px buttons, 10px img).
    radius: "md",
  },
} as const;

export type SitePresetKey = keyof typeof SITE_PRESETS;
export const SITE_PRESET_KEYS = Object.keys(SITE_PRESETS) as SitePresetKey[];
export const DEFAULT_PRESET: SitePresetKey = "warm";

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
    // Bold grotesque display + a clean geometric body. Leads with the web fonts
    // a theme shell may load (Bricolage Grotesque / Manrope — e.g. Oceans View),
    // falling back to characterful system sans on themes that don't load them.
    heading:
      '"Bricolage Grotesque", "Archivo", "Trebuchet MS", "Avenir Next", "Segoe UI", Verdana, system-ui, sans-serif',
    body: '"Manrope", "Segoe UI", "Avenir Next", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif',
  },
  editorial: {
    // Classic editorial serif for both heading and body.
    heading:
      '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, "Times New Roman", ui-serif, serif',
    body: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, ui-serif, serif',
  },
  homely: {
    // Chunky display serif over a warm humanist sans — the "guesthouse postcard"
    // look. Leads with the web fonts the theme shell loads (Gloock / Karla —
    // e.g. Marmalade House), falling back to characterful serif/sans elsewhere.
    heading:
      '"Gloock", "Playfair Display", Georgia, Cambria, "Times New Roman", ui-serif, serif',
    body: '"Karla", "Segoe UI", "Avenir Next", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif',
  },
  archivo: {
    // The grand-hotel face — Archivo (geometric, authoritative display) over a
    // Manrope body. The web fonts are loaded by SiteFontLinks for the `royal`
    // theme; falls back to a clean grotesque system stack otherwise.
    heading:
      '"Archivo", "Arial Narrow", "Helvetica Neue", "Segoe UI", system-ui, sans-serif',
    body: '"Manrope", "Segoe UI", "Avenir Next", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif',
  },
  fraunces: {
    // The savanna-lodge face — Fraunces (a warm, characterful editorial soft-
    // serif with optical sizing) over a clean humanist sans body. Loaded by
    // SiteFontLinks for the `safari` theme; deliberately DIFFERENT from the
    // `elegant` Cormorant Garamond that Sabela (hotel) uses, so the two
    // warm-earth lodges no longer share a display typeface (Phase C).
    heading:
      '"Fraunces", "Fraunces 72", Georgia, Cambria, "Times New Roman", ui-serif, serif',
    body: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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

/** Per-button customization — style, color override, border width, pill shape. */
export type SiteButtonConfig = {
  style?: SiteButtonStyle; // fill style (default: solid for primary, outline for secondary)
  color?: string; // hex override (default: accent for primary, secondary for secondary)
  borderWidth?: 1 | 2 | 3; // pixels (outline only)
  pill?: boolean; // full radius override
};

/** Primary and secondary button configuration. */
export type SiteButtonsConfig = {
  primary?: SiteButtonConfig;
  secondary?: SiteButtonConfig;
};

// Image styling (Brand Studio "Images" section) — applied to standalone site
// images (gallery, host photo, property hero) via `--site-img-*`. `radius`
// absent ⇒ inherit the theme corner radius; `borderWidth` 0/absent ⇒ no border;
// `borderColor` absent ⇒ the theme line colour; `shadow` is a named preset.
export type SiteShadow = "none" | "sm" | "md" | "lg" | "xl";

export type SiteImageStyle = {
  radius?: number; // px
  borderWidth?: number; // px
  borderColor?: string; // hex
  shadow?: SiteShadow;
};

export const SITE_SHADOWS: Record<SiteShadow, string> = {
  none: "none",
  sm: "0 1px 2px rgba(16,24,40,0.06), 0 1px 1px rgba(16,24,40,0.04)",
  md: "0 6px 16px rgba(16,24,40,0.10)",
  lg: "0 14px 32px rgba(16,24,40,0.14)",
  xl: "0 26px 56px rgba(16,24,40,0.20)",
};

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

/**
 * Per-element font-size overrides (px). Each absent value falls back to the
 * modular scale derived from `baseSize` × `scale`, so a host can either drive
 * everything from base+ratio OR pin an exact size per element.
 */
export type SiteTypeSizes = {
  h1?: number;
  h2?: number;
  h3?: number;
  h4?: number;
  h5?: number;
  h6?: number;
  body?: number;
  accent?: number; // small / eyebrow / label text
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
  sizes?: SiteTypeSizes; // per-element px overrides (absent ⇒ modular default)
};

/** Modular-scale font sizes (px) derived from base + ratio. SSOT for defaults. */
export function modularSizes(
  base: number,
  ratio: number,
): Record<keyof SiteTypeSizes, number> {
  const r = ratio;
  return {
    h1: base * r * r * r * r,
    h2: base * r * r * r,
    h3: base * r * r,
    h4: base * r,
    h5: base * Math.sqrt(r),
    h6: base,
    body: base,
    accent: base / r,
  };
}

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

// ── Stage 2 controls: cards, hero layout, social, feature icons ──
export type SiteCardStyle = "elevated" | "bordered" | "flat";
export type SiteCardRatio = "4:3" | "16:9" | "1:1" | "3:2";
export type SiteHeroLayout = "center" | "left";
export type SiteSocialShape = "round" | "square";
export type SiteSocialStyle = "filled" | "outline" | "plain";

export type SiteCard = {
  style?: SiteCardStyle;
  radius?: number; // px; absent ⇒ inherit --site-radius
  shadow?: SiteShadow;
  ratio?: SiteCardRatio;
  borderColor?: string; // hex; absent ⇒ inherit line color
};
export type SiteSocial = { shape?: SiteSocialShape; style?: SiteSocialStyle };

// Header & footer layout variants (Phase 5.5) — selectable per theme, with
// separate desktop + mobile choices. Structural (read by SiteChrome), not vars.
export type SiteHeaderLayout = "classic" | "centered" | "split" | "minimal";
export type SiteFooterLayout = "centered" | "columns" | "simple";
export type SiteChromeLayout<T> = { desktop: T; mobile: T };
export type SiteHeaderConfig = SiteChromeLayout<SiteHeaderLayout>;
export type SiteFooterConfig = SiteChromeLayout<SiteFooterLayout>;

export const SITE_HEADER_LAYOUTS: SiteHeaderLayout[] = [
  "classic",
  "centered",
  "split",
  "minimal",
];
export const SITE_FOOTER_LAYOUTS: SiteFooterLayout[] = [
  "centered",
  "columns",
  "simple",
];
export const DEFAULT_HEADER: SiteHeaderConfig = {
  desktop: "classic",
  mobile: "minimal",
};
export const DEFAULT_FOOTER: SiteFooterConfig = {
  desktop: "centered",
  mobile: "centered",
};

const CARD_RATIO: Record<SiteCardRatio, string> = {
  "4:3": "4 / 3",
  "16:9": "16 / 9",
  "1:1": "1 / 1",
  "3:2": "3 / 2",
};

export type SiteThemeConfig = {
  preset?: string;
  /**
   * Resolved theme base (palette/font/radius), copied from the selected
   * site_themes record. When present it supersedes the hardcoded SITE_PRESETS
   * lookup — keeping buildSiteVars pure while themes live in the DB.
   */
  base?: SitePreset;
  colors?: SiteColors;
  palette?: string[]; // saved brand swatches — feed the pickers, not rendered
  type?: SiteType;
  radius?: SiteRadius;
  buttonStyle?: SiteButtonStyle; // legacy single-style fallback
  buttons?: SiteButtonsConfig; // primary + secondary button config
  image?: SiteImageStyle;
  card?: SiteCard;
  heroLayout?: SiteHeroLayout;
  social?: SiteSocial;
  iconColor?: string; // feature-icon colour; absent ⇒ accent
  /** Content link styling (body/prose links; NOT the header menu or buttons). */
  links?: { color?: string; hoverColor?: string };
  header?: SiteHeaderConfig; // header layout (desktop + mobile)
  footer?: SiteFooterConfig; // footer layout (desktop + mobile)
  // Legacy flat keys (pre-Brand-Studio dev rows). Read as a fallback so old
  // themes keep rendering without a data migration.
  accent?: string;
  font?: SiteFont;
};

/**
 * The active theme's colours as a flat swatch list — the preset circles every
 * builder colour picker shows (Business Principle #6: host-site pickers offer the
 * ACTIVE THEME's palette). Order: the host's saved brand swatches (Brand Studio),
 * then the resolved palette roles, then white/black. Deduped (case-insensitive),
 * capped so the popover stays compact.
 */
export function themeSwatches(theme?: SiteThemeConfig): string[] {
  const p = theme?.base?.palette;
  const c = theme?.colors;
  const raw = [
    ...(theme?.palette ?? []),
    c?.accent ?? p?.accent,
    c?.ink ?? p?.ink,
    c?.surface ?? p?.surface,
    c?.bg ?? p?.bg,
    c?.line ?? p?.line,
    c?.secondary ?? p?.secondary,
    p?.accentInk,
    "#FFFFFF",
    "#000000",
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const val = typeof v === "string" ? v.trim() : "";
    if (!val) continue;
    const k = val.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(val);
    if (out.length >= 12) break;
  }
  return out;
}

function resolvePreset(key?: string): SitePreset {
  if (key && key in SITE_PRESETS) {
    return SITE_PRESETS[key as SitePresetKey];
  }
  return SITE_PRESETS[DEFAULT_PRESET];
}

/**
 * The effective heading + body {@link SiteFont} keys for a theme — the SAME
 * resolution `buildSiteVars` uses (type override → theme.font → preset.font).
 * Used by `<SiteFontLinks>` to load the right web fonts on the public site so a
 * themed page renders its display font (e.g. Safari's Cormorant Garamond) instead
 * of a system fallback.
 */
export function themeFontKeys(theme: SiteThemeConfig | null | undefined): {
  heading: SiteFont;
  body: SiteFont;
} {
  const preset = theme?.base ?? resolvePreset(theme?.preset);
  const ty = theme?.type ?? {};
  return {
    heading: ty.headingFont ?? theme?.font ?? preset.font,
    body: ty.bodyFont ?? theme?.font ?? preset.font,
  };
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
  const preset = theme?.base ?? resolvePreset(theme?.preset);
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
  const preset = theme?.base ?? resolvePreset(theme?.preset);
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
  const secondary =
    (c.secondary || "").trim() || preset.palette.secondary || accent;
  const secondaryInk = accentInkFor(secondary);

  // --- Typography families ---
  const headingFont = ty.headingFont ?? theme?.font ?? preset.font;
  const bodyFont = ty.bodyFont ?? theme?.font ?? preset.font;
  const headingStack = FONT_STACKS[headingFont].heading;
  const bodyStack = FONT_STACKS[bodyFont].body;

  // --- Typography scale (modular base × ratio^step + per-element overrides) ---
  const base = clampNum(ty.baseSize ?? TYPE_DEFAULTS.baseSize, 12, 22);
  const r = clampNum(ty.scale ?? TYPE_DEFAULTS.scale, 1, 1.6);
  const derived = modularSizes(base, r);
  const sz = ty.sizes ?? {};
  const size = (k: keyof SiteTypeSizes) =>
    px(typeof sz[k] === "number" ? (sz[k] as number) : derived[k]);
  // Mobile-first headings: when a heading has NO per-element px override, emit a
  // fluid clamp (linear interpolation between a phone floor and the desktop
  // modular size) so headings never overflow a small screen on the default/
  // unskinned themes. A host's explicit px size still wins (renders a fixed px,
  // not a clamp), and the skinned themes override `--site-h*` at the section
  // level, so this only governs the default path.
  const fluid = (maxPx: number) => {
    const max = maxPx;
    const min = Math.max(15, Math.round(max * 0.72));
    if (max - min < 2) return px(max); // small sizes: fluid adds nothing
    const slope = (max - min) / (1280 - 375); // px per px-of-viewport
    const vw = (slope * 100).toFixed(3); // as vw units
    const intercept = (min - slope * 375).toFixed(2); // px at 0 viewport
    return `clamp(${min}px, calc(${intercept}px + ${vw}vw), ${max}px)`;
  };
  const heading = (k: keyof SiteTypeSizes) =>
    typeof sz[k] === "number" ? px(sz[k] as number) : fluid(derived[k]);

  // --- Images ---
  const img = theme?.image ?? {};
  const imgRadius =
    typeof img.radius === "number" ? px(img.radius) : "var(--site-radius)";
  const imgBorder =
    typeof img.borderWidth === "number" && img.borderWidth > 0
      ? `${img.borderWidth}px solid ${img.borderColor || "var(--site-line)"}`
      : "none";
  const imgShadow = SITE_SHADOWS[img.shadow ?? "none"];

  // --- Cards ---
  const card = theme?.card ?? {};
  const cardRadius =
    typeof card.radius === "number" ? px(card.radius) : "var(--site-radius)";
  const cardShadow = SITE_SHADOWS[card.shadow ?? "none"];
  const cardBorder =
    card.style === "flat" ? "none" : "1px solid var(--site-line)";
  const cardRatio = CARD_RATIO[card.ratio ?? "4:3"];

  // --- Hero layout / feature icons / social ---
  const heroLeft = theme?.heroLayout === "left";
  const iconColor = (theme?.iconColor || "").trim() || accent;
  const social = theme?.social ?? {};
  const socStyle = social.style ?? "plain";
  const socBg = socStyle === "filled" ? accent : "transparent";
  const socFg =
    socStyle === "filled"
      ? accentInk
      : socStyle === "outline"
        ? accent
        : "var(--site-mute)";
  const socBorder = socStyle === "outline" ? `1px solid ${accent}` : "none";
  const socRadius = social.shape === "square" ? "var(--site-radius)" : "9999px";

  // --- Buttons (primary + secondary) ---
  const siteRadius = RADIUS_REM[theme?.radius ?? preset.radius];
  const legacyStyle = theme?.buttonStyle ?? "solid";
  const btns = theme?.buttons ?? {};

  // Primary button
  const pBtn = btns.primary ?? {};
  const pStyle = pBtn.style ?? legacyStyle;
  const pColor = (pBtn.color || "").trim() || accent;
  const pInk = pBtn.color ? accentInkFor(pBtn.color) : accentInk;
  const pBorder =
    pStyle === "outline"
      ? `${pBtn.borderWidth ?? 1}px solid ${pColor}`
      : "none";
  const pRadius = pBtn.pill ? "9999px" : siteRadius;
  const pBg = pStyle === "solid" ? pColor : "transparent";
  const pFg = pStyle === "solid" ? pInk : pColor;

  // Secondary button
  const sBtn = btns.secondary ?? {};
  const sStyle = sBtn.style ?? "outline"; // default to outline for secondary
  const sColor = (sBtn.color || "").trim() || secondary;
  const sInk = sBtn.color ? accentInkFor(sBtn.color) : secondaryInk;
  const sBorder =
    sStyle === "outline"
      ? `${sBtn.borderWidth ?? 1}px solid ${sColor}`
      : "none";
  const sRadius = sBtn.pill ? "9999px" : siteRadius;
  const sBg = sStyle === "solid" ? sColor : "transparent";
  const sFg = sStyle === "solid" ? sInk : sColor;

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

    "--site-text-sm": size("accent"),
    "--site-text-accent": size("accent"),
    "--site-text-base": size("body"),
    "--site-h6": heading("h6"),
    "--site-h5": heading("h5"),
    "--site-h4": heading("h4"),
    "--site-h3": heading("h3"),
    "--site-h2": heading("h2"),
    "--site-h1": heading("h1"),

    "--site-img-radius": imgRadius,
    "--site-img-border": imgBorder,
    "--site-img-shadow": imgShadow,

    "--site-card-radius": cardRadius,
    "--site-card-shadow": cardShadow,
    "--site-card-border": cardBorder,
    "--site-card-ratio": cardRatio,

    "--site-hero-align": heroLeft ? "left" : "center",
    "--site-hero-justify": heroLeft ? "flex-start" : "center",
    "--site-icon-color": iconColor,

    "--site-social-bg": socBg,
    "--site-social-fg": socFg,
    "--site-social-border": socBorder,
    "--site-social-radius": socRadius,

    // Primary button
    "--site-btn-primary-bg": pBg,
    "--site-btn-primary-color": pFg,
    "--site-btn-primary-border": pBorder,
    "--site-btn-primary-radius": pRadius,

    // Secondary button
    "--site-btn-secondary-bg": sBg,
    "--site-btn-secondary-color": sFg,
    "--site-btn-secondary-border": sBorder,
    "--site-btn-secondary-radius": sRadius,
  } as React.CSSProperties;
}

/** The default button fill style for a theme (used by site buttons). */
export function resolveButtonStyle(
  theme: SiteThemeConfig | null | undefined,
): SiteButtonStyle {
  return theme?.buttonStyle === "outline" ? "outline" : "solid";
}
