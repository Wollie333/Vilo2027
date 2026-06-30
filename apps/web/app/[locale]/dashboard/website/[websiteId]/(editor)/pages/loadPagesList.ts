import "server-only";

import { getMyHostId } from "@/lib/host/current";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteImageUrl } from "@/lib/site/image";
import { websiteAssetUrl } from "@/lib/website/assets";
import { createServerClient } from "@/lib/supabase/server";
import {
  parseSectionsLoose,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import { getThemeRoomDetailSections } from "@/lib/website/themeSections";

/** A page's featured-image thumbnail: the first uploaded image across its
 *  sections (hero background, image element, host photo …). Theme stock imagery
 *  isn't stored as a path, so pages that only use the design's stock return null
 *  (the manager shows the neutral placeholder).
 *
 *  Stored values are bare `website-assets` paths, so resolve them to a public URL
 *  first (`websiteAssetUrl`), THEN transform to a small thumbnail. Passing a bare
 *  path straight to `siteImageUrl` returns it unchanged → a broken <img>. */
function firstSectionImage(sections: WebsiteSection[]): string | null {
  for (const s of sections) {
    const p = s.props as Record<string, unknown>;
    const raw = p.image_path ?? p.photo_path ?? p.src;
    if (typeof raw === "string" && raw.trim()) {
      const full = websiteAssetUrl(raw);
      if (full) {
        return siteImageUrl(full, { width: 160, height: 120, resize: "cover" });
      }
    }
  }
  return null;
}

/**
 * Ensure the website has its single `room_detail` template page, seeded with the
 * theme's designed room layout. Idempotent — created lazily the first time the
 * host opens the Pages manager so every site (incl. ones made before the feature)
 * gets an editable room template. The public room route falls back to the theme
 * default even before this exists, so rooms never 404.
 */
async function ensureRoomDetailPage(
  supabase: SupabaseClient,
  websiteId: string,
  themePreset: string | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from("website_pages")
    .select("id")
    .eq("website_id", websiteId)
    .eq("kind", "room_detail")
    .maybeSingle();
  if (existing) return;

  await supabase.from("website_pages").insert({
    website_id: websiteId,
    kind: "room_detail",
    slug: "room-detail",
    title: "Room details",
    show_in_nav: false,
    nav_order: 900,
    draft_sections: getThemeRoomDetailSections(themePreset),
    published_sections: [],
  });
}

/**
 * Ensure the website has its `search_results` system template (THEME_CONTRACT.md
 * Class 2). New sites get it from the standard page set on create; this backfills
 * it for sites made before the feature, so it appears in the Pages manager's
 * System-templates group and is reachable at /search-results. Idempotent.
 */
async function ensureSearchResultsPage(
  supabase: SupabaseClient,
  websiteId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("website_pages")
    .select("id")
    .eq("website_id", websiteId)
    .eq("kind", "search_results")
    .maybeSingle();
  if (existing) return;

  await supabase.from("website_pages").insert({
    website_id: websiteId,
    kind: "search_results",
    slug: "search-results",
    title: "Search results",
    show_in_nav: false,
    nav_order: 905,
    draft_sections: [
      {
        id: crypto.randomUUID(),
        type: "search_results",
        enabled: true,
        props: {
          heading: "Available stays",
          body: "Choose your dates to see what’s open — book direct for the best rate.",
        },
      },
    ],
    published_sections: [],
  });
}

export type PageListItem = {
  id: string;
  kind: string;
  slug: string;
  navLabel: string | null;
  title: string | null;
  showInNav: boolean;
  draftCount: number;
  publishedCount: number;
  /** Featured image (first uploaded image in the page), or null for a placeholder. */
  thumbUrl: string | null;
};

/** A room nested under the room-detail template in the Pages manager. The host
 *  edits the shared template, then optionally customizes each room (per-room
 *  overrides) — so the rooms show indented beneath the template, derived live
 *  from the site's visible rooms (no page-per-room to create or sync). */
export type RoomChild = { roomId: string; name: string };

/** The site's visible rooms, in display order, for the Pages-manager nesting.
 *  RLS-scoped (server client) so only the owner's rooms return. */
export async function loadRoomChildren(
  websiteId: string,
): Promise<RoomChild[]> {
  const supabase = createServerClient();
  const { data: rows } = await supabase
    .from("website_rooms")
    .select("room_id, display_name, sort_order, room:property_rooms ( name )")
    .eq("website_id", websiteId)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  return (rows ?? []).map((r) => {
    const room = Array.isArray(r.room) ? r.room[0] : r.room;
    return {
      roomId: r.room_id,
      name: (r.display_name as string)?.trim() || room?.name || "Room",
    };
  });
}

/** Owner-scoped list of a website's pages with section counts (W8 Pages tab). */
export async function loadPagesList(
  websiteId: string,
): Promise<PageListItem[] | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, theme")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; theme: { preset?: string } | null }>();
  if (!site) return null;

  await ensureRoomDetailPage(supabase, websiteId, site.theme?.preset ?? null);
  await ensureSearchResultsPage(supabase, websiteId);

  const { data: rows } = await supabase
    .from("website_pages")
    .select(
      "id, kind, slug, nav_label, title, show_in_nav, nav_order, draft_sections, published_sections",
    )
    .eq("website_id", websiteId)
    .order("nav_order", { ascending: true });

  return (rows ?? []).map((r) => {
    const draft = parseSectionsLoose(r.draft_sections);
    return {
      id: r.id,
      kind: r.kind,
      slug: r.slug,
      navLabel: r.nav_label,
      title: r.title,
      showInNav: r.show_in_nav,
      draftCount: draft.length,
      publishedCount: parseSectionsLoose(r.published_sections).length,
      thumbUrl: firstSectionImage(draft),
    };
  });
}
