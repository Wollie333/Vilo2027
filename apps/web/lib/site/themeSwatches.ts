import {
  SITE_PRESETS,
  DEFAULT_PRESET,
  type SitePresetKey,
} from "@/lib/site/themes";

/**
 * The website's theme colours for the builder colour pickers (Brand Studio): the
 * resolved core palette (host colour overrides over the chosen preset) plus any
 * saved brand swatches, deduped and capped. Shared by every builder so the picker
 * shows the same theme colours everywhere.
 */
export function themeSwatches(theme: unknown): string[] {
  const t = (theme ?? {}) as {
    preset?: string;
    colors?: Record<string, string | undefined>;
    palette?: unknown;
  };
  const key = String(t.preset ?? "").replace("preset:", "");
  const presetKey = (
    key in SITE_PRESETS ? key : DEFAULT_PRESET
  ) as SitePresetKey;
  const pal = SITE_PRESETS[presetKey].palette;
  const c = t.colors ?? {};
  const core = [
    (c.accent || "").trim() || pal.accent,
    (c.ink || "").trim() || pal.ink,
    (c.surface || "").trim() || pal.surface,
    (c.bg || "").trim() || pal.bg,
    (c.line || "").trim() || pal.line,
    (c.mute || "").trim() || pal.mute,
  ];
  const saved = Array.isArray(t.palette)
    ? (t.palette as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...core, ...saved]) {
    const v = (raw || "").trim();
    if (
      /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) &&
      !seen.has(v.toLowerCase())
    ) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out.slice(0, 14);
}
