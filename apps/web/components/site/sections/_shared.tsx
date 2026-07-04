import type { CSSProperties, ReactNode } from "react";

import type {
  BlockSpace,
  BlockStyle,
  ElButtonSize,
  ElColor,
  ElSize,
  ElementStyle,
  ElWeight,
  SectionTone,
} from "@/lib/website/sections.schema";
import { websiteAssetUrl } from "@/lib/website/assets";
import { isLucideIcon, lucideIconFor } from "@/lib/website/icons/lucideCatalog";

// Shared presentational primitives for site sections. All colour/radius/font
// come from the scoped `--site-*` CSS vars (set by <SiteThemeRoot>), never the
// app's brand-* tokens, so each tenant site themes independently.

// Shared styling for standalone site images (gallery, host photo, property
// hero) — driven by the Brand Studio "Images" controls via `--site-img-*`.
export const siteImageStyle: CSSProperties = {
  borderRadius: "var(--site-img-radius)",
  border: "var(--site-img-border)",
  boxShadow: "var(--site-img-shadow)",
};

/**
 * An icon value is an uploaded image/SVG (URL, storage path, or data URI) rather
 * than an emoji/character glyph. Lets any icon field accept an uploaded asset —
 * hosts upload PNG/SVG/etc via the media library (which accepts image/svg+xml)
 * and set the icon to its URL/path.
 */
export function isIconImage(v?: string | null): boolean {
  if (!v) return false;
  return (
    /^(https?:\/\/|\/|data:image\/)/.test(v) ||
    /\.(svg|png|jpe?g|webp|gif)$/i.test(v)
  );
}

/**
 * Render an item icon: an uploaded image/SVG when the value is a URL/path,
 * otherwise the emoji/character glyph. `size` is the image box in px; for a glyph
 * the caller's `className`/`style` (e.g. `text-2xl`, colour) drive its size/colour.
 */
export function SiteIcon({
  value,
  size = 32,
  className = "",
  style,
}: {
  value?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  if (!value) return null;
  // Lucide catalogue pick (`lucide:<name>`) → the SVG icon. Inherits the caller's
  // colour via `currentColor` (set through `style.color`).
  if (isLucideIcon(value)) {
    const Icon = lucideIconFor(value);
    if (Icon)
      return (
        <Icon
          aria-hidden
          size={size}
          strokeWidth={1.8}
          style={style}
          className={className}
        />
      );
  }
  if (isIconImage(value)) {
    const src = websiteAssetUrl(value) ?? value;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        style={{ width: size, height: size, objectFit: "contain", ...style }}
        className={className}
      />
    );
  }
  return (
    <span aria-hidden className={className} style={style}>
      {value}
    </span>
  );
}

/**
 * Per-section colour scheme ("tone"). Returns a style that paints the band
 * background and re-points the scoped `--site-*` text vars for the section
 * subtree, so any section can be recoloured in one tap and stay on-brand.
 * Returns undefined for "default" (inherit the page theme). `color-mix` and
 * literal alpha keep it readable across any theme palette.
 */
export function sectionToneStyle(
  tone?: SectionTone,
): CSSProperties | undefined {
  switch (tone) {
    case "accent":
      return {
        background: "var(--site-accent)",
        "--site-bg": "var(--site-accent)",
        "--site-surface": "color-mix(in srgb, #fff 14%, var(--site-accent))",
        "--site-ink": "var(--site-accent-ink)",
        "--site-mute":
          "color-mix(in srgb, var(--site-accent-ink) 70%, transparent)",
        "--site-line":
          "color-mix(in srgb, var(--site-accent-ink) 24%, transparent)",
      } as CSSProperties;
    case "dark":
      return {
        background: "var(--site-ink)",
        "--site-bg": "var(--site-ink)",
        "--site-surface": "rgba(255,255,255,0.08)",
        "--site-ink": "#ffffff",
        "--site-mute": "rgba(255,255,255,0.68)",
        "--site-line": "rgba(255,255,255,0.18)",
      } as CSSProperties;
    case "muted":
      return {
        background: "color-mix(in srgb, var(--site-ink) 5%, var(--site-bg))",
        "--site-surface": "var(--site-bg)",
      } as CSSProperties;
    case "sand":
      // Warm alternating band. Themes ship `--site-soft` (and an optional
      // `--site-soft-2`); without them it falls back to a soft ink-tint so it
      // still reads as a distinct band. Text stays dark-on-light (no ink flip);
      // cards flip to the page bg so they lift off the band.
      return {
        background:
          "var(--site-soft, color-mix(in srgb, var(--site-ink) 6%, var(--site-bg)))",
        "--site-surface": "var(--site-bg)",
      } as CSSProperties;
    case "navy":
      // Deep anchor band (testimonials / closing sections). Themes ship
      // `--site-navy*`; without them it falls back to the theme ink. Text flips
      // to light and cards sit on a slightly-raised navy.
      return {
        background: "var(--site-navy, var(--site-ink))",
        "--site-bg": "var(--site-navy, var(--site-ink))",
        "--site-surface":
          "var(--site-navy-2, color-mix(in srgb, #fff 8%, var(--site-navy, var(--site-ink))))",
        "--site-ink": "var(--site-navy-ink, #ffffff)",
        "--site-mute": "var(--site-navy-mute, rgba(255,255,255,0.68))",
        "--site-line": "rgba(255,255,255,0.14)",
      } as CSSProperties;
    default:
      return undefined;
  }
}

