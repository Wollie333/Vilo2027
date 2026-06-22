import "server-only";

import { pageHref } from "@/lib/site/loadSitePage";
import type {
  PropertyOverride,
  PublishSnapshot,
  SiteAnalyticsSettings,
  SiteConversion,
  SiteNavItem,
  SiteNavigation,
  SnapshotRoom,
} from "@/lib/site/types";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { createServerClient } from "@/lib/supabase/server";

// Works with either the owner-scoped server client (publish action / dirty check
// run by the host) or the service-role admin client.
type Db =
  | ReturnType<typeof createAdminClient>
  | ReturnType<typeof createServerClient>;

/**
 * Deterministic JSON with recursively sorted object keys. Needed because Postgres
 * `jsonb` does NOT preserve key order, so a freshly-built snapshot can't be
 * compared to a read-back one with plain `JSON.stringify`.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function normaliseRooms(
  rows:
    | Array<{
        room_id: string;
        is_visible: boolean | null;
        featured?: boolean | null;
        badge?: string | null;
        display_name: string | null;
        display_price: number | string | null;
        display_currency: string | null;
        display_desc: string | null;
        sort_order: number | null;
      }>
    | null
    | undefined,
): SnapshotRoom[] {
  return (rows ?? [])
    .map((r) => ({
      room_id: r.room_id,
      is_visible: r.is_visible ?? true,
      featured: r.featured ?? false,
      badge: r.badge ?? null,
      display_name: r.display_name,
      display_price: r.display_price == null ? null : Number(r.display_price),
      display_currency: r.display_currency,
      display_desc: r.display_desc,
      sort_order: r.sort_order ?? 0,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Capture the full public-render config for a website from its live (draft)
 * state — the SSOT used by both {@link publishWebsiteAction} (frozen into
 * `published_snapshot`) and {@link computeWebsiteDirty} (compared against it).
 * Section content is NOT included here: pages carry their own draft/published
 * twin columns, compared separately.
 */
export async function buildWebsiteSnapshot(
  sb: Db,
  websiteId: string,
): Promise<PublishSnapshot> {
  const [{ data: site }, { data: pages }, { data: props }, { data: rooms }] =
    await Promise.all([
      sb
        .from("host_websites")
        .select("brand, theme, seo, navigation, settings")
        .eq("id", websiteId)
        .maybeSingle(),
      sb
        .from("website_pages")
        .select("kind, slug, nav_label, title, nav_order, show_in_nav")
        .eq("website_id", websiteId)
        .eq("show_in_nav", true)
        .order("nav_order", { ascending: true }),
      sb
        .from("website_properties")
        .select("property_id, sort_order, display_overrides")
        .eq("website_id", websiteId)
        .eq("is_visible", true)
        .order("sort_order", { ascending: true }),
      sb
        .from("website_rooms")
        .select(
          "room_id, is_visible, featured, badge, display_name, display_price, display_currency, display_desc, sort_order",
        )
        .eq("website_id", websiteId)
        .order("sort_order", { ascending: true }),
    ]);

  const nav: SiteNavItem[] = (pages ?? []).map((p) => ({
    label: p.nav_label?.trim() || p.title?.trim() || p.slug,
    href: pageHref(p.kind, p.slug),
  }));

  // Freeze non-empty per-property overrides keyed by property id.
  const propertyOverrides: Record<string, PropertyOverride> = {};
  for (const p of props ?? []) {
    const ov = (p.display_overrides ?? {}) as PropertyOverride;
    const clean: PropertyOverride = {
      heading: ov.heading?.trim() || undefined,
      intro: ov.intro?.trim() || undefined,
      hero_path: ov.hero_path?.trim() || undefined,
    };
    if (clean.heading || clean.intro || clean.hero_path) {
      propertyOverrides[p.property_id] = clean;
    }
  }

  const settings = ((site as { settings?: unknown })?.settings ?? {}) as {
    conversion?: SiteConversion;
    analytics?: SiteAnalyticsSettings;
    layout?: "full" | "boxed";
  };

  return {
    brand: (site?.brand ?? {}) as Record<string, unknown>,
    theme: (site?.theme ?? {}) as Record<string, unknown>,
    seo: (site?.seo ?? {}) as Record<string, unknown>,
    nav,
    navigation: ((site as { navigation?: unknown })?.navigation ??
      {}) as SiteNavigation,
    conversion: (settings.conversion ?? {}) as SiteConversion,
    analytics: (settings.analytics ?? {}) as SiteAnalyticsSettings,
    layout: settings.layout === "boxed" ? "boxed" : "full",
    propertyIds: (props ?? []).map((p) => p.property_id),
    rooms: normaliseRooms(rooms),
    propertyOverrides,
  };
}

export type WebsiteDirtyState = {
  /** Has the site ever been published (and not later taken offline)? */
  isPublished: boolean;
  /** Are there unpublished changes (chrome, membership or page content)? */
  isDirty: boolean;
};

/**
 * Compare a website's live (draft) state to its last publish. A never-published
 * or taken-offline site is always "dirty" (publishing it is the next action).
 * Otherwise: chrome/membership diff (snapshot) OR any page whose draft sections
 * differ from its published sections.
 */
export async function computeWebsiteDirty(
  sb: Db,
  websiteId: string,
): Promise<WebsiteDirtyState> {
  const { data: site } = await sb
    .from("host_websites")
    .select("status, published_snapshot")
    .eq("id", websiteId)
    .maybeSingle<{
      status: string;
      published_snapshot: PublishSnapshot | null;
    }>();

  if (!site || site.status !== "published" || !site.published_snapshot) {
    return { isPublished: false, isDirty: true };
  }

  const current = await buildWebsiteSnapshot(sb, websiteId);
  if (stableStringify(current) !== stableStringify(site.published_snapshot)) {
    return { isPublished: true, isDirty: true };
  }

  const { data: pages } = await sb
    .from("website_pages")
    .select("draft_sections, published_sections")
    .eq("website_id", websiteId);
  const contentDirty = (pages ?? []).some(
    (p) =>
      stableStringify(p.draft_sections) !==
      stableStringify(p.published_sections),
  );

  return { isPublished: true, isDirty: contentDirty };
}
