import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MAIN_MENU_ID,
  MAIN_MENU_NAME,
  withNamedMenus,
} from "@/lib/site/namedMenus";
import type { SiteMenuItem, SiteNavigation } from "@/lib/site/types";

type PageRow = {
  kind: string;
  slug: string;
  nav_label: string | null;
  title: string | null;
  nav_order: number;
  show_in_nav: boolean;
};

/** Page path (mirrors loadSitePage.pageHref without importing that heavy module). */
function href(kind: string, slug: string): string {
  return kind === "home" ? "/" : `/${slug}`;
}

/** Is this page the rooms listing (so room detail links nest under it)? */
function isRoomsPage(p: { kind: string; slug: string }): boolean {
  return p.kind === "rooms" || p.slug === "rooms";
}

/** Is this the specials/offers listing (so offer detail links nest under it)? */
function isSpecialsPage(p: { kind: string; slug: string }): boolean {
  return p.kind === "specials" || p.slug === "specials";
}

/**
 * Build a default header menu from a site's in-nav pages (Home first, then the
 * rest by nav_order). Excludes the room_detail template (rendered only via the
 * room route). The Rooms item is flagged `autoRooms` so its dropdown auto-fills
 * with the site's current rooms at render — always up to date, with per-room
 * hide via `hiddenRoomIds`.
 */
export function buildDefaultMenu(pages: PageRow[]): SiteMenuItem[] {
  return pages
    .filter((p) => p.show_in_nav && p.kind !== "room_detail")
    .sort((a, b) => a.nav_order - b.nav_order)
    .map((p) => {
      const item: SiteMenuItem = {
        id: p.kind === "home" ? "home" : p.slug || p.kind,
        label: p.nav_label?.trim() || p.title?.trim() || p.slug,
        href: href(p.kind, p.slug),
      };
      if (isRoomsPage(p)) {
        item.autoRooms = true;
        item.hiddenRoomIds = [];
      }
      if (isSpecialsPage(p)) {
        item.autoSpecials = true;
        item.hiddenSpecialIds = [];
      }
      return item;
    });
}

/**
 * Materialise a default "Main menu" when a site has none, so first-time hosts get
 * a real, editable menu in the builder (named-menu model) instead of the implicit
 * "auto-pull every page" fallback. Idempotent — when the site already has menu
 * content it only upgrades the legacy single `menu` into the named shape (once).
 * Persists so the menu shows + publishes like any edit.
 */
export async function ensureDefaultMenu<T extends SiteNavigation>(
  supabase: SupabaseClient,
  websiteId: string,
  navigation: T,
): Promise<T> {
  // Already has real menu content — just ensure it's in the named-menu shape and
  // persist the upgrade the first time (legacy single `menu` → named "Main menu").
  const existing = navigation.menus?.length
    ? navigation.menus.flatMap((m) => m.items)
    : (navigation.menu ?? []);
  if (existing.length > 0) {
    const normalized = withNamedMenus(navigation) as T;
    if (!navigation.menus || navigation.menus.length === 0) {
      await supabase
        .from("host_websites")
        .update({ navigation: normalized })
        .eq("id", websiteId);
    }
    return normalized;
  }

  const { data: pages } = await supabase
    .from("website_pages")
    .select("kind, slug, nav_label, title, nav_order, show_in_nav")
    .eq("website_id", websiteId)
    .eq("show_in_nav", true)
    .order("nav_order", { ascending: true });

  const items = buildDefaultMenu((pages ?? []) as PageRow[]);
  if (items.length === 0) return navigation;

  const next = {
    ...navigation,
    menus: [{ id: MAIN_MENU_ID, name: MAIN_MENU_NAME, items }],
    primaryMenuId: MAIN_MENU_ID,
    menu: items,
  } as T;
  await supabase
    .from("host_websites")
    .update({ navigation: next })
    .eq("id", websiteId);
  return next;
}