// ── Per-block responsive style ────────────────────────────────
// A scoped <style> lets any section carry desktop/tablet/mobile spacing
// overrides. We emit BOTH:
//   • @media queries — drive the LIVE public site (no container there).
//   • @container queries — drive the builder's device frames, which are query
//     containers (`.device { container-type: inline-size }`), so switching the
//     device toggle previews the override EXACTLY. Inert on the public site
//     (no ancestor container), so zero risk there.
// Breakpoints mirror Tailwind's lg/sm.
const BLOCK_PAD: Record<BlockSpace, number> = {
  none: 0,
  sm: 16,
  md: 32,
  lg: 64,
  xl: 112,
};

function viewportRules(v?: {
  padTop?: BlockSpace;
  padBottom?: BlockSpace;
  padX?: BlockSpace;
}) {
  if (!v) return "";
  const out: string[] = [];
  if (v.padTop) out.push(`padding-top:${BLOCK_PAD[v.padTop]}px`);
  if (v.padBottom) out.push(`padding-bottom:${BLOCK_PAD[v.padBottom]}px`);
  if (v.padX)
    out.push(
      `padding-left:${BLOCK_PAD[v.padX]}px;padding-right:${BLOCK_PAD[v.padX]}px`,
    );
  return out.join(";");
}

// Frame preset → CSS maps (fixed, predictable scale — preset-only).
const BLOCK_RADIUS_PX = { none: 0, sm: 6, md: 12, lg: 20, full: 9999 } as const;
const BLOCK_BORDER_PX = { none: 0, thin: 1, medium: 2, thick: 4 } as const;
const BLOCK_BORDER_COLOR_VAR = {
  line: "var(--site-line)",
  ink: "var(--site-ink)",
  accent: "var(--site-accent)",
} as const;
const BLOCK_MAXWIDTH_CSS = {
  full: "",
  wide: "64rem",
  medium: "48rem",
  narrow: "32rem",
} as const;
const BLOCK_MINHEIGHT_CSS = {
  auto: "",
  sm: "320px",
  md: "480px",
  lg: "640px",
  screen: "100vh",
} as const;

/** Global (all-viewport) frame rules: margin, border, radius, max-width. */
function frameRules(style: BlockStyle): string {
  const out: string[] = [];
  if (style.backgroundImage) {
    out.push(
      `background-image:url("${style.backgroundImage}")`,
      "background-size:cover",
      "background-position:center",
      "background-repeat:no-repeat",
    );
  }
  if (style.marginTop) out.push(`margin-top:${BLOCK_PAD[style.marginTop]}px`);
  if (style.marginBottom)
    out.push(`margin-bottom:${BLOCK_PAD[style.marginBottom]}px`);
  if (style.border && style.border !== "none") {
    const color = BLOCK_BORDER_COLOR_VAR[style.borderColor ?? "line"];
    out.push(`border:${BLOCK_BORDER_PX[style.border]}px solid ${color}`);
  }
  if (style.radius && style.radius !== "none") {
    out.push(`border-radius:${BLOCK_RADIUS_PX[style.radius]}px`);
    out.push("overflow:hidden");
  }
  const mw = style.maxWidth ? BLOCK_MAXWIDTH_CSS[style.maxWidth] : "";
  if (mw) out.push(`max-width:${mw};margin-left:auto;margin-right:auto`);
  const mh = style.minHeight ? BLOCK_MINHEIGHT_CSS[style.minHeight] : "";
  if (mh) out.push(`min-height:${mh}`);
  return out.join(";");
}

