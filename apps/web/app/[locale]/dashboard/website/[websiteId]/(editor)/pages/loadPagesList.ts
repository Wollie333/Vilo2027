import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";
import { parseSectionsLoose } from "@/lib/website/sections.schema";

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
    .select("id")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

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
