// Colour parsing/composition for the unified ColorControl (hex + opacity).
//
// A stored colour value is any CSS colour string: `#rgb`, `#rrggbb`,
// `#rrggbbaa`, `rgb()/rgba()`, the keyword `transparent`, or a passthrough
// token like `var(--x)` / a named colour. The control edits a base 6-hex plus an
// alpha (0–100%); everything else is preserved best-effort.

export type ParsedColor = {
  /** Base colour as `#rrggbb` for the native picker; null when not hex-like. */
  hex: string | null;
  /** Opacity 0–100. */
  alpha: number;
  /** The value was the `transparent` keyword (alpha 0, no colour). */
  transparent: boolean;
  /** A passthrough value we can't decompose (var()/named) — edit alpha disabled. */
  raw: string | null;
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/** Expand `#rgb` → `#rrggbb`. */
function expand3(hex: string): string {
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

export function parseColor(
  value: string | undefined | null,
  fallback = "#000000",
): ParsedColor {
  const v = (value ?? "").trim();
  if (!v) {
    const f = /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : "#000000";
    return { hex: f, alpha: 100, transparent: false, raw: null };
  }
  if (v.toLowerCase() === "transparent")
    return { hex: null, alpha: 0, transparent: true, raw: null };

  if (/^#[0-9a-f]{3}$/i.test(v))
    return { hex: expand3(v), alpha: 100, transparent: false, raw: null };
  if (/^#[0-9a-f]{6}$/i.test(v))
    return { hex: v.toLowerCase(), alpha: 100, transparent: false, raw: null };
  if (/^#[0-9a-f]{8}$/i.test(v)) {
    const a = parseInt(v.slice(7, 9), 16) / 255;
    return {
      hex: v.slice(0, 7).toLowerCase(),
      alpha: Math.round(a * 100),
      transparent: false,
      raw: null,
    };
  }
  const rgba = v.match(
    /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i,
  );
  if (rgba) {
    const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map((n) =>
      clamp(parseInt(n, 10), 0, 255),
    );
    const rawA = rgba[4];
    const a =
      rawA == null
        ? 1
        : rawA.endsWith("%")
          ? parseFloat(rawA) / 100
          : parseFloat(rawA);
    const hex = `#${[r, g, b]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")}`;
    return {
      hex,
      alpha: Math.round(clamp(a, 0, 1) * 100),
      transparent: false,
      raw: null,
    };
  }
  // var(), named colours, gradients — keep as-is, opacity control disabled.
  return { hex: null, alpha: 100, transparent: false, raw: v };
}

/** Compose a base 6-hex + alpha (0–100) into the shortest exact CSS value. */
export function composeColor(hex: string, alpha: number): string {
  const a = clamp(Math.round(alpha), 0, 100);
  if (a <= 0) return "transparent";
  if (a >= 100) return hex.toLowerCase();
  const aa = Math.round((a / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex.toLowerCase()}${aa}`;
}

/** A CSS colour that always renders (for swatches) even from a raw/transparent value. */
export function displayColor(p: ParsedColor, fallback: string): string {
  if (p.transparent) return "transparent";
  if (p.raw) return p.raw;
  if (p.hex) return composeColor(p.hex, p.alpha);
  return fallback;
}