/**
 * The same per-block FRAME (background / border / radius / max-width / min-height)
 * as {@link frameRules}, but as an inline `CSSProperties` object — for the Builder V2
 * `PageDocRenderer`, which styles nodes inline rather than via scoped `<style>`.
 * Margins/padding are intentionally omitted (Builder V2 owns those via `node.space`).
 */
export function blockFrameStyle(style?: BlockStyle): CSSProperties {
  if (!style) return {};
  const out: CSSProperties = {};
  if (style.background) out.background = style.background;
  // Background image (cover/centre). A `background` colour set alongside acts as a
  // scrim/fallback under it (e.g. "rgba(0,0,0,.4)"), so text stays legible.
  if (style.backgroundImage) {
    out.backgroundImage = `url("${style.backgroundImage}")`;
    out.backgroundSize = "cover";
    out.backgroundPosition = "center";
    out.backgroundRepeat = "no-repeat";
  }
  if (style.border && style.border !== "none") {
    const color = BLOCK_BORDER_COLOR_VAR[style.borderColor ?? "line"];
    out.border = `${BLOCK_BORDER_PX[style.border]}px solid ${color}`;
  }
  if (style.radius && style.radius !== "none") {
    out.borderRadius = BLOCK_RADIUS_PX[style.radius];
    out.overflow = "hidden";
  }
  const mw = style.maxWidth ? BLOCK_MAXWIDTH_CSS[style.maxWidth] : "";
  if (mw) {
    out.maxWidth = mw;
    out.marginLeft = "auto";
    out.marginRight = "auto";
  }
  const mh = style.minHeight ? BLOCK_MINHEIGHT_CSS[style.minHeight] : "";
  if (mh) out.minHeight = mh;
  return out;
}

const HEADING_SIZE_CSS = {
  sm: "1.5rem",
  md: "1.875rem",
  lg: "2.25rem",
  xl: "3rem",
} as const;
const BODY_SIZE_CSS = { sm: "0.9rem", md: "1rem", lg: "1.125rem" } as const;
const FONT_WEIGHT_CSS = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
const LINE_HEIGHT_CSS = {
  tight: "1.1",
  snug: "1.25",
  normal: "1.5",
  relaxed: "1.7",
  loose: "2",
} as const;

/**
 * Typography overrides → scoped rules targeting the section's text tags. Using a
 * descendant `:is(...)` selector gives specificity (0,1,1), which beats the
 * section's Tailwind text utilities (0,1,0) so the host's size/weight wins.
 */
function typographyRules(cls: string, style: BlockStyle): string {
  // `!important` so the override also beats sections that set font size/weight
  // via inline style (e.g. the hero headline uses inline theme-font vars).
  const heading: string[] = [];
  if (style.headingSize)
    heading.push(`font-size:${HEADING_SIZE_CSS[style.headingSize]}!important`);
  if (style.headingWeight)
    heading.push(
      `font-weight:${FONT_WEIGHT_CSS[style.headingWeight]}!important`,
    );
  let css = "";
  if (heading.length)
    css += `.${cls} :is(h1,h2,h3,h4,h5,h6){${heading.join(";")}}`;
  if (style.bodySize)
    css += `.${cls} :is(p,li){font-size:${BODY_SIZE_CSS[style.bodySize]}!important}`;
  if (style.lineHeight)
    css += `.${cls} :is(h1,h2,h3,h4,h5,h6,p,li){line-height:${LINE_HEIGHT_CSS[style.lineHeight]}!important}`;
  return css;
}

/** Build the scoped CSS for a section's responsive spacing (empty when none). */
export function blockStyleCss(cls: string, style?: BlockStyle): string {
  if (!style) return "";
  const sel = `.${cls}`;
  const tb = viewportRules(style.tablet);
  const mb = viewportRules(style.mobile);
  let css = "";
  // Desktop padding + the global frame share the base rule.
  const base = [viewportRules(style.desktop), frameRules(style)]
    .filter(Boolean)
    .join(";");
  if (base) css += `${sel}{${base}}`;
  // Live site (viewport).
  if (tb) css += `@media(max-width:1024px){${sel}{${tb}}}`;
  if (mb) css += `@media(max-width:640px){${sel}{${mb}}}`;
  // Builder device frames (container) — last so they win when both match.
  if (tb) css += `@container (max-width:1024px){${sel}{${tb}}}`;
  if (mb) css += `@container (max-width:640px){${sel}{${mb}}}`;
  css += typographyRules(cls, style);
  return css;
}

