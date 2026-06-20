import "server-only";

import { getMyHostId } from "@/lib/host/current";
import {
  assembleSiteDataByType,
  loadSiteContext,
  type SiteContext,
} from "@/lib/site/loadSitePage";
import type { SiteDataByType } from "@/lib/site/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import {
  AUTO_POPULATE_SECTIONS,
  parseSectionsLoose,
  type WebsiteSection,
} from "@/lib/website/sections.schema";

import {
  savedSectionsSchema,
  type SavedSection,
} from "@/app/[locale]/dashboard/website/schemas";

export type PageBuilderData = {
  websiteId: string;
  subdomain: string;
  page: {
    id: string;
    kind: string;
    slug: string;
    title: string | null;
    seo: { title?: string; description?: string };
  };
  sections: WebsiteSection[];
  /** Site chrome for the inline preview (same data the public site renders). */
  brand: SiteContext["brand"];
  theme: SiteContext["theme"];
  nav: SiteContext["nav"];
  /** Live data pool keyed by auto-populate type, so the preview is never stale. */
  dataByType: Partial<SiteDataByType>;
  /** Host's reusable saved sections ("my blocks"). */
  savedSections: SavedSection[];
};

/**
 * Owner-scoped load of one page for the section builder (W8). Pulls the page's
 * draft sections plus the site chrome + a per-type live-data pool — built through
 * the SAME loader the public site uses (`loadSiteContext` / `assembleSiteDataByType`,
 * preview mode) so the inline preview is byte-for-byte the published render.
 * Returns null when the website or page isn't owned by the signed-in host.
 */
export async function loadPageBuilder(
  websiteId: string,
  pageId: string,
): Promise<PageBuilderData | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, subdomain")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

  // Page must belong to this website (read via admin — owner already proven).
  const admin = createAdminClient();
  const { data: pageRow } = await admin
    .from("website_pages")
    .select("id, kind, slug, title, draft_sections, seo_overrides")
    .eq("id", pageId)
    .eq("website_id", websiteId)
    .maybeSingle<{
      id: string;
      kind: string;
      slug: string;
      title: string | null;
      draft_sections: unknown;
      seo_overrides: { title?: string; description?: string } | null;
    }>();
  if (!pageRow) return null;

  const ctx = await loadSiteContext(site.subdomain, { preview: true });
  // The site row always resolves (we just read it), but be defensive.
  const sections = parseSectionsLoose(pageRow.draft_sections);
  const dataByType = ctx
    ? await assembleSiteDataByType(admin, ctx, new Set(AUTO_POPULATE_SECTIONS))
    : {};

  // The admin client is schema-untyped, so reading saved_sections is fine here.
  const { data: savedRow } = await admin
    .from("host_websites")
    .select("saved_sections")
    .eq("id", websiteId)
    .maybeSingle();
  const savedSections = savedSectionsSchema
    .catch([])
    .parse(
      (savedRow as { saved_sections?: unknown } | null)?.saved_sections ?? [],
    );

  return {
    websiteId,
    subdomain: site.subdomain,
    page: {
      id: pageRow.id,
      kind: pageRow.kind,
      slug: pageRow.slug,
      title: pageRow.title,
      seo: {
        title: pageRow.seo_overrides?.title,
        description: pageRow.seo_overrides?.description,
      },
    },
    sections,
    brand: ctx?.brand ?? { name: site.subdomain },
    theme: ctx?.theme ?? {},
    nav: ctx?.nav ?? [],
    dataByType,
    savedSections,
  };
}
