import "server-only";

import { getMyHostId } from "@/lib/host/current";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { parseSectionsLoose } from "@/lib/website/sections.schema";
import { getThemeRoomDetailSections } from "@/lib/website/themeSections";

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

export type PageListItem = {
  id: string;
  kind: string;
  slug: string;
  navLabel: string | null;
  title: string | null;
  showInNav: boolean;
  draftCount: number;
  publishedCount: number;
};

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

  const { data: rows } = await supabase
    .from("website_pages")
    .select(
      "id, kind, slug, nav_label, title, show_in_nav, nav_order, draft_sections, published_sections",
    )
    .eq("website_id", websiteId)
    .order("nav_order", { ascending: true });

  return (rows ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    slug: r.slug,
    navLabel: r.nav_label,
    title: r.title,
    showInNav: r.show_in_nav,
    draftCount: parseSectionsLoose(r.draft_sections).length,
    publishedCount: parseSectionsLoose(r.published_sections).length,
  }));
}