// ── Per-ELEMENT styling (Elementor-style) ─────────────────────
// A composite block's node carries `elements: { <key>: ElementStyle }` (base =
// desktop) + optional per-device overrides in `responsive[device].elements`. We
// turn those into dedicated `--el-<key>-*` CSS custom properties SET ON THE BLOCK
// WRAPPER, so they cascade to every sub-element (and every card in a grid). The
// block's own component reads `var(--el-<key>-*, <theme fallback>)`, so an unset
// value falls straight back to the theme — zero visual change until a host styles.
//
// Emitted as a scoped <style> (never inline) so per-device overrides work in BOTH
// contexts, mirroring `blockStyleCss`: `@media` drives the LIVE site (viewport),
// `@container` drives the builder's device frames (`.device` is a query container).
type NodeElementStyles = {
  elements?: Record<string, ElementStyle>;
  responsive?: {
    tablet?: { elements?: Record<string, ElementStyle> };
    mobile?: { elements?: Record<string, ElementStyle> };
  };
};

const EL_SHADOW_CSS: Record<string, string> = {
  none: "none",
  sm: "0 1px 3px rgba(0,0,0,0.08)",
  md: "0 8px 24px rgba(0,0,0,0.12)",
  lg: "0 20px 48px rgba(0,0,0,0.18)",
};

/** One element map → `--el-<key>-*` declarations (empty when nothing set). */
function elementDecls(elements?: Record<string, ElementStyle>): string {
  if (!elements) return "";
  const out: string[] = [];
  for (const [key, s] of Object.entries(elements)) {
    if (!s) continue;
    if (s.bg) out.push(`--el-${key}-bg:${s.bg}`);
    if (s.color) out.push(`--el-${key}-fg:${s.color}`);
    // Composed border shorthand: emitted only when width or colour is set, so a
    // component's `border: var(--el-<key>-bd, <theme default>)` keeps the theme's
    // default border untouched until the host actually styles it.
    if (s.borderWidth != null || s.borderColor) {
      const w = s.borderWidth != null ? s.borderWidth : 1;
      const c = s.borderColor || "var(--site-line)";
      out.push(`--el-${key}-bd:${w}px solid ${c}`);
    }
    if (s.radius != null) out.push(`--el-${key}-radius:${s.radius}px`);
    if (s.fontSize != null) out.push(`--el-${key}-size:${s.fontSize}px`);
    if (s.fontWeight)
      out.push(`--el-${key}-weight:${FONT_WEIGHT_CSS[s.fontWeight]}`);
    if (s.lineHeight != null) out.push(`--el-${key}-lh:${s.lineHeight}`);
    if (s.letterSpacing != null)
      out.push(`--el-${key}-ls:${s.letterSpacing}px`);
    if (s.textTransform) out.push(`--el-${key}-tt:${s.textTransform}`);
    if (s.shadow) out.push(`--el-${key}-shadow:${EL_SHADOW_CSS[s.shadow]}`);
    // Box spacing — consumed as `padding: var(--el-<key>-py) var(--el-<key>-px)`
    // and `margin-top/bottom: var(--el-<key>-mt/mb, …)` by the element.
    if (s.padY != null) out.push(`--el-${key}-py:${s.padY}px`);
    if (s.padX != null) out.push(`--el-${key}-px:${s.padX}px`);
    if (s.marginTop != null) out.push(`--el-${key}-mt:${s.marginTop}px`);
    if (s.marginBottom != null) out.push(`--el-${key}-mb:${s.marginBottom}px`);
  }
  return out.join(";");
}

/**
 * Scoped CSS for a node's per-element styles. `selector` targets the block
 * wrapper (e.g. `[data-node-id="abc"]`). Returns "" when the node has no element
 * styles, so the caller can skip the `<style>` entirely.
 */
export function elementVarsCss(
  selector: string,
  node: NodeElementStyles,
): string {
  const base = elementDecls(node.elements);
  const tb = elementDecls(node.responsive?.tablet?.elements);
  const mb = elementDecls(node.responsive?.mobile?.elements);
  if (!base && !tb && !mb) return "";
  let css = "";
  if (base) css += `${selector}{${base}}`;
  // Live site (viewport).
  if (tb) css += `@media (max-width:1024px){${selector}{${tb}}}`;
  if (mb) css += `@media (max-width:640px){${selector}{${mb}}}`;
  // Builder device frames (container) — last so they win when both match.
  if (tb) css += `@container (max-width:1024px){${selector}{${tb}}}`;
  if (mb) css += `@container (max-width:640px){${selector}{${mb}}}`;
  return css;
}

