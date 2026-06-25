import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { roomSlugMap } from "@/lib/site/loadSitePage";
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

/**
 * Build a default header menu from a site's in-nav pages (Home first, then the
 * rest by nav_order). Excludes the room_detail template (rendered only via the
 * room route). When the site has multiple rooms, each room's detail page is
 * nested as a sub-menu under the Rooms item (`roomLinks`).
 */
export function buildDefaultMenu(
  pages: PageRow[],
  roomLinks: SiteMenuItem[] = [],
): SiteMenuItem[] {
  return pages
    .filter((p) => p.show_in_nav && p.kind !== "room_detail")
    .sort((a, b) => a.nav_order - b.nav_order)
    .map((p) => {
      const item: SiteMenuItem = {
        id: p.kind === "home" ? "home" : p.slug || p.kind,
        label: p.nav_label?.trim() || p.title?.trim() || p.slug,
        href: href(p.kind, p.slug),
      };
      if (roomLinks.length > 0 && isRoomsPage(p)) item.children = roomLinks;
      return item;
    });
}

/**
 * The site's visible rooms as menu links (`/rooms/<slug>`), using the SAME slug
 * algorithm the public room route resolves with. Empty unless there are at least
 * two rooms (a single room needs no dropdown).
 */
async function visibleRoomLinks(
  supabase: SupabaseClient,
  websiteId: string,
): Promise<SiteMenuItem[]> {
  const { data: wr } = await supabase
    .from("website_rooms")
    .select("room_id, display_name, sort_order")
    .eq("website_id", websiteId)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });
  const rows = (wr ?? []) as {
    room_id: string;
    display_name: string | null;
    sort_order: number;
  }[];
  if (rows.length < 2) return [];

  const ids = rows.map((r) => r.room_id);
  const { data: pr } = await supabase
    .from("property_rooms")
    .select("id, name, is_active, deleted_at")
    .in("id", ids);
  const nameById = new Map(
    (
      (pr ?? []) as {
        id: string;
        name: string;
        is_active: boolean | null;
        deleted_at: string | null;
      }[]
    )
      .filter((r) => r.is_active !== false && !r.deleted_at)
      .map((r) => [r.id, r.name]),
  );

  const ordered = rows
    .filter((r) => nameById.has(r.room_id))
    .map((r) => ({
      roomId: r.room_id,
      name: r.display_name?.trim() || nameById.get(r.room_id) || "Room",
    }));
  if (ordered.length < 2) return [];

  const slugs = roomSlugMap(ordered);
  return ordered.map((r) => ({
    id: `room-${r.roomId}`,
    label: r.name,
    href: `/rooms/${slugs.get(r.roomId)}`,
  }));
}

/**
 * Materialise a default menu when a site has none, so first-time hosts get a
 * real, editable menu in the builder instead of the implicit "auto-pull every
 * page" fallback. Idempotent — returns the navigation unchanged once a menu
 * exists. Persists the seeded menu so it shows + publishes like any edit.
 */
export async function ensureDefaultMenu<T extends SiteNavigation>(
  supabase: SupabaseClient,
  websiteId: string,
  navigation: T,
): Promise<T> {
  if (navigation.menu && navigation.menu.length > 0) return navigation;

  const [{ data: pages }, roomLinks] = await Promise.all([
    supabase
      .from("website_pages")
      .select("kind, slug, nav_label, title, nav_order, show_in_nav")
      .eq("website_id", websiteId)
      .eq("show_in_nav", true)
      .order("nav_order", { ascending: true }),
    visibleRoomLinks(supabase, websiteId),
  ]);

  const menu = buildDefaultMenu((pages ?? []) as PageRow[], roomLinks);
  if (menu.length === 0) return navigation;

  const next = { ...navigation, menu } as T;
  await supabase
    .from("host_websites")
    .update({ navigation: next })
    .eq("id", websiteId);
  return next;
}
