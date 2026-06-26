import "server-only";

import { getMyHostId } from "@/lib/host/current";
import {
  assembleSiteDataByType,
  loadSampleRoomDetail,
  loadSiteContext,
  pageHref,
  type SiteContext,
} from "@/lib/site/loadSitePage";
import type { RoomDetail, SiteDataByType } from "@/lib/site/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";
import {
  AUTO_POPULATE_SECTIONS,
  parseSectionsLoose,
  type SectionType,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import { extractSectionsText } from "@/lib/website/seoAnalyzer";

import {
  navigationSchema,
  savedSectionsSchema,
  type NavigationConfig,
  type SavedSection,
} from "@/app/[locale]/dashboard/website/schemas";

/** A page link option for the nav menu / footer pickers. */
export type NavPageOption = { label: string; href: string };

export type PageBuilderData = {
  websiteId: string;
  subdomain: string;
  /** Site-level OG share image (for the social preview). */
  ogImageUrl?: string;
  page: {
    id: string;
    kind: string;
    slug: string;
    title: string | null;
    seo: {
      title?: string;
      description?: string;
      focusKeyword?: string;
      image?: string;
    };
  };
  sections: WebsiteSection[];
  /** Flattened section text for the SEO analyzer. */
  bodyText: string;
  /** Site chrome for the inline preview (same data the public site renders). */
  brand: SiteContext["brand"];
  theme: SiteContext["theme"];
  nav: SiteContext["nav"];
  /** Navigation config so the preview chrome matches the published render. */
  navigation: SiteContext["navigation"];
  /** The EDITABLE navigation config (header/menu/footer) for inline chrome edits. */
  navConfig: NavigationConfig;
  /** Page links for the menu / footer pickers. */
  navPages: NavPageOption[];
  /** Brand display name (for the nav previews / labels). */
  brandName: string;
  /** Live data pool keyed by auto-populate type, so the preview is never stale. */
  dataByType: Partial<SiteDataByType>;
  /** Host's reusable saved sections ("my blocks"). */
  savedSections: SavedSection[];
  /** Site width (full = edge-to-edge, boxed = centred) for the preview + toggle. */
  layout: "full" | "boxed";
  /** A sample room for the preview of a room_detail page (null otherwise). */
  sampleRoom: RoomDetail | null;
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
    .select("id, subdomain, seo, navigation, brand")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

  const navConfig = navigationSchema.parse(site.navigation ?? {});
  const brandName =
    ((site.brand ?? {}) as { name?: string }).name?.trim() || site.subdomain;

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
      seo_overrides: {
        title?: string;
        description?: string;
        focusKeyword?: string;
        image?: string;
      } | null;
    }>();
  if (!pageRow) return null;

  const ctx = await loadSiteContext(site.subdomain, { preview: true });
  // The site row always resolves (we just read it), but be defensive.
  const sections = parseSectionsLoose(pageRow.draft_sections);
  // On a room-detail page, fetch a sample room so the room-scoped sections
  // (gallery/overview/amenities/rate) preview with real content in the builder.
  const sampleRoom =
    pageRow.kind === "room_detail" && ctx
      ? await loadSampleRoomDetail(ctx)
      : null;
  const dataByType = ctx
    ? await assembleSiteDataByType(
        admin,
        ctx,
        // `trust` is free-form but takes a live review score — request it too so
        // the builder preview shows the score, like the public site does. The
        // rates blocks (room_rates/seasonal_pricing) default to live data, so
        // request them too — the renderer falls back to manual rows otherwise.
        new Set<SectionType>([
          ...AUTO_POPULATE_SECTIONS,
          "trust",
          "room_rates",
          "seasonal_pricing",
        ]),
      )
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

  // Page links for the inline header/footer menu pickers.
  const { data: pageRows } = await admin
    .from("website_pages")
    .select("kind, slug, nav_label, title, nav_order")
    .eq("website_id", websiteId)
    .order("nav_order", { ascending: true });
  const navPages: NavPageOption[] = (
    (pageRows ?? []) as {
      kind: string;
      slug: string;
      nav_label: string | null;
      title: string | null;
    }[]
  ).map((p) => ({
    label: p.nav_label?.trim() || p.title?.trim() || p.slug,
    href: pageHref(p.kind, p.slug),
  }));

  return {
    websiteId,
    subdomain: site.subdomain,
    ogImageUrl:
      websiteAssetUrl(
        (site.seo as { og_image_path?: string } | null)?.og_image_path,
      ) ?? undefined,
    page: {
      id: pageRow.id,
      kind: pageRow.kind,
      slug: pageRow.slug,
      title: pageRow.title,
      seo: {
        title: pageRow.seo_overrides?.title,
        description: pageRow.seo_overrides?.description,
        focusKeyword: pageRow.seo_overrides?.focusKeyword,
        image: pageRow.seo_overrides?.image,
      },
    },
    sections,
    bodyText: extractSectionsText(sections),
    brand: ctx?.brand ?? { name: site.subdomain },
    theme: ctx?.theme ?? {},
    nav: ctx?.nav ?? [],
    navigation: ctx?.navigation ?? {},
    navConfig,
    navPages,
    brandName,
    dataByType,
    savedSections,
    layout: ctx?.layout ?? "full",
    sampleRoom,
  };
}
