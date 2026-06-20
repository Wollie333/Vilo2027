import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { websiteAssetUrl } from "@/lib/website/assets";

import { SITE_PRESETS, SITE_PRESET_KEYS, type SitePreset } from "./themes";

/** One selectable theme for the Brand Studio gallery / preset cards. */
export type ThemeOption = {
  id: string;
  slug: string;
  name: string;
  previewUrl: string | null;
  base: SitePreset;
  isPremium: boolean;
  price: number | null;
};

/** The 6 built-in presets as themes — used until the site_themes table is
 * applied (and as a safety fallback if the catalogue is empty/unavailable). */
function presetThemes(): ThemeOption[] {
  return SITE_PRESET_KEYS.map((slug) => ({
    id: `preset:${slug}`,
    slug,
    name: SITE_PRESETS[slug].label,
    previewUrl: null,
    base: SITE_PRESETS[slug],
    isPremium: false,
    price: null,
  }));
}

/**
 * Load the active theme catalogue (site_themes), ordered. Falls back to the
 * built-in presets when the table doesn't exist yet, is empty, or errors — so
 * the studio works whether or not the migration has been applied. Uses the
 * admin client (catalogue is platform-managed, read here only).
 *
 * Uses the admin client (catalogue is platform-managed, read here only).
 */
export async function loadActiveThemes(): Promise<ThemeOption[]> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("site_themes")
      .select("id, slug, name, preview_image_path, base, is_premium, price")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    const rows = data ?? [];
    if (error || rows.length === 0) return presetThemes();

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      previewUrl: websiteAssetUrl(r.preview_image_path),
      base: (r.base ?? {}) as SitePreset,
      isPremium: !!r.is_premium,
      price: r.price ?? null,
    }));
  } catch {
    return presetThemes();
  }
}

/** One page template carried by a theme (seeds website_pages on apply). */
export type ThemePageTemplate = {
  kind: string;
  slug: string;
  title: string;
  nav_label: string;
  nav_order: number;
  show_in_nav: boolean;
  sections: unknown[];
};

export type ThemeBundle = {
  slug: string;
  base: SitePreset;
  pageTemplates: ThemePageTemplate[];
};

/** Load a catalogue theme (by uuid) with its base + page templates — for the
 * apply-theme flow. Returns null if not found / catalogue unavailable. */
export async function getThemeBundle(
  themeId: string,
): Promise<ThemeBundle | null> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("site_themes")
      .select("slug, base, page_templates")
      .eq("id", themeId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) return null;
    return {
      slug: data.slug,
      base: data.base as SitePreset,
      pageTemplates: Array.isArray(data.page_templates)
        ? (data.page_templates as ThemePageTemplate[])
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Resolve a theme's visual base by slug — the authoritative source for what gets
 * stored on save (so we never trust a client-sent base). Falls back to the
 * built-in preset of the same slug when the catalogue is unavailable.
 */
export async function resolveThemeBase(slug: string): Promise<SitePreset> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("site_themes")
      .select("base")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    const base = data?.base as SitePreset | undefined;
    if (!error && base?.palette) return base;
  } catch {
    // fall through to preset fallback
  }
  if (slug in SITE_PRESETS) {
    return SITE_PRESETS[slug as keyof typeof SITE_PRESETS];
  }
  return SITE_PRESETS.classic;
}
