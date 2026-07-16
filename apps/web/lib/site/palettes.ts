// Accent-only palette generation for the website setup wizard. Each palette is a
// variation of the chosen theme's accent colour; the theme keeps its own
// bg/surface/ink, so every result stays on-theme and readable (the renderer's
// buildSiteVars + readableTextOn handle button contrast). Pure + dependency-free
// so it runs identically on the server (the create action) and the client (the
// wizard's live preview).

export type SitePalette = {
  /** Stable key (also the i18n label key suffix). */
  key: "default" | "warmer" | "cooler" | "bolder" | "softer";
  /** Resolved accent hex (#rrggbb). */
  accent: string;
};

type Hsl = { h: number; s: number; l: number };

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/** "#abc" / "#aabbcc" → {r,g,b} (0-255); falls back to a mid-grey on garbage. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "").trim();
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { r: 128, g: 128, b: 128 };
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: Hsl): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const mm = ln - c / 2;
  const to = (v: number) =>
    clamp(Math.round((v + mm) * 255), 0, 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const PALETTE_KEYS: SitePalette["key"][] = [
  "default",
  "warmer",
  "cooler",
  "bolder",
  "softer",
];

/**
 * Five accent variations of a theme's base accent, in display order. The wizard
 * shows these plus a sixth "Custom" card (a free accent picker) handled in the UI.
 */
export function generatePalettes(baseAccent: string): SitePalette[] {
  const { r, g, b } = hexToRgb(baseAccent);
  const base = rgbToHsl(r, g, b);
  return PALETTE_KEYS.map((key) => {
    switch (key) {
      case "warmer":
        // Nudge the hue toward orange (warm), keeping it recognisably the theme.
        return { key, accent: hslToHex({ ...base, h: base.h - 18 }) };
      case "cooler":
        // Nudge toward blue/green (cool).
        return { key, accent: hslToHex({ ...base, h: base.h + 18 }) };
      case "bolder":
        return {
          key,
          accent: hslToHex({
            ...base,
            s: clamp(base.s + 20, 0, 100),
            l: clamp(base.l - 4, 0, 100),
          }),
        };
      case "softer":
        return {
          key,
          accent: hslToHex({
            ...base,
            s: clamp(base.s - 22, 0, 100),
            l: clamp(base.l + 8, 0, 100),
          }),
        };
      default:
        return { key, accent: baseAccent };
    }
  });
}

/**
 * A small light→base→deep ramp of an accent, for palette-card swatches. Pure +
 * dependency-free (shares the hsl helpers), so the wizard cards + live preview
 * stay in sync.
 */
export function accentRamp(accent: string): {
  light: string;
  base: string;
  deep: string;
} {
  const { r, g, b } = hexToRgb(accent);
  const hsl = rgbToHsl(r, g, b);
  return {
    light: hslToHex({
      ...hsl,
      s: clamp(hsl.s - 8, 0, 100),
      l: clamp(hsl.l + 20, 0, 100),
    }),
    base: accent,
    deep: hslToHex({
      ...hsl,
      s: clamp(hsl.s + 6, 0, 100),
      l: clamp(hsl.l - 16, 0, 100),
    }),
  };
}

/** True for a valid `#rgb` / `#rrggbb` hex. */
export function isHexColor(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

/**
 * Resolve the accent the host chose: a generated palette by index, or a custom
 * accent (when paletteIndex is out of range and a valid customAccent is given).
 * Always returns a valid hex (falls back to the base accent).
 */
export function resolvePaletteAccent(
  baseAccent: string,
  paletteIndex: number,
  customAccent?: string | null,
): string {
  if (customAccent && isHexColor(customAccent)) return customAccent.trim();
  const palettes = generatePalettes(baseAccent);
  return palettes[paletteIndex]?.accent ?? baseAccent;
}
