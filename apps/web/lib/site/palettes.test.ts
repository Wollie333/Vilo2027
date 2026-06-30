import { describe, expect, it } from "vitest";

import { generatePalettes, isHexColor, resolvePaletteAccent } from "./palettes";
import { buildSiteVars } from "./themes";

describe("resolvePaletteAccent (wizard accent choice)", () => {
  const base = "#0a7d4b";

  it("returns the base accent for the default palette (index 0)", () => {
    expect(resolvePaletteAccent(base, 0)).toBe(base);
  });

  it("returns the selected palette variation by index", () => {
    const palettes = generatePalettes(base);
    expect(resolvePaletteAccent(base, 1)).toBe(palettes[1].accent);
    expect(resolvePaletteAccent(base, 3)).toBe(palettes[3].accent);
  });

  it("a valid custom accent overrides the palette index", () => {
    expect(resolvePaletteAccent(base, 2, "#ff0000")).toBe("#ff0000");
  });

  it("falls back to the base accent for a garbage custom value or bad index", () => {
    expect(resolvePaletteAccent(base, 99)).toBe(base);
    expect(resolvePaletteAccent(base, 0, "not-a-hex")).toBe(base);
  });

  it("generates five distinct, on-theme variations", () => {
    const palettes = generatePalettes(base);
    expect(palettes).toHaveLength(5);
    for (const p of palettes) expect(isHexColor(p.accent)).toBe(true);
    // default === base; the others are nudged variations.
    expect(palettes[0].accent).toBe(base);
  });
});

describe("buildSiteVars applies the chosen accent", () => {
  it("emits the host's colors.accent as --site-accent (the full chain)", () => {
    const vars = buildSiteVars({
      preset: "warm",
      colors: { accent: "#ff0000" },
    }) as Record<string, string>;
    expect(vars["--site-accent"]).toBe("#ff0000");
  });

  it("matches what the wizard would store for a chosen palette", () => {
    const base = "#0a7d4b";
    const chosen = resolvePaletteAccent(base, 2); // a generated variation
    const vars = buildSiteVars({
      preset: "warm",
      colors: { accent: chosen },
    }) as Record<string, string>;
    expect(vars["--site-accent"]).toBe(chosen);
  });
});