/**
 * Scope a node's free-form custom CSS (Advanced tab, Elementor-style). The keyword
 * `selector` maps to this node's wrapper (`selector` in a rule is REQUIRED to target
 * anything), so rules stay confined to the element and override its own styling.
 * Bare declarations (no braces) are wrapped in `selector{…}` for convenience. The
 * `</style` / `<script` breakout guard keeps a host from escaping the <style> tag.
 * Returns "" when there's nothing to emit.
 */
export function customCssScoped(selector: string, css?: string): string {
  const raw = css?.trim();
  if (!raw) return "";
  const safe = raw.replace(/<\/?(style|script)/gi, "");
  const body = safe.includes("{") ? safe : `selector{${safe}}`;
  const scoped = body
    // A bare `selector { … }` targets the wrapper AND its content, so declarations
    // reach the inline-styled leaf (h2 / p / button) too — otherwise the wrapper
    // rule can't win over the leaf's inline style. Descendant forms like
    // `selector h3 { … }` keep targeting exactly what the host wrote.
    .replace(/selector\s*\{/g, `${selector},${selector} *{`)
    .replace(/selector/g, selector);
  // The elements render with INLINE styles, which beat any stylesheet rule. To make
  // this box actually OVERRIDE the element (its whole purpose), force `!important`
  // onto each declaration that doesn't already have it. At-rule preludes (e.g.
  // `@media (max-width: 640px)`) end in `)` not `;`/`}`, so they're left untouched.
  return scoped.replace(
    /([a-zA-Z-]+\s*:\s*[^;{}!]+?)(\s*!important)?\s*(?=[;}])/g,
    (_m, decl: string, imp: string) =>
      imp ? `${decl}${imp}` : `${decl} !important`,
  );
}

export function SectionShell({
  children,
  surface = false,
  width = "wide",
  id,
}: {
  children: ReactNode;
  /** Paint a raised surface background instead of the page background. */
  surface?: boolean;
  width?: "wide" | "narrow";
  id?: string;
}) {
  return (
    <section
      id={id}
      style={surface ? { background: "var(--site-surface)" } : undefined}
      className="px-5 py-16 md:py-20"
    >
      <div
        className={`mx-auto w-full ${width === "narrow" ? "max-w-2xl" : "max-w-5xl"}`}
      >
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({
  children,
  centered = true,
  className = "",
}: {
  children: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  return (
    <h2
      style={{
        fontFamily: "var(--site-font-heading)",
        fontWeight: "var(--site-weight-heading)" as unknown as number,
        fontSize: "var(--site-h2)",
        lineHeight: "var(--site-leading-heading)" as unknown as number,
        letterSpacing: "var(--site-tracking-heading)",
        color: "var(--site-ink)",
      }}
      className={`${centered ? "text-center" : ""} ${className}`}
    >
      {children}
    </h2>
  );
}

export function Muted({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p style={{ color: "var(--site-mute)", ...style }} className={className}>
      {children}
    </p>
  );
}

// Button size presets (preset-only, brand-safe). md = the long-standing default,
// so existing callers that omit `size` render exactly as before.
const BTN_SIZE: Record<ElButtonSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};
// Default padding per size (px) — the fallback for the editable `--el-button-py/px`
// override, so a host's per-button padding wins but the size preset holds otherwise.
const BTN_PAD: Record<ElButtonSize, { py: number; px: number }> = {
  sm: { py: 8, px: 16 },
  md: { py: 12, px: 24 },
  lg: { py: 16, px: 32 },
};

export function SiteButton({
  href,
  children,
  variant = "primary",
  size = "md",
  track = false,
  fullWidth = false,
  radius,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: ElButtonSize;
  /** Mark as a booking-engine link so it counts as a booking_click (analytics). */
  track?: boolean;
  /** Stretch to fill the container width. */
  fullWidth?: boolean;
  /** Per-button corner-radius override (px string); else the theme's button radius. */
  radius?: string;
}) {
  // Per-element styling: reads `--el-button-*` (host edit) → theme button tokens.
  // So any block whose registry declares a "button" element makes this editable.
  const prefix = `--site-btn-${variant}`;
  const pad = BTN_PAD[size];
  const style: CSSProperties = {
    background: `var(--el-button-bg, var(${prefix}-bg))`,
    color: `var(--el-button-fg, var(${prefix}-color))`,
    border: `var(--el-button-bd, var(${prefix}-border))`,
    borderRadius:
      radius && radius !== "auto"
        ? `${radius}px`
        : `var(--el-button-radius, var(${prefix}-radius))`,
    // Editable padding/margin: host override wins, else the size preset / 0.
    padding: `var(--el-button-py, ${pad.py}px) var(--el-button-px, ${pad.px}px)`,
    marginTop: "var(--el-button-mt, 0px)",
    marginBottom: "var(--el-button-mb, 0px)",
  };
  return (
    <a
      href={href}
      style={style}
      {...(track ? { "data-wielo-book": "" } : {})}
      className={`${fullWidth ? "flex w-full" : "inline-flex"} items-center justify-center font-semibold transition-opacity hover:opacity-90 ${BTN_SIZE[size]}`}
    >
      {children}
    </a>
  );
}

// ── Element typography presets (brand-safe — tied to the theme) ──
// Sizes scale off the theme's base size; weights are standard steps; colours are
// theme palette roles. "auto"/"default" return the caller's fallback so an
// element that doesn't override inherits the theme exactly as before.
const EL_SIZE_CSS: Record<Exclude<ElSize, "auto">, string> = {
  xs: "calc(var(--site-text-base) * 0.85)",
  sm: "var(--site-text-base)",
  md: "calc(var(--site-text-base) * 1.4)",
  lg: "calc(var(--site-text-base) * 1.9)",
  xl: "calc(var(--site-text-base) * 2.6)",
  "2xl": "calc(var(--site-text-base) * 3.4)",
};
const EL_WEIGHT_CSS: Record<Exclude<ElWeight, "auto">, number> = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

/** Element font-size override, or `fallback` when "auto"/unset. */
export function elFontSize(size: ElSize | undefined, fallback: string): string {
  return size && size !== "auto" ? EL_SIZE_CSS[size] : fallback;
}
/** Element weight override, or `fallback` when "auto"/unset. */
export function elFontWeight(
  weight: ElWeight | undefined,
  fallback: number | string,
): number | string {
  return weight && weight !== "auto" ? EL_WEIGHT_CSS[weight] : fallback;
}
/** Element line-height override (unitless multiplier, as a string), else fallback. */
export function elLineHeight<T>(
  lh: string | undefined,
  fallback: T,
): number | T {
  return lh && lh !== "auto" ? Number(lh) : fallback;
}
/** Element letter-spacing override (px, as a string), else fallback. */
export function elLetterSpacing<T>(
  ls: string | undefined,
  fallback: T,
): string | T {
  return ls && ls !== "auto" ? `${ls}px` : fallback;
}
/** Element text-transform override, or `{}` (inherit) when "none"/unset. */
export function elTransform(t: string | undefined): {
  textTransform?: CSSProperties["textTransform"];
} {
  return t && t !== "none"
    ? { textTransform: t as CSSProperties["textTransform"] }
    : {};
}
/** Element colour override (theme role), or `fallback` when "default"/unset. */
export function elColor(color: ElColor | undefined, fallback: string): string {
  switch (color) {
    case "muted":
      return "var(--site-mute)";
    case "accent":
      return "var(--site-accent)";
    case "secondary":
      return "var(--site-secondary)";
    default:
      return fallback;
  }
}

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--site-surface)",
        border: "var(--site-card-border)",
        borderRadius: "var(--site-card-radius)",
        boxShadow: "var(--site-card-shadow)",
        // Editable card margin (default 0 → no effect until the host sets it).
        marginTop: "var(--el-card-mt, 0px)",
        marginBottom: "var(--el-card-mb, 0px)",
        ...style,
      }}
      className={`overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

export function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, rating));
  const pct = (r / 5) * 100;
  // Overlay technique: a clipped accent layer over a muted track gives precise
  // fractional fill (e.g. 4.4 → 88%) instead of rounding to whole stars.
  return (
    <span
      aria-label={`${r.toFixed(1)} out of 5`}
      className="relative inline-block whitespace-nowrap"
      style={{ color: "var(--site-line)" }}
    >
      {"★★★★★"}
      <span
        aria-hidden
        className="absolute left-0 top-0 overflow-hidden"
        style={{ width: `${pct}%`, color: "var(--site-accent)" }}
      >
        {"★★★★★"}
      </span>
    </span>
  );
}
