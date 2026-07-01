// Server-side data assembly for the public micro-site renderer (plan §2).
//
// Uses the SERVICE-ROLE admin client with EXPLICIT filters (tenant hosts have no
// session; the public renderer never relies on RLS) and stays free of
// `next/headers` so it can also run from verify scripts — the route files read
// the host header / `?site` param and pass the ref + preview flag in.
//
// The draft-vs-published split is honoured throughout. PUBLIC (non-preview):
// chrome (brand/theme/nav), channel membership and room overrides are read from
// `host_websites.published_snapshot` (frozen at publish, W10), and pages render
// `published_sections` — so unpublished edits never leak; a published site with
// no snapshot yet (legacy) falls back to the live columns. PREVIEW: live columns
// + `draft_sections`, allowing any status.
import { cache } from "react";

import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { slugify } from "@/lib/help/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAmenityIndex } from "@/lib/taxonomy/getAmenities";
import { websiteAssetUrl } from "@/lib/website/assets";
import {
  isRoomScoped,
  parseSectionsLoose,
  type SectionType,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import {
  isPageDoc,
  parsePageDocLoose,
  type PageDoc,
} from "@/lib/website/pageDoc.schema";
import { getThemeRoomDetailSections } from "@/lib/website/themeSections";
import { parseRoomMediaOverrides } from "@/lib/website/roomMedia";
import {
  mergeRoomDetailSections,
  parseRoomDetailOverride,
  type RoomDetailOverride,
} from "@/lib/website/roomDetailOverride";
import { sanitiseSectionsHtml } from "@/lib/website/sanitiseSections";
import {
  formFieldsSchema,
  formSettingsSchema,
  type FormType,
} from "@/lib/website/forms.schema";
import type { SiteThemeConfig } from "./themes";
import { resolveThemeBase, resolveThemePageTemplates } from "./themes.server";
import { mergeStandardPages } from "@/lib/website/standardPages";

/**
 * The full canonical page set a theme presents in PREVIEW: the theme's own
 * designed templates, plus default spines for any required/system page it omits
 * (specials/experiences/gallery/search-results). So the gallery preview can show
 * AND render every associated page design, not just the theme's hand-authored ones.
 */
async function resolveThemePreviewPages(slug: string, siteName: string) {
  const templates = await resolveThemePageTemplates(slug);
  return mergeStandardPages(templates, siteName);
}
import type {
  BlogCard,
  BookableProperty,
  GalleryImage,
  Poi,
  RateRow,
  PropertyOverride,
  PublishSnapshot,
  ReviewCard,
  RoomAmenity,
  RoomCard,
  RoomDetail,
  RoomDetailImage,
  RoomGroup,
  RoomPolicies,
  SiteAnalyticsSettings,
  SiteBrand,
  SiteConversion,
  SiteData,
  SiteDataByType,
  SiteMenuItem,
  SiteNavItem,
  SiteNavigation,
  SnapshotRoom,
  SpecialCard,
  AddonCard,
  SiteFormDef,
} from "./types";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";

export type SiteContext = {
  websiteId: string;
  businessId: string;
  subdomain: string;
  status: string;
  preview: boolean;
  /** Theme slug when previewing a different theme (for theme gallery). */
  previewThemeSlug?: string;
  locale: string; // business default_language (drives booking deep-link locale)
  /** Path prefix for on-site booking links ("" on a tenant host; /[locale]/site
   *  when rendered via the app-domain ?site= testing affordance). */
  bookBasePath: string;
  brand: SiteBrand;
  theme: SiteThemeConfig;
  /** Site-level SEO config (title/description/og_image_path/robots/sitemap/gsc). */
  seo: Record<string, unknown>;
  nav: SiteNavItem[];
  /** Navigation config (top bar, header CTA/behaviour, footer extras). */
  navigation: SiteNavigation;
  /** Conversion chrome (WhatsApp button + announcement bar). */
  conversion: SiteConversion;
  /** Host third-party analytics (GA4 + Meta Pixel + consent gate). */
  analytics: SiteAnalyticsSettings;
  /** Blog index heading + intro (generic-theme `/blog` listing). Blank → defaults. */
  blog: { heading?: string; intro?: string };
  /** Site width: "full" (edge-to-edge) or "boxed" (centred max-width). */
  layout: "full" | "boxed";
  /** Resolved definition of the pop-up's embedded form, when one is set. */
  popupForm: SiteFormDef | null;
  /** Ordered, visible property ids for this site (channel membership). */
  propertyIds: string[];
  /**
   * Frozen room channel state to render from (the published snapshot). `null`
   * in preview / legacy mode, where the rooms assembly reads `website_rooms` live.
   */
  publishedRoomRows: SnapshotRoom[] | null;
  /** Frozen per-property rooms-section overrides; null in preview (read live). */
  publishedPropertyOverrides: Record<string, PropertyOverride> | null;
};

export type SitePageMeta = {
  id: string;
  kind: string;
  slug: string;
  title: string | null;
  seoOverrides: Record<string, unknown>;
};

export type SitePageResult = {
  page: SitePageMeta;
  sections: WebsiteSection[];
  data: SiteData;
  /** Builder V2 (v:2) pages carry a nested PageDoc rendered via PageDocRenderer;
   *  legacy flat pages leave this undefined and render `sections`. */
  doc?: PageDoc;
};

/** A `host` (custom domain, has a dot) or a bare subdomain label. */
export function resolveSiteRef(input: {
  host?: string | null;
  siteParam?: string | null;
}): string | null {
  const site = input.siteParam?.trim().toLowerCase();
  if (site) return site;
  const host = input.host?.trim().toLowerCase();
  if (host) return host;
  return null;
}

export function pageHref(kind: string, slug: string): string {
  return kind === "home" ? "/" : `/${slug}`;
}

/**
 * Resolve a site by subdomain OR custom domain and build its chrome. Returns
 * null when no site matches (or it isn't published, in non-preview mode).
 */
const loadSiteContextCached = cache(async function loadSiteContextInner(
  ref: string,
  preview: boolean,
  previewThemeSlug: string | undefined,
  siteParam: string | null | undefined,
): Promise<SiteContext | null> {
  const sb = createAdminClient();

  const { data: site } = await sb
    .from("host_websites")
    .select(
      "id, business_id, status, subdomain, custom_domain, brand, theme, seo, navigation, settings, published_snapshot, deleted_at, business:businesses ( default_language, trading_name )",
    )
    .or(`subdomain.eq.${ref},custom_domain.eq.${ref}`)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      business_id: string;
      status: string;
      subdomain: string;
      custom_domain: string | null;
      brand: Record<string, unknown> | null;
      theme: Record<string, unknown> | null;
      seo: Record<string, unknown> | null;
      navigation: Record<string, unknown> | null;
      settings: {
        conversion?: SiteConversion;
        analytics?: SiteAnalyticsSettings;
        layout?: "full" | "boxed";
        blog?: { heading?: string; intro?: string };
      } | null;
      published_snapshot: PublishSnapshot | null;
      business: {
        default_language: string | null;
        trading_name: string | null;
      } | null;
    }>();

  if (!site) return null;
  if (!preview && site.status !== "published") return null;

  // Public render reads the frozen snapshot (so unpublished edits don't leak);
  // preview — and legacy published sites with no snapshot yet — read live cols.
  const snap =
    !preview && site.status === "published" && site.published_snapshot
      ? site.published_snapshot
      : null;

  const brandJson = (snap?.brand ?? site.brand ?? {}) as Record<
    string,
    unknown
  >;
  const contact = (brandJson.contact ?? {}) as {
    email?: string;
    phone?: string;
  };
  const brand: SiteBrand = {
    name:
      (brandJson.name as string)?.trim() ||
      site.business?.trading_name ||
      site.subdomain,
    tagline: (brandJson.tagline as string) ?? null,
    logoUrl: websiteAssetUrl(brandJson.logo_path as string | undefined),
    logoLightUrl: websiteAssetUrl(
      brandJson.logo_light_path as string | undefined,
    ),
    logoIconUrl: websiteAssetUrl(
      brandJson.logo_icon_path as string | undefined,
    ),
    faviconUrl: websiteAssetUrl(brandJson.favicon_path as string | undefined),
    appleIconUrl: websiteAssetUrl(
      brandJson.apple_icon_path as string | undefined,
    ),
    logoMaxHeight:
      typeof brandJson.logo_max_height === "number"
        ? brandJson.logo_max_height
        : null,
    logoStyle: (brandJson.logo_style as SiteBrand["logoStyle"]) || "mark",
    contactEmail: contact.email?.trim() || null,
    contactPhone: contact.phone?.trim() || null,
    socials: (brandJson.socials ?? undefined) as SiteBrand["socials"],
  };
  // Theme preview: when a themeSlug is provided, load that theme's base instead
  // of using the site's stored theme. This enables the gallery's full-site preview.
  let theme: SiteThemeConfig;
  if (previewThemeSlug) {
    const previewBase = await resolveThemeBase(previewThemeSlug);
    theme = { preset: previewThemeSlug, base: previewBase };
  } else {
    theme = (snap?.theme ?? site.theme ?? {}) as SiteThemeConfig;
  }
  const seo = (snap?.seo ?? site.seo ?? {}) as Record<string, unknown>;
  const navigation = (snap?.navigation ??
    site.navigation ??
    {}) as SiteNavigation;
  // Conversion chrome reads the frozen snapshot publicly; preview/legacy live.
  const conversion = (snap?.conversion ??
    site.settings?.conversion ??
    {}) as SiteConversion;
  // Host analytics (GA4 + Meta Pixel) — same frozen-snapshot-then-live fallback.
  const analytics = (snap?.analytics ??
    site.settings?.analytics ??
    {}) as SiteAnalyticsSettings;
  // Site width — same frozen-snapshot-then-live fallback; default edge-to-edge.
  const layout = (snap?.layout ?? site.settings?.layout ?? "full") as
    | "full"
    | "boxed";
  // Blog index heading/intro — read live (cosmetic text, like the blog posts
  // themselves; not part of the publish snapshot, so edits show immediately).
  const blog = (site.settings?.blog ?? {}) as {
    heading?: string;
    intro?: string;
  };

  // Resolve the pop-up's embedded form live (its content stays current, like
  // rooms/blog) when one is referenced.
  let popupForm: SiteFormDef | null = null;
  const popupFormId = conversion.popup?.formId?.trim();
  if (popupFormId) {
    const { data: formRow } = await sb
      .from("website_forms")
      .select("id, name, type, fields, settings")
      .eq("id", popupFormId)
      .eq("website_id", site.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (formRow) popupForm = mapFormRow(formRow);
  }

  let nav: SiteNavItem[];
  let propertyIds: string[];
  let publishedRoomRows: SnapshotRoom[] | null;
  let publishedPropertyOverrides: Record<string, PropertyOverride> | null;

  if (snap) {
    nav = snap.nav ?? [];
    propertyIds = snap.propertyIds ?? [];
    publishedRoomRows = snap.rooms ?? [];
    publishedPropertyOverrides = snap.propertyOverrides ?? {};
  } else {
    const [{ data: pageRows }, { data: memberRows }] = await Promise.all([
      sb
        .from("website_pages")
        .select("kind, slug, nav_label, title, nav_order, show_in_nav")
        .eq("website_id", site.id)
        .eq("show_in_nav", true)
        .order("nav_order", { ascending: true }),
      sb
        .from("website_properties")
        .select("property_id, sort_order")
        .eq("website_id", site.id)
        .eq("is_visible", true)
        .order("sort_order", { ascending: true }),
    ]);
    nav = (pageRows ?? []).map((p) => ({
      label: p.nav_label?.trim() || p.title?.trim() || p.slug,
      href: pageHref(p.kind, p.slug),
    }));
    propertyIds = (memberRows ?? []).map((m) => m.property_id);
    publishedRoomRows = null;
    publishedPropertyOverrides = null;
  }

  // Theme-gallery preview: the nav reflects the PREVIEWED theme's own pages (its
  // demo composition), so the preview's menu matches the pages being shown — not
  // the host's existing pages. Live booking data (propertyIds/rooms) stays the
  // host's, so the preview shows real rooms in the theme design.
  if (previewThemeSlug) {
    const templates = await resolveThemePreviewPages(
      previewThemeSlug,
      brand.name,
    );
    const navTemplates = templates
      .filter((t) => t.show_in_nav)
      .sort((a, b) => a.nav_order - b.nav_order);
    if (navTemplates.length > 0) {
      nav = navTemplates.map((t) => ({
        label: t.nav_label?.trim() || t.title?.trim() || t.slug,
        href: pageHref(t.kind, t.slug),
      }));
    }
  }

  const locale = site.business?.default_language || "en";
  // On-site booking links are relative to the site root. On a real tenant host
  // that's "" (e.g. /book); when the site is rendered via the app-domain
  // ?site=<sub> testing affordance it must carry the /[locale]/site prefix so the
  // link resolves on the app domain too. siteParam is set only in that case.
  const bookBasePath = siteParam ? `/${locale}/site` : "";

  const ctx: SiteContext = {
    websiteId: site.id,
    businessId: site.business_id,
    subdomain: site.subdomain,
    status: site.status,
    preview,
    previewThemeSlug,
    locale,
    bookBasePath,
    brand,
    theme,
    seo,
    nav,
    navigation,
    conversion,
    analytics,
    blog,
    layout,
    popupForm,
    propertyIds,
    publishedRoomRows,
    publishedPropertyOverrides,
  };

  // Auto-rooms menu: fill the flagged item's dropdown with the site's current
  // rooms (minus hidden) so the menu is always up to date — public + preview.
  if (navigation.menu?.some((i) => i.autoRooms)) {
    const links = await roomMenuLinks(ctx);
    ctx.navigation = {
      ...navigation,
      menu: expandAutoRooms(navigation.menu, links),
    };
  }

  return ctx;
});

/**
 * Resolve a site by subdomain OR custom domain and build its chrome. Returns null
 * when no site matches (or it isn't published, in non-preview mode).
 *
 * Request-deduped via React `cache()` on primitive args, so a public page's
 * `generateMetadata` + render share a single context+page load instead of two.
 * Thin wrapper preserving the (ref, opts) signature for all callers.
 */
export function loadSiteContext(
  ref: string,
  opts: {
    preview?: boolean;
    themeSlug?: string;
    siteParam?: string | null;
  } = {},
): Promise<SiteContext | null> {
  return loadSiteContextCached(
    ref,
    opts.preview ?? false,
    opts.themeSlug,
    opts.siteParam ?? null,
  );
}

/**
 * Resolve page metadata (title/description/OG image/index flag) for a site path
 * — the SSOT for the route `generateMetadata` functions. Page-level
 * `seo_overrides` win over the site-level `seo`, which falls back to the brand
 * name/tagline. Returns null when the site (non-preview) isn't resolvable.
 */
export async function loadSiteMeta(
  ref: string,
  pathSlug: string[],
  opts: { preview?: boolean; postSlug?: string; roomSlug?: string } = {},
): Promise<{
  title: string;
  description?: string;
  ogImageUrl?: string;
  faviconUrl?: string;
  appleIconUrl?: string;
  robotsIndex: boolean;
  gscToken?: string;
  // Open Graph type — "article" for blog posts (with timestamps/author), else
  // "website". Lets social cards render blog posts as articles.
  ogType?: "website" | "article";
  publishedTime?: string;
  authorName?: string;
} | null> {
  const ctx = await loadSiteContext(ref, { preview: opts.preview });
  if (!ctx) return null;

  const seo = ctx.seo as {
    title?: string;
    description?: string;
    og_image_path?: string;
    gsc_token?: string;
    robots_index?: boolean;
  };
  const siteTitle = seo.title?.trim() || ctx.brand.name;
  const siteDesc = seo.description?.trim() || ctx.brand.tagline || undefined;

  let pageTitle: string | null = null;
  let pageDesc: string | undefined;
  // Per-page featured image (Page settings → og:image), wins over the site default.
  let pageOgPath: string | undefined;
  // Per-page search-engine opt-out (Page settings → noindex), overrides the site.
  let pageNoindex = false;
  // Already-resolved OG image URL (blog cover) — bypasses the path resolver.
  let pageOgUrl: string | undefined;
  let ogType: "website" | "article" = "website";
  let publishedTime: string | undefined;
  let authorName: string | undefined;

  if (opts.roomSlug) {
    const room = await loadRoomDetail(ctx, opts.roomSlug);
    if (room) {
      pageTitle = room.name;
      pageDesc = room.description?.slice(0, 200) ?? undefined;
    }
  } else if (opts.postSlug) {
    const post = await loadSiteBlogPost(ctx, opts.postSlug);
    if (post) {
      pageTitle = post.title;
      pageDesc = post.excerpt ?? undefined;
      // A shared blog post should card its own cover image + render as an article.
      pageOgUrl = post.coverUrl ?? undefined;
      ogType = "article";
      publishedTime = post.date ?? undefined;
      authorName = post.authorName ?? undefined;
    }
  } else {
    const result = await loadSitePage(ctx, pathSlug);
    if (result) {
      const ov = result.page.seoOverrides as {
        title?: string;
        description?: string;
        image?: string;
        noindex?: boolean;
      };
      pageTitle = ov.title?.trim() || result.page.title?.trim() || null;
      pageDesc = ov.description?.trim() || undefined;
      pageOgPath = ov.image?.trim() || undefined;
      pageNoindex = ov.noindex === true;
    }
  }

  const isHome = pathSlug.length === 0 && !opts.postSlug && !opts.roomSlug;
  const title =
    isHome || !pageTitle ? siteTitle : `${pageTitle} · ${siteTitle}`;

  return {
    title,
    description: pageDesc || siteDesc,
    ogImageUrl:
      pageOgUrl ??
      websiteAssetUrl(pageOgPath) ??
      websiteAssetUrl(seo.og_image_path) ??
      ctx.brand.logoUrl ??
      undefined,
    faviconUrl: ctx.brand.faviconUrl ?? undefined,
    appleIconUrl: ctx.brand.appleIconUrl ?? undefined,
    // Default to indexable; false when the site opts out OR this page is marked
    // noindex in its Page settings.
    robotsIndex: seo.robots_index !== false && !pageNoindex,
    gscToken: seo.gsc_token?.trim() || undefined,
    ogType,
    publishedTime,
    authorName,
  };
}

/**
 * Load one page (by path slug, [] = home) and assemble the live data for every
 * auto-populate section it contains. Returns null when the page doesn't exist.
 */
/** Section scheduling — the live site hides sections outside their date window;
 *  preview always shows them. Accepts YYYY-MM-DD or ISO date strings. */
function withinSchedule(schedule?: { start?: string; end?: string }): boolean {
  if (!schedule) return true;
  const now = Date.now();
  if (schedule.start) {
    const t = Date.parse(schedule.start);
    if (!Number.isNaN(t) && now < t) return false;
  }
  if (schedule.end) {
    const t = Date.parse(schedule.end);
    // A date-only end is inclusive for the whole day.
    const end = /^\d{4}-\d{2}-\d{2}$/.test(schedule.end) ? t + 86_400_000 : t;
    if (!Number.isNaN(t) && now > end) return false;
  }
  return true;
}

// ── Builder V2 (PageDoc) helpers ──────────────────────────────
// Collect the widget LEAVES of a PageDoc as pseudo-sections {id,type,props} so
// the existing type-keyed `assembleSectionData` builds the SiteData map keyed by
// node id — exactly the ids `PageDocRenderer` renders under.
function pageDocLeafSections(doc: PageDoc): WebsiteSection[] {
  const out: WebsiteSection[] = [];
  const walk = (
    kids: Array<{
      id: string;
      type: string;
      kids?: unknown[];
      props?: unknown;
    }>,
  ) => {
    for (const n of kids) {
      if (Array.isArray(n.kids)) {
        walk(n.kids as typeof kids);
      } else {
        out.push({
          id: n.id,
          type: n.type,
          enabled: true,
          props: (n.props ?? {}) as Record<string, unknown>,
        } as unknown as WebsiteSection);
      }
    }
  };
  walk(doc.root.kids as unknown as Parameters<typeof walk>[0]);
  return out;
}

/** Sanitise the free-form HTML on `rich_text` widget leaves (mirrors
 *  sanitiseSectionsHtml for the nested model). Returns a fresh doc. */
function sanitisePageDoc(doc: PageDoc): PageDoc {
  const clone = structuredClone(doc);
  const walk = (
    kids: Array<{
      kids?: unknown[];
      type?: string;
      props?: Record<string, unknown>;
    }>,
  ) => {
    for (const n of kids) {
      if (Array.isArray(n.kids)) {
        walk(n.kids as typeof kids);
      } else if (
        n.type === "rich_text" &&
        n.props &&
        typeof n.props.html === "string"
      ) {
        n.props.html = sanitiseListingHtml(n.props.html as string);
      }
    }
  };
  walk(clone.root.kids as unknown as Parameters<typeof walk>[0]);
  return clone;
}

const loadSitePageCached = cache(async function loadSitePageInner(
  ctx: SiteContext,
  slug: string,
): Promise<SitePageResult | null> {
  const sb = createAdminClient();
  const isHome = slug.length === 0;

  // Theme-gallery full-site PREVIEW: when browsing a theme via `?theme=<slug>`,
  // render that theme's OWN designed page templates (its demo composition) rather
  // than the host's stored pages tinted with the theme — so "preview" shows the
  // actual theme design. Falls through to the host's pages for any kind the theme
  // doesn't ship a template for (e.g. custom pages).
  if (ctx.previewThemeSlug) {
    const templates = await resolveThemePreviewPages(
      ctx.previewThemeSlug,
      ctx.brand.name,
    );
    const tpl = templates.find((t) =>
      isHome ? t.kind === "home" : t.slug === slug || t.kind === slug,
    );
    if (tpl) {
      const sections = sanitiseSectionsHtml(parseSectionsLoose(tpl.sections));
      const data = await assembleSectionData(sb, ctx, sections);
      return {
        page: {
          id: `preview-${ctx.previewThemeSlug}-${tpl.kind}`,
          kind: tpl.kind,
          slug: tpl.slug,
          title: tpl.title ?? null,
          seoOverrides: {},
        },
        sections,
        data,
      };
    }
  }

  let query = sb
    .from("website_pages")
    .select(
      "id, kind, slug, title, seo_overrides, draft_sections, published_sections",
    )
    .eq("website_id", ctx.websiteId);
  query = isHome ? query.eq("kind", "home") : query.eq("slug", slug);

  const { data: pageRow } = await query.maybeSingle<{
    id: string;
    kind: string;
    slug: string;
    title: string | null;
    seo_overrides: Record<string, unknown> | null;
    draft_sections: unknown;
    published_sections: unknown;
  }>();

  if (!pageRow) return null;

  const pageMeta: SitePageMeta = {
    id: pageRow.id,
    kind: pageRow.kind,
    slug: pageRow.slug,
    title: pageRow.title,
    seoOverrides: pageRow.seo_overrides ?? {},
  };

  const raw = ctx.preview ? pageRow.draft_sections : pageRow.published_sections;

  // Builder V2 (v:2): a stored PageDoc renders through the token PageDocRenderer.
  // Data is assembled from its widget leaves (keyed by node id); legacy flat
  // pages fall through to the unchanged array path below.
  if (isPageDoc(raw)) {
    const parsed = parsePageDocLoose(raw);
    if (parsed) {
      const docSan = sanitisePageDoc(parsed);
      const data = await assembleSectionData(
        sb,
        ctx,
        pageDocLeafSections(docSan),
      );
      return { page: pageMeta, sections: [], data, doc: docSan };
    }
  }

  const sections = sanitiseSectionsHtml(parseSectionsLoose(raw)).filter(
    (s) => ctx.preview || withinSchedule(s.schedule),
  );

  const data = await assembleSectionData(sb, ctx, sections);

  return { page: pageMeta, sections, data };
});

/**
 * Resolve a site page (sections + auto-populate data) for a path. Request-deduped
 * via React `cache()` (keyed on the resolved ctx + joined slug) so a public
 * page's generateMetadata + render share one section assembly. Thin wrapper keeps
 * the (ctx, pathSlug[]) signature for all callers.
 */
export function loadSitePage(
  ctx: SiteContext,
  pathSlug: string[],
): Promise<SitePageResult | null> {
  return loadSitePageCached(ctx, pathSlug.join("/"));
}

type Sb = ReturnType<typeof createAdminClient>;

function firstNameLastInitial(name: string | null | undefined): string {
  if (!name) return "Guest";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Build a link into the ON-SITE checkout (Phase 6B/c), relative to the site root
 * so it stays on the host's own domain. Always carries `?property=…` (so a `&`
 * suffix is always valid for the funnel widgets that append dates client-side);
 * adds `&site=` when rendered via the app-domain ?site= testing affordance.
 */
export function siteBookHref(
  ctx: Pick<SiteContext, "bookBasePath" | "subdomain" | "preview">,
  params: {
    propertyId?: string;
    roomId?: string;
    from?: string;
    to?: string;
    guests?: number;
  },
): string {
  const qs = new URLSearchParams();
  if (params.propertyId) qs.set("property", params.propertyId);
  if (params.roomId) qs.set("room", params.roomId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.guests != null) qs.set("guests", String(params.guests));
  if (ctx.bookBasePath) qs.set("site", ctx.subdomain);
  // Stay in preview so a "Book" tap from a draft/unpublished site keeps rendering
  // the themed checkout in preview mode instead of 404ing on the live route.
  if (ctx.preview) qs.set("preview", "1");
  const q = qs.toString();
  return `${ctx.bookBasePath}/book${q ? `?${q}` : ""}`;
}

/**
 * Link to a room's detail page (`/rooms/<slug>`), relative to the site root so it
 * stays on the host's own domain; adds `?site=` on the app-domain ?site=
 * affordance, and `&preview=1` when previewing so a clicked room keeps rendering
 * in preview mode (draft sections, unpublished sites) instead of 404ing.
 */
export function siteRoomHref(
  ctx: Pick<SiteContext, "bookBasePath" | "subdomain" | "preview">,
  slug: string,
): string {
  const qs = new URLSearchParams();
  if (ctx.bookBasePath) qs.set("site", ctx.subdomain);
  if (ctx.preview) qs.set("preview", "1");
  const q = qs.toString();
  return `${ctx.bookBasePath}/rooms/${encodeURIComponent(slug)}${q ? `?${q}` : ""}`;
}

/**
 * Link to the system search-results page (`/search-results`), relative to the
 * site root (keeps the guest on the host's own domain); carries `?site=` on the
 * app-domain ?site= affordance and `&preview=1` when previewing. The search
 * widget appends `&from=&to=&guests=` client-side at search time.
 */
export function siteSearchHref(
  ctx: Pick<SiteContext, "bookBasePath" | "subdomain" | "preview">,
): string {
  const qs = new URLSearchParams();
  if (ctx.bookBasePath) qs.set("site", ctx.subdomain);
  if (ctx.preview) qs.set("preview", "1");
  const q = qs.toString();
  return `${ctx.bookBasePath}/search-results${q ? `?${q}` : ""}`;
}

/** Humanise an enum value ("sea_view" → "Sea view"). */
function humaniseEnum(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}

/**
 * Build a stable URL slug per visible room from its display name. Disambiguates
 * name collisions deterministically by order (`-2`, `-3`), so the same input
 * order always yields the same slugs (and the room route can recompute + match).
 */
export function roomSlugMap(
  ordered: Array<{ roomId: string; name: string }>,
): Map<string, string> {
  const seen = new Map<string, number>();
  const out = new Map<string, string>();
  for (const r of ordered) {
    const base = slugify(r.name) || "room";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.set(r.roomId, n === 1 ? base : `${base}-${n}`);
  }
  return out;
}

/** Short facts from a live room row (cosmetic — no booking impact). */
function roomFacts(room: {
  max_guests: number | null;
  bedrooms: number | null;
  bathrooms?: number | null;
  bed_type: string | null;
  has_ensuite_bathroom: boolean | null;
  room_size_sqm?: number | null;
  view_type?: string | null;
}): string[] {
  const facts: string[] = [];
  if (room.max_guests) facts.push(`Sleeps ${room.max_guests}`);
  if (room.bedrooms)
    facts.push(`${room.bedrooms} ${room.bedrooms === 1 ? "bed" : "beds"}`);
  if (room.bed_type) facts.push(room.bed_type);
  if (room.has_ensuite_bathroom) facts.push("Ensuite");
  if (room.room_size_sqm) facts.push(`${room.room_size_sqm} m²`);
  const view = humaniseEnum(room.view_type);
  if (view) facts.push(view);
  return facts;
}

/** Deep-link into the special booking flow, tagged as a website-channel booking. */
function specialBookHref(locale: string, slug: string): string {
  const path = `/${locale}/deal/${slug}/book?via=website`;
  return APP_URL ? `${APP_URL}${path}` : path;
}

type SpecialPreviewRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  hero_image_path: string | null;
  badge: string | null;
  date_mode: string;
  fixed_check_out: string | null;
  window_end: string | null;
  price_mode: string;
  flat_total: number | null;
  per_night_price: number | null;
  currency: string;
  quantity: number;
  redemptions_used: number;
  go_live_at: string | null;
  book_by: string | null;
  was_price: number | null;
  savings_amount: number | null;
  savings_pct: number | null;
  is_featured: boolean | null;
  sort_order: number | null;
  property:
    | {
        deleted_at: string | null;
        photos: Array<{ url: string; sort_order: number }> | null;
      }
    | Array<{
        deleted_at: string | null;
        photos: Array<{ url: string; sort_order: number }> | null;
      }>
    | null;
};

/**
 * Active, website-opted-in specials for this site's business → SpecialCard[].
 * Mirrors the cross-host directory's JS guards (live / still-bookable / not in
 * the past / not sold out); the special's own `show_on_website` flag is the
 * opt-in, so this is business-scoped and ignores property channel membership.
 */
async function loadSpecialsPreview(
  sb: Sb,
  ctx: SiteContext,
): Promise<SiteDataByType["specials_preview"]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from("specials")
    .select(
      "id, slug, title, description, hero_image_path, badge, date_mode, fixed_check_out, window_end, price_mode, flat_total, per_night_price, currency, quantity, redemptions_used, go_live_at, book_by, was_price, savings_amount, savings_pct, is_featured, sort_order, property:properties!inner ( deleted_at, photos:property_photos ( url, sort_order ) )",
    )
    .eq("business_id", ctx.businessId)
    .eq("status", "active")
    .eq("show_on_website", true)
    .is("deleted_at", null);

  const rows = (data ?? []) as unknown as SpecialPreviewRow[];
  const mapped: Array<{ card: SpecialCard; featured: boolean; order: number }> =
    [];
  for (const r of rows) {
    const property = Array.isArray(r.property) ? r.property[0] : r.property;
    if (!property || property.deleted_at) continue;
    if (!r.slug) continue;

    // Date / inventory guards (mirror the directory + booking action predicates).
    if (r.go_live_at && r.go_live_at > today) continue;
    if (r.book_by && r.book_by < today) continue;
    const stayEnd = r.date_mode === "fixed" ? r.fixed_check_out : r.window_end;
    if (stayEnd && stayEnd <= today) continue;
    const remaining = Math.max(0, r.quantity - r.redemptions_used);
    if (remaining <= 0) continue;

    const photos = property.photos ?? [];
    const fallbackPhoto = [...photos].sort(
      (a, b) => a.sort_order - b.sort_order,
    )[0]?.url;
    const imageUrl =
      websiteAssetUrl(r.hero_image_path ?? undefined) ?? fallbackPhoto ?? null;
    const priceMode = r.price_mode === "per_night" ? "per_night" : "flat";
    const price =
      priceMode === "flat"
        ? r.flat_total == null
          ? null
          : Number(r.flat_total)
        : r.per_night_price == null
          ? null
          : Number(r.per_night_price);

    mapped.push({
      featured: !!r.is_featured,
      order: r.sort_order ?? 0,
      card: {
        id: r.id,
        title: r.title,
        slug: r.slug,
        description: r.description,
        imageUrl,
        badge: r.badge,
        priceMode,
        price,
        currency: r.currency,
        wasPrice: r.was_price == null ? null : Number(r.was_price),
        savingsAmount:
          r.savings_amount == null ? null : Number(r.savings_amount),
        savingsPct: r.savings_pct,
        remaining,
        bookHref: specialBookHref(ctx.locale, r.slug),
      },
    });
  }

  // Featured first, then host sort order, for a stable merchandised order.
  mapped.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.order - b.order;
  });

  return { specials: mapped.map((m) => m.card) };
}

const SUPA_STORAGE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";

/** Resolve an `addon-images` storage path to its public URL (the bucket is
 *  public). Absolute URLs / data URIs pass through. */
function addonImageUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^(https?:\/\/|data:)/.test(path)) return path;
  return SUPA_STORAGE_URL
    ? `${SUPA_STORAGE_URL}/storage/v1/object/public/addon-images/${path}`
    : null;
}

type AddonPreviewRow = {
  addon:
    | {
        id: string;
        name: string;
        description: string | null;
        image_path: string | null;
        pricing_model: string;
        unit_price: number | string | null;
        currency: string | null;
        is_required: boolean | null;
        is_active: boolean | null;
        sort_order: number | null;
      }
    | Array<{
        id: string;
        name: string;
        description: string | null;
        image_path: string | null;
        pricing_model: string;
        unit_price: number | string | null;
        currency: string | null;
        is_required: boolean | null;
        is_active: boolean | null;
        sort_order: number | null;
      }>
    | null;
};

/**
 * The host's active add-ons available on this site's properties → AddonCard[].
 * Scoped via `property_addons` (which properties offer each add-on), deduped by
 * add-on (an add-on attached to several properties/rooms shows once), in the
 * host's catalogue sort order. Display-only — checkout always re-prices.
 */
async function loadAddonsPreview(
  sb: Sb,
  ctx: SiteContext,
): Promise<SiteDataByType["addons_preview"]> {
  if (!ctx.propertyIds.length) return { addons: [] };
  const { data } = await sb
    .from("property_addons")
    .select(
      "addon:addons!inner ( id, name, description, image_path, pricing_model, unit_price, currency, is_required, is_active, sort_order )",
    )
    .in("property_id", ctx.propertyIds);

  const rows = (data ?? []) as unknown as AddonPreviewRow[];
  const seen = new Set<string>();
  const cards: Array<{ card: AddonCard; order: number }> = [];
  for (const r of rows) {
    const a = Array.isArray(r.addon) ? r.addon[0] : r.addon;
    if (!a || !a.is_active || seen.has(a.id)) continue;
    seen.add(a.id);
    cards.push({
      order: a.sort_order ?? 0,
      card: {
        id: a.id,
        name: a.name,
        description: a.description,
        imageUrl: addonImageUrl(a.image_path),
        pricingModel: a.pricing_model,
        price: a.unit_price == null ? null : Number(a.unit_price),
        currency: a.currency,
        required: !!a.is_required,
      },
    });
  }
  cards.sort((x, y) => x.order - y.order);
  return { addons: cards.map((c) => c.card) };
}

/**
 * Build the SiteData map — one query batch per auto-populate section type present.
 * Resolves the live data once per TYPE (via {@link assembleSiteDataByType}) then
 * fans it out to each section's id, so two `rooms_preview` sections share a query.
 */
async function assembleSectionData(
  sb: Sb,
  ctx: SiteContext,
  sections: WebsiteSection[],
  activeRoom?: RoomDetail | null,
): Promise<SiteData> {
  const types = new Set(sections.map((s) => s.type));
  const byType = await assembleSiteDataByType(sb, ctx, types);
  const data: SiteData = {};
  // Room-scoped sections (room_gallery/overview/amenities/rate) all render the
  // SAME active room. The room route passes it; on any other page it's absent so
  // these sections render their own empty/placeholder state.
  if (activeRoom) {
    for (const s of sections) {
      if (isRoomScoped(s.type))
        data[s.id] = {
          type: s.type,
          data: activeRoom,
        } as SiteData[string];
    }
  }
  for (const s of sections) {
    switch (s.type) {
      case "gallery":
        if (byType.gallery)
          data[s.id] = { type: "gallery", data: byType.gallery };
        break;
      case "rooms_preview":
        if (byType.rooms_preview)
          data[s.id] = { type: "rooms_preview", data: byType.rooms_preview };
        break;
      case "location":
        if (byType.location)
          data[s.id] = { type: "location", data: byType.location };
        break;
      case "reviews":
        if (byType.reviews)
          data[s.id] = { type: "reviews", data: byType.reviews };
        break;
      case "blog_preview":
        if (byType.blog_preview)
          data[s.id] = { type: "blog_preview", data: byType.blog_preview };
        break;
      case "specials_preview":
        if (byType.specials_preview)
          data[s.id] = {
            type: "specials_preview",
            data: byType.specials_preview,
          };
        break;
      case "addons_preview":
        if (byType.addons_preview)
          data[s.id] = {
            type: "addons_preview",
            data: byType.addons_preview,
          };
        break;
      case "form":
        if (byType.form) data[s.id] = { type: "form", data: byType.form };
        break;
      case "trust":
        if (byType.trust) data[s.id] = { type: "trust", data: byType.trust };
        break;
      case "policies":
        if (byType.policies)
          data[s.id] = { type: "policies", data: byType.policies };
        break;
      case "booking_search":
        if (byType.booking_search)
          data[s.id] = {
            type: "booking_search",
            data: byType.booking_search,
          };
        break;
      case "search_results":
        if (byType.search_results)
          data[s.id] = {
            type: "search_results",
            data: byType.search_results,
          };
        break;
      case "availability_calendar":
        if (byType.availability_calendar)
          data[s.id] = {
            type: "availability_calendar",
            data: byType.availability_calendar,
          };
        break;
      case "rate_table":
        if (byType.rate_table)
          data[s.id] = { type: "rate_table", data: byType.rate_table };
        break;
      case "room_rates":
        if (byType.room_rates)
          data[s.id] = { type: "room_rates", data: byType.room_rates };
        break;
      case "seasonal_pricing":
        if (byType.seasonal_pricing)
          data[s.id] = {
            type: "seasonal_pricing",
            data: byType.seasonal_pricing,
          };
        break;
      default:
        break;
    }
  }
  return data;
}

/** Parse one `website_forms` row into its public-render definition (SSOT). */
function mapFormRow(f: {
  id: string;
  name: string;
  type: string;
  fields: unknown;
  settings: unknown;
}): SiteFormDef {
  const fields = formFieldsSchema.safeParse(f.fields);
  const settings = formSettingsSchema.safeParse(f.settings ?? {});
  return {
    id: f.id,
    name: f.name,
    type: f.type as FormType,
    fields: fields.success ? fields.data : [],
    settings: settings.success ? settings.data : formSettingsSchema.parse({}),
  };
}

/**
 * Resolve every form for this website into its public-render definition. Forms
 * aren't property-scoped, so this is website-scoped (like specials). A `form`
 * section picks its own definition by props.form_id from this pool.
 */
async function loadSiteForms(
  sb: Sb,
  ctx: SiteContext,
): Promise<SiteDataByType["form"]> {
  const { data } = await sb
    .from("website_forms")
    .select("id, name, type, fields, settings")
    .eq("website_id", ctx.websiteId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const forms: SiteFormDef[] = (data ?? []).map((f) =>
    mapFormRow(f as Parameters<typeof mapFormRow>[0]),
  );

  // Auto-populate every `rooms` field with the host's REAL current rooms (mirror
  // the nav auto-rooms): the field type IS "my rooms", so the live, visible-room
  // names always win over whatever placeholder options were stored. Resolved once
  // and shared across all forms. Snapshot-aware via orderedVisibleRooms, so the
  // published site and the live preview both show the right set.
  const hasRoomsField = forms.some((form) =>
    form.fields.some((field) => field.type === "rooms"),
  );
  if (hasRoomsField) {
    const { ordered } = await orderedVisibleRooms(sb, ctx);
    const roomNames = ordered.map((o) => o.name);
    if (roomNames.length > 0) {
      for (const form of forms) {
        for (const field of form.fields) {
          if (field.type === "rooms") field.options = roomNames;
        }
      }
    }
  }

  return { forms };
}

/**
 * The site's bookable properties (visible channel members) for the funnel
 * widgets — booking_search + availability_calendar. Carries only selector +
 * deep-link data; pricing/availability resolve live via the API endpoints.
 */
async function loadBookableProperties(
  sb: Sb,
  ctx: SiteContext,
): Promise<SiteDataByType["booking_search"]> {
  const ids = ctx.propertyIds;
  if (ids.length === 0)
    return {
      websiteId: ctx.websiteId,
      properties: [],
      searchHref: siteSearchHref(ctx),
    };
  const { data } = await sb
    .from("properties")
    .select("id, slug, name, currency, min_nights, max_guests")
    .in("id", ids)
    // A property soft-deleted after publish (before re-publish) lingers in the
    // frozen snapshot's propertyIds — exclude it so it doesn't surface on the site.
    .is("deleted_at", null);
  const byId = new Map((data ?? []).map((p) => [(p as { id: string }).id, p]));
  const properties: BookableProperty[] = [];
  for (const id of ids) {
    const p = byId.get(id) as {
      id: string;
      slug: string | null;
      name: string | null;
      currency: string | null;
      min_nights: number | null;
      max_guests: number | null;
    } | null;
    if (!p) continue;
    const slug = p.slug ?? "";
    properties.push({
      id: p.id,
      slug,
      name: p.name?.trim() || slug,
      currency: p.currency ?? "ZAR",
      minNights: p.min_nights ?? 1,
      maxGuests: p.max_guests ?? 10,
      bookBase: siteBookHref(ctx, { propertyId: p.id }),
    });
  }
  return {
    websiteId: ctx.websiteId,
    properties,
    searchHref: siteSearchHref(ctx),
  };
}

/**
 * Live nightly-rate table across the site's visible rooms (display-only — the
 * booking engine always re-prices). Resolves the same visible-room set as
 * rooms_preview (frozen snapshot rows, else live website_rooms) ⨝ the live
 * property_rooms for current price/active state.
 */
async function loadRateTable(
  sb: Sb,
  ctx: SiteContext,
): Promise<SiteDataByType["rate_table"]> {
  // Visible room ids + any display-price/currency override (snapshot or live).
  let overrideRows: Pick<
    SnapshotRoom,
    "room_id" | "display_price" | "display_currency" | "display_name"
  >[];
  if (ctx.publishedRoomRows) {
    overrideRows = ctx.publishedRoomRows
      .filter((r) => r.is_visible)
      .sort((a, b) => a.sort_order - b.sort_order);
  } else {
    const { data: wr } = await sb
      .from("website_rooms")
      .select(
        "room_id, display_price, display_currency, display_name, sort_order",
      )
      .eq("website_id", ctx.websiteId)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });
    overrideRows = (wr ?? []).map((r) => ({
      room_id: (r as { room_id: string }).room_id,
      display_price: (r as { display_price: number | string | null })
        .display_price as number | null,
      display_currency: (r as { display_currency: string | null })
        .display_currency,
      display_name: (r as { display_name: string | null }).display_name,
    }));
  }

  const roomIds = overrideRows.map((r) => r.room_id).filter(Boolean);
  if (roomIds.length === 0) return { rows: [] };

  const { data: prRows } = await sb
    .from("property_rooms")
    .select(
      "id, name, base_price, weekend_price, currency, property_id, is_active, deleted_at, max_guests, min_nights",
    )
    .in("id", roomIds);
  const roomById = new Map(
    (prRows ?? []).map((r) => [(r as { id: string }).id, r]),
  );

  // Property slug + name for the per-room deep-link / grouping label.
  const propIds = [
    ...new Set(
      (prRows ?? []).map((r) => (r as { property_id: string }).property_id),
    ),
  ];
  const propById = new Map<string, { slug: string; name: string | null }>();
  if (propIds.length > 0) {
    const { data: props } = await sb
      .from("properties")
      .select("id, slug, name")
      .in("id", propIds)
      // Skip rooms whose property was soft-deleted after publish (see below).
      .is("deleted_at", null);
    for (const p of props ?? []) {
      propById.set((p as { id: string }).id, {
        slug: (p as { slug: string | null }).slug ?? "",
        name: (p as { name: string | null }).name,
      });
    }
  }

  const rows: RateRow[] = overrideRows
    .map((ov): RateRow | null => {
      const room = roomById.get(ov.room_id) as {
        id: string;
        name: string;
        base_price: number | string | null;
        weekend_price: number | string | null;
        currency: string | null;
        property_id: string;
        is_active: boolean | null;
        deleted_at: string | null;
        max_guests: number | null;
        min_nights: number | null;
      } | null;
      if (!room || room.is_active === false || room.deleted_at) return null;
      const prop = propById.get(room.property_id);
      // Property soft-deleted after publish → not in propById (guarded above).
      if (!prop) return null;
      const nightly = ov.display_price ?? room.base_price;
      return {
        roomId: room.id,
        name: ov.display_name?.trim() || room.name,
        propertyId: room.property_id,
        propertyName: prop?.name ?? null,
        nightlyFrom: nightly == null ? null : Number(nightly),
        weekendPrice:
          room.weekend_price == null ? null : Number(room.weekend_price),
        currency: ov.display_currency || room.currency || "ZAR",
        minNights: room.min_nights ?? null,
        maxGuests: room.max_guests ?? null,
        bookHref: siteBookHref(ctx, {
          propertyId: room.property_id,
          roomId: room.id,
        }),
      };
    })
    .filter((r): r is RateRow => r !== null);

  return { rows };
}

/**
 * The host's configured seasonal pricing for the site's properties, aggregated
 * into a display-only list for the editable Seasonal pricing block (source
 * "auto"). Reads the live `property_seasonal_pricing` rules (listing_id keeps its
 * name post-rename → references properties), groups by label across all the
 * site's properties, and reduces each label to one date range + a "from" price.
 */
async function loadSeasonalPricing(
  sb: Sb,
  ctx: SiteContext,
): Promise<SiteDataByType["seasonal_pricing"]> {
  const ids = ctx.propertyIds;
  if (ids.length === 0) return { seasons: [] };
  const { data } = await sb
    .from("property_seasonal_pricing")
    .select("label, start_date, end_date, price, currency, is_active")
    .in("listing_id", ids)
    .eq("is_active", true);
  type Row = {
    label: string;
    start_date: string;
    end_date: string;
    price: number | string | null;
    currency: string | null;
  };
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { seasons: [] };

  // Group by label → earliest start, latest end, lowest price.
  const byLabel = new Map<
    string,
    { start: string; end: string; price: number | null; currency: string }
  >();
  for (const r of rows) {
    const label = (r.label ?? "").trim();
    if (!label) continue;
    const price = r.price == null ? null : Number(r.price);
    const cur = byLabel.get(label);
    if (!cur) {
      byLabel.set(label, {
        start: r.start_date,
        end: r.end_date,
        price,
        currency: r.currency || "ZAR",
      });
      continue;
    }
    if (r.start_date < cur.start) cur.start = r.start_date;
    if (r.end_date > cur.end) cur.end = r.end_date;
    if (price != null && (cur.price == null || price < cur.price))
      cur.price = price;
  }

  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-ZA", {
      day: "numeric",
      month: "short",
    }).format(d);
  };

  const seasons = [...byLabel.entries()]
    .sort((a, b) => (a[1].start < b[1].start ? -1 : 1))
    .map(([label, v]) => ({
      label,
      dates: `${fmt(v.start)} – ${fmt(v.end)}`,
      priceFrom: v.price,
      currency: v.currency,
    }));

  return { seasons };
}

/**
 * Resolve the live data for each requested auto-populate section TYPE (keyed by
 * type, not section id) — the SSOT used by both the public renderer
 * ({@link assembleSectionData}) and the dashboard builder preview, which asks for
 * every auto type so newly-added sections render real data instantly.
 */
export async function assembleSiteDataByType(
  sb: Sb,
  ctx: SiteContext,
  types: Set<SectionType>,
): Promise<Partial<SiteDataByType>> {
  const out: Partial<SiteDataByType> = {};

  // SPECIALS — business-scoped: the special's own `show_on_website` flag governs
  // (independent of property channel membership), so resolve it before the
  // property-id guard that the other sections rely on.
  if (types.has("specials_preview")) {
    out.specials_preview = await loadSpecialsPreview(sb, ctx);
  }

  // ADD-ONS — scoped to the site's properties (listing_addons). Self-guards on an
  // empty property set, so it's safe to resolve here alongside specials.
  if (types.has("addons_preview")) {
    out.addons_preview = await loadAddonsPreview(sb, ctx);
  }

  // FORMS — website-scoped (not property-scoped), so resolve before the guard.
  if (types.has("form")) {
    out.form = await loadSiteForms(sb, ctx);
  }

  // BOOKING FUNNEL — search + calendar share the bookable-property set; the rate
  // table reads website_rooms. Resolve before the property-id guard so the
  // widgets always carry the website id (they render even with no properties).
  if (
    types.has("booking_search") ||
    types.has("availability_calendar") ||
    types.has("search_results")
  ) {
    const funnel = await loadBookableProperties(sb, ctx);
    if (types.has("booking_search")) out.booking_search = funnel;
    if (types.has("search_results")) out.search_results = funnel;
    if (types.has("availability_calendar")) out.availability_calendar = funnel;
  }
  if (types.has("rate_table")) {
    out.rate_table = await loadRateTable(sb, ctx);
  }
  // Editable rates blocks (default source "auto") — room_rates reuses the live
  // rate rows; seasonal_pricing reads the host's configured seasonal rules.
  if (types.has("room_rates")) {
    out.room_rates = await loadRateTable(sb, ctx);
  }
  if (types.has("seasonal_pricing")) {
    out.seasonal_pricing = await loadSeasonalPricing(sb, ctx);
  }

  const ids = ctx.propertyIds;
  if (ids.length === 0) return out;

  // Resolve property slugs once (needed by location; rooms/rate links use ids).
  const needsSlugs = types.has("location");
  const slugByProperty = new Map<string, string>();
  let primaryProperty: {
    id: string;
    city: string | null;
    province: string | null;
    country: string | null;
  } | null = null;
  if (needsSlugs) {
    const { data: props } = await sb
      .from("properties")
      .select("id, slug, city, province, country")
      .in("id", ids);
    for (const p of props ?? []) {
      slugByProperty.set(p.id, (p as { slug: string | null }).slug ?? "");
    }
    // Primary = first by channel sort order (ids are already ordered).
    const first =
      (props ?? []).find((p) => p.id === ids[0]) ?? (props ?? [])[0];
    if (first)
      primaryProperty = {
        id: first.id,
        city: (first as { city: string | null }).city,
        province: (first as { province: string | null }).province,
        country: (first as { country: string | null }).country,
      };
  }

  await Promise.all([
    // GALLERY — property photos across visible properties.
    (async () => {
      if (!types.has("gallery")) return;
      const { data: photos } = await sb
        .from("property_photos")
        .select(
          "url, sort_order, property_id, property:properties!inner(deleted_at)",
        )
        .in("property_id", ids)
        .order("sort_order", { ascending: true })
        .limit(60);
      const images: GalleryImage[] = (photos ?? [])
        // Drop photos of a property soft-deleted after publish (lingers in the
        // frozen snapshot's propertyIds). The embed types as an array.
        .filter((p) => {
          const prop = (
            p as unknown as {
              property?:
                | { deleted_at: string | null }
                | { deleted_at: string | null }[]
                | null;
            }
          ).property;
          const row = Array.isArray(prop) ? prop[0] : prop;
          return !row?.deleted_at;
        })
        .map((p) => ({
          url: (p as { url: string }).url,
          caption: null,
        }));
      out.gallery = { images };
    })(),

    // ROOMS — visible website_rooms overrides ⨝ live property_rooms.
    // Public render uses the frozen snapshot rows (ctx.publishedRoomRows);
    // preview / legacy reads website_rooms live. Either way the live
    // property_rooms supply current price/active state and photos.
    (async () => {
      if (!types.has("rooms_preview")) return;

      let overrideRows: SnapshotRoom[];
      if (ctx.publishedRoomRows) {
        overrideRows = ctx.publishedRoomRows
          .filter((r) => r.is_visible)
          .sort((a, b) => a.sort_order - b.sort_order);
      } else {
        const { data: wr } = await sb
          .from("website_rooms")
          .select(
            "room_id, is_visible, featured, badge, display_name, display_price, display_currency, display_desc, sort_order",
          )
          .eq("website_id", ctx.websiteId)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true });
        overrideRows = (wr ?? []).map((r) => ({
          room_id: (r as { room_id: string }).room_id,
          is_visible: true,
          featured: (r as { featured: boolean | null }).featured ?? false,
          badge: (r as { badge: string | null }).badge,
          display_name: (r as { display_name: string | null }).display_name,
          display_price: (r as { display_price: number | string | null })
            .display_price as number | null,
          display_currency: (r as { display_currency: string | null })
            .display_currency,
          display_desc: (r as { display_desc: string | null }).display_desc,
          sort_order: (r as { sort_order: number }).sort_order,
        }));
      }

      const roomIds = overrideRows.map((r) => r.room_id).filter(Boolean);
      if (roomIds.length === 0) {
        out.rooms_preview = { rooms: [] };
        return;
      }

      // Per-property group overrides: from the snapshot (published) or live.
      let propOverrides: Record<string, PropertyOverride> = {};
      if (ctx.publishedPropertyOverrides) {
        propOverrides = ctx.publishedPropertyOverrides;
      } else {
        const { data: wp } = await sb
          .from("website_properties")
          .select("property_id, display_overrides")
          .eq("website_id", ctx.websiteId);
        for (const p of wp ?? []) {
          propOverrides[(p as { property_id: string }).property_id] = ((
            p as { display_overrides: PropertyOverride | null }
          ).display_overrides ?? {}) as PropertyOverride;
        }
      }

      const [{ data: prRows }, { data: rphotos }] = await Promise.all([
        sb
          .from("property_rooms")
          .select(
            "id, name, description, base_price, currency, property_id, is_active, deleted_at, max_guests, bedrooms, bed_type, has_ensuite_bathroom",
          )
          .in("id", roomIds),
        sb
          .from("property_photos")
          .select("url, room_id, sort_order")
          .in("room_id", roomIds)
          .order("sort_order", { ascending: true }),
      ]);

      const roomById = new Map(
        (prRows ?? []).map((r) => [(r as { id: string }).id, r]),
      );
      const photoByRoom = new Map<string, string>();
      for (const p of rphotos ?? []) {
        const rid = (p as { room_id: string | null }).room_id;
        if (rid && !photoByRoom.has(rid))
          photoByRoom.set(rid, (p as { url: string }).url);
      }

      // Slug per visible room (same algorithm the room route uses to resolve a
      // slug back to a room), so each card deep-links to its detail page.
      const slugByRoom = roomSlugMap(
        overrideRows.map((ov) => {
          const r = roomById.get(ov.room_id) as { name: string } | undefined;
          return {
            roomId: ov.room_id,
            name: ov.display_name?.trim() || r?.name || "Room",
          };
        }),
      );

      const usedProps = new Set<string>();
      const rooms: RoomCard[] = overrideRows
        .map((ov): RoomCard | null => {
          const room = roomById.get(ov.room_id) as {
            id: string;
            name: string;
            description: string | null;
            base_price: number | string | null;
            currency: string | null;
            property_id: string;
            is_active: boolean | null;
            deleted_at: string | null;
            max_guests: number | null;
            bedrooms: number | null;
            bed_type: string | null;
            has_ensuite_bathroom: boolean | null;
          } | null;
          if (!room || room.is_active === false || room.deleted_at) return null;
          usedProps.add(room.property_id);
          const price = ov.display_price ?? room.base_price;
          // A few facts derived from the live room (cosmetic — no booking impact).
          const facts: string[] = [];
          if (room.max_guests) facts.push(`Sleeps ${room.max_guests}`);
          if (room.bedrooms)
            facts.push(
              `${room.bedrooms} ${room.bedrooms === 1 ? "bed" : "beds"}`,
            );
          if (room.bed_type) facts.push(room.bed_type);
          if (room.has_ensuite_bathroom) facts.push("Ensuite");
          return {
            id: room.id,
            name: ov.display_name?.trim() || room.name,
            price: price == null ? null : Number(price),
            currency: ov.display_currency || room.currency || "ZAR",
            description: ov.display_desc?.trim() || room.description,
            imageUrl: photoByRoom.get(room.id) ?? null,
            bookHref: siteBookHref(ctx, {
              propertyId: room.property_id,
              roomId: room.id,
            }),
            detailHref: (() => {
              const s = slugByRoom.get(room.id);
              return s ? siteRoomHref(ctx, s) : undefined;
            })(),
            featured: ov.featured ?? false,
            badge: ov.badge?.trim() || null,
            facts,
            propertyId: room.property_id,
          };
        })
        .filter((r): r is RoomCard => r !== null);

      // Build per-property group headers (only for properties that have rooms
      // shown AND a non-empty override). Hero path → public URL.
      const groups: Record<string, RoomGroup> = {};
      for (const pid of usedProps) {
        const ov = propOverrides[pid];
        const heading = ov?.heading?.trim();
        const intro = ov?.intro?.trim();
        const hero = ov?.hero_path?.trim();
        if (heading || intro || hero) {
          groups[pid] = {
            propertyId: pid,
            heading: heading || undefined,
            intro: intro || undefined,
            heroUrl: hero ? (websiteAssetUrl(hero) ?? null) : null,
          };
        }
      }

      out.rooms_preview = {
        rooms,
        groups: Object.keys(groups).length > 0 ? groups : undefined,
      };
    })(),

    // LOCATION — the primary visible property's address + POIs.
    (async () => {
      if (!types.has("location") || !primaryProperty) return;
      const { data: poiRows } = await sb
        .from("property_points_of_interest")
        .select("name, category, travel_time, sort_order")
        .eq("property_id", primaryProperty.id)
        .order("sort_order", { ascending: true })
        .limit(30);
      const pois: Poi[] = (poiRows ?? []).map((p) => ({
        name: (p as { name: string }).name,
        category: (p as { category: string | null }).category,
        distance: (p as { travel_time: string | null }).travel_time,
      }));
      const address = [
        primaryProperty.city,
        primaryProperty.province,
        primaryProperty.country,
      ]
        .filter(Boolean)
        .join(", ");
      // Keyless Google Maps embed (same approach as the free-form MapSection).
      // City/province/country only — keeps the exact address private pre-booking.
      const mapEmbedUrl = address
        ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=12&output=embed`
        : null;
      out.location = { address: address || null, mapEmbedUrl, pois };
    })(),

    // REVIEWS — published reviews across visible properties (aggregate + cards).
    // The trust section reuses this same aggregate for its live review score,
    // so resolve when either section is on the page.
    (async () => {
      if (!types.has("reviews") && !types.has("trust")) return;
      const { data: rows } = await sb
        .from("reviews")
        .select(
          "rating, body, created_at, guest:user_profiles!reviews_guest_id_fkey ( full_name ), booking:bookings ( guest_name )",
        )
        .in("property_id", ids)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(200);
      const all = (rows ?? []) as unknown as Array<{
        rating: number;
        body: string | null;
        created_at: string;
        guest: { full_name: string | null } | null;
        booking: { guest_name: string | null } | null;
      }>;
      const count = all.length;
      const average =
        count > 0
          ? Math.round((all.reduce((s, r) => s + r.rating, 0) / count) * 10) /
            10
          : null;
      const items: ReviewCard[] = all
        .filter((r) => r.body && r.body.trim().length > 0)
        .slice(0, 12)
        .map((r) => ({
          author: firstNameLastInitial(
            r.guest?.full_name ?? r.booking?.guest_name,
          ),
          rating: r.rating,
          body: r.body as string,
          date: r.created_at.slice(0, 10),
        }));
      const aggregate = { items, average, count };
      if (types.has("reviews")) out.reviews = aggregate;
      if (types.has("trust")) out.trust = aggregate;
    })(),

    // BLOG — published posts for this site (featured-first, then recent).
    (async () => {
      if (!types.has("blog_preview")) return;
      const { data: posts } = await sb
        .from("website_blog_posts")
        .select(
          "title, slug, excerpt, cover_path, publish_at, created_at, featured",
        )
        .eq("website_id", ctx.websiteId)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("featured", { ascending: false, nullsFirst: true })
        .order("publish_at", { ascending: false, nullsFirst: false })
        .limit(12);
      const cards: BlogCard[] = (posts ?? []).map((p) => {
        const row = p as {
          title: string;
          slug: string;
          excerpt: string | null;
          cover_path: string | null;
          publish_at: string | null;
          created_at: string;
        };
        return {
          title: row.title,
          href: `/blog/${row.slug}`,
          excerpt: row.excerpt,
          coverUrl: websiteAssetUrl(row.cover_path ?? undefined) ?? null,
          date: (row.publish_at ?? row.created_at)?.slice(0, 10) ?? null,
        };
      });
      out.blog_preview = { posts: cards };
    })(),

    // POLICIES — property-level "Things to know" pulled from the site's PRIMARY
    // property (ids[0]). Same shape + time formatting as loadRoomDetail's
    // policies bag; kept only when at least one line has a value (so the section
    // hides itself on empty data).
    (async () => {
      if (!types.has("policies")) return;
      const { data: propRow } = await sb
        .from("properties")
        .select(
          "cancellation_policy_label, check_in_time, check_out_time, house_rules, allow_children, allow_pets",
        )
        .eq("id", ids[0])
        .maybeSingle<{
          cancellation_policy_label: string | null;
          check_in_time: string | null;
          check_out_time: string | null;
          house_rules: string | null;
          allow_children: boolean | null;
          allow_pets: boolean | null;
        }>();
      const fmtTime = (t: string | null | undefined): string | null => {
        if (!t) return null;
        const [h, m] = t.split(":");
        return h && m ? `${h.padStart(2, "0")}:${m}` : t;
      };
      const bag: RoomPolicies = {
        cancellation: propRow?.cancellation_policy_label?.trim() || null,
        checkIn: fmtTime(propRow?.check_in_time),
        checkOut: fmtTime(propRow?.check_out_time),
        houseRules: propRow?.house_rules?.trim() || null,
        children: propRow?.allow_children ?? null,
        pets: propRow?.allow_pets ?? null,
      };
      const hasPolicies =
        !!bag.cancellation ||
        !!bag.checkIn ||
        !!bag.checkOut ||
        !!bag.houseRules ||
        bag.children != null ||
        bag.pets != null;
      if (hasPolicies) out.policies = bag;
    })(),
  ]);

  return out;
}

// ── Room detail (the /rooms/<slug> page) ─────────────────────

type RoomOverride = {
  room_id: string;
  display_name: string | null;
  display_price: number | null;
  display_currency: string | null;
  display_desc: string | null;
  sort_order: number;
};

/** Visible room overrides — frozen snapshot when published, else live website_rooms. */
async function visibleRoomOverrides(
  sb: Sb,
  ctx: SiteContext,
): Promise<RoomOverride[]> {
  if (ctx.publishedRoomRows) {
    return ctx.publishedRoomRows
      .filter((r) => r.is_visible)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({
        room_id: r.room_id,
        display_name: r.display_name,
        display_price: r.display_price,
        display_currency: r.display_currency,
        display_desc: r.display_desc,
        sort_order: r.sort_order,
      }));
  }
  const { data: wr } = await sb
    .from("website_rooms")
    .select(
      "room_id, display_name, display_price, display_currency, display_desc, sort_order",
    )
    .eq("website_id", ctx.websiteId)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });
  return (wr ?? []).map((r) => ({
    room_id: (r as { room_id: string }).room_id,
    display_name: (r as { display_name: string | null }).display_name,
    display_price: (r as { display_price: number | string | null })
      .display_price as number | null,
    display_currency: (r as { display_currency: string | null })
      .display_currency,
    display_desc: (r as { display_desc: string | null }).display_desc,
    sort_order: (r as { sort_order: number }).sort_order,
  }));
}

/** The visible rooms in order, each with its resolved display name (for slugs). */
async function orderedVisibleRooms(
  sb: Sb,
  ctx: SiteContext,
): Promise<{
  overrides: RoomOverride[];
  // `name` drives the slug (display override → room name, matching the route);
  // `propName` is the room's own name (Properties → Rooms) for menu labels.
  ordered: Array<{ roomId: string; name: string; propName: string }>;
}> {
  const overrides = await visibleRoomOverrides(sb, ctx);
  const roomIds = overrides.map((o) => o.room_id).filter(Boolean);
  if (roomIds.length === 0) return { overrides, ordered: [] };
  const { data: prRows } = await sb
    .from("property_rooms")
    .select("id, name, is_active, deleted_at")
    .in("id", roomIds);
  const roomById = new Map(
    (prRows ?? []).map((r) => [(r as { id: string }).id, r]),
  );
  const ordered = overrides
    .map((o) => {
      const r = roomById.get(o.room_id) as
        | { name: string; is_active: boolean | null; deleted_at: string | null }
        | undefined;
      if (!r || r.is_active === false || r.deleted_at) return null;
      return {
        roomId: o.room_id,
        name: o.display_name?.trim() || r.name,
        propName: r.name,
      };
    })
    .filter(
      (x): x is { roomId: string; name: string; propName: string } =>
        x !== null,
    );
  return { overrides, ordered };
}

/**
 * Load the full detail of one room by its URL slug (resolved against the site's
 * visible rooms). Returns null when the slug matches no visible/active room.
 */
export async function loadRoomDetail(
  ctx: SiteContext,
  roomSlug: string,
): Promise<RoomDetail | null> {
  const sb = createAdminClient();
  const { overrides, ordered } = await orderedVisibleRooms(sb, ctx);
  if (ordered.length === 0) return null;

  const slugByRoom = roomSlugMap(ordered);
  let matchedId: string | null = null;
  for (const [rid, slug] of slugByRoom) {
    if (slug === roomSlug) {
      matchedId = rid;
      break;
    }
  }
  if (!matchedId) return null;
  const ov = overrides.find((o) => o.room_id === matchedId);
  if (!ov) return null;

  const { data: room } = await sb
    .from("property_rooms")
    .select(
      "id, name, description, base_price, currency, property_id, is_active, deleted_at, max_guests, bedrooms, bathrooms, bed_type, has_ensuite_bathroom, room_size_sqm, view_type",
    )
    .eq("id", matchedId)
    .maybeSingle<{
      id: string;
      name: string;
      description: string | null;
      base_price: number | string | null;
      currency: string | null;
      property_id: string;
      is_active: boolean | null;
      deleted_at: string | null;
      max_guests: number | null;
      bedrooms: number | null;
      bathrooms: number | null;
      bed_type: string | null;
      has_ensuite_bathroom: boolean | null;
      room_size_sqm: number | null;
      view_type: string | null;
    }>();
  if (!room || room.is_active === false || room.deleted_at) return null;

  const [{ data: photos }, { data: amenityRows }, { data: propRow }] =
    await Promise.all([
      sb
        .from("property_photos")
        .select("id, url, caption, sort_order")
        .eq("room_id", matchedId)
        .order("sort_order", { ascending: true }),
      sb
        .from("property_amenities")
        .select("amenity_key")
        .eq("room_id", matchedId),
      sb
        .from("properties")
        .select(
          "name, deleted_at, cancellation_policy_label, check_in_time, check_out_time, house_rules, allow_children, allow_pets",
        )
        .eq("id", room.property_id)
        .maybeSingle<{
          name: string | null;
          deleted_at: string | null;
          cancellation_policy_label: string | null;
          check_in_time: string | null;
          check_out_time: string | null;
          house_rules: string | null;
          allow_children: boolean | null;
          allow_pets: boolean | null;
        }>(),
    ]);
  // Property soft-deleted after publish (lingers in the frozen snapshot) → hide.
  if (propRow?.deleted_at) return null;

  // Per-room media overrides (frozen snapshot when published, else live): hide
  // some of the room's photos from the website, and append extra uploaded images.
  let mediaRaw: unknown = null;
  if (ctx.publishedRoomRows) {
    mediaRaw = ctx.publishedRoomRows.find(
      (r) => r.room_id === matchedId,
    )?.media_overrides;
  } else {
    const { data: wr } = await sb
      .from("website_rooms")
      .select("media_overrides")
      .eq("website_id", ctx.websiteId)
      .eq("room_id", matchedId)
      .maybeSingle<{ media_overrides: unknown }>();
    mediaRaw = wr?.media_overrides;
  }
  const overridesMedia = parseRoomMediaOverrides(mediaRaw);
  const hidden = new Set(overridesMedia.hidden);

  const roomImages: RoomDetailImage[] = (photos ?? [])
    .filter((p) => !hidden.has((p as { id: string }).id))
    .map((p) => ({
      url: (p as { url: string }).url,
      alt: (p as { caption: string | null }).caption?.trim() || room.name,
    }));
  const extraImages: RoomDetailImage[] = overridesMedia.extra.map((e) => ({
    url: websiteAssetUrl(e.path) ?? e.path,
    alt: e.alt?.trim() || room.name,
  }));
  const images: RoomDetailImage[] = [...roomImages, ...extraImages];

  // Amenity keys for this room; fall back to the property's own amenities when
  // the room has none set (hosts often tag amenities at the property level).
  let amenityKeys = (amenityRows ?? []).map(
    (a) => (a as { amenity_key: string }).amenity_key,
  );
  if (amenityKeys.length === 0) {
    const { data: propAmenities } = await sb
      .from("property_amenities")
      .select("amenity_key")
      .eq("property_id", room.property_id);
    amenityKeys = (propAmenities ?? []).map(
      (a) => (a as { amenity_key: string }).amenity_key,
    );
  }
  const catalog = await getAmenityIndex();
  const amenities: RoomAmenity[] = amenityKeys.map((key) => {
    const c = catalog.get(key);
    return {
      icon: c?.icon ?? null,
      label: c?.label ?? humaniseEnum(key) ?? key,
    };
  });

  const price = ov.display_price ?? room.base_price;

  // "Things to know" — auto-pulled from the parent property. Only kept when at
  // least one line has content (so the section hides itself on empty data).
  const fmtTime = (t: string | null | undefined): string | null => {
    if (!t) return null;
    const [h, m] = t.split(":");
    return h && m ? `${h.padStart(2, "0")}:${m}` : t;
  };
  const policies = {
    cancellation: propRow?.cancellation_policy_label?.trim() || null,
    checkIn: fmtTime(propRow?.check_in_time),
    checkOut: fmtTime(propRow?.check_out_time),
    houseRules: propRow?.house_rules?.trim() || null,
    children: propRow?.allow_children ?? null,
    pets: propRow?.allow_pets ?? null,
  };
  const hasPolicies =
    !!policies.cancellation ||
    !!policies.checkIn ||
    !!policies.checkOut ||
    !!policies.houseRules ||
    policies.children != null ||
    policies.pets != null;

  return {
    id: room.id,
    slug: roomSlug,
    name: ov.display_name?.trim() || room.name,
    description: ov.display_desc?.trim() || room.description,
    price: price == null ? null : Number(price),
    currency: ov.display_currency || room.currency || "ZAR",
    images,
    facts: roomFacts(room),
    amenities,
    bookHref: siteBookHref(ctx, {
      propertyId: room.property_id,
      roomId: room.id,
    }),
    propertyId: room.property_id,
    propertyName: propRow?.name ?? null,
    maxGuests: room.max_guests ?? null,
    policies: hasPolicies ? policies : null,
  };
}

/** Ordered URL slugs of the site's visible rooms (for the sitemap). */
export async function listRoomSlugs(ctx: SiteContext): Promise<string[]> {
  const sb = createAdminClient();
  const { ordered } = await orderedVisibleRooms(sb, ctx);
  const map = roomSlugMap(ordered);
  return ordered.map((o) => map.get(o.roomId)).filter((s): s is string => !!s);
}

export type RoomMenuLink = { roomId: string; label: string; href: string };

/**
 * The site's visible rooms as menu links — label = the room's own name, href =
 * its detail page (slug resolved exactly as the room route does). Drives the
 * auto-rooms dropdown so the menu is always current.
 */
export async function roomMenuLinks(ctx: SiteContext): Promise<RoomMenuLink[]> {
  const sb = createAdminClient();
  const { ordered } = await orderedVisibleRooms(sb, ctx);
  if (ordered.length === 0) return [];
  const slugs = roomSlugMap(
    ordered.map((o) => ({ roomId: o.roomId, name: o.name })),
  );
  return ordered.map((o) => ({
    roomId: o.roomId,
    // Clean site-relative path — the header MenuLink runs it through
    // buildNavHref, which adds the /site + ?site=&preview= for preview itself
    // (baking them here would double up). Matches every other menu item.
    label: o.propName,
    href: `/rooms/${slugs.get(o.roomId) ?? ""}`,
  }));
}

/**
 * Replace any auto-rooms menu item's children with the live room links (minus
 * the host's hidden room ids). Pure — returns the same array when nothing is
 * auto. Single source of truth used at render so public + preview always match.
 */
export function expandAutoRooms(
  menu: SiteMenuItem[],
  roomLinks: RoomMenuLink[],
): SiteMenuItem[] {
  if (!menu.some((i) => i.autoRooms)) return menu;
  return menu.map((item) => {
    if (!item.autoRooms) return item;
    const hidden = new Set(item.hiddenRoomIds ?? []);
    const visible = roomLinks.filter((l) => !hidden.has(l.roomId));
    // A dropdown only makes sense with 2+ rooms; otherwise it's a plain link.
    const children =
      visible.length >= 2
        ? visible.map((l) => ({
            id: `room-${l.roomId}`,
            label: l.label,
            href: l.href,
          }))
        : undefined;
    return { ...item, children };
  });
}

export type SitePreviewPage = { label: string; href: string };

/**
 * Every page of the site as a flat navigator, for the theme-preview bar — so a
 * host previewing a theme can jump to ANY page, including ones not in the menu
 * (a sample room detail, checkout, thank-you). Hrefs are tenant-relative; the
 * preview client rewrites them to keep the /site prefix + preview params.
 */
export async function buildSitePreviewPages(
  ctx: SiteContext,
): Promise<SitePreviewPage[]> {
  // When previewing a theme, list the theme's FULL canonical page set (its own
  // designed pages + default spines for any it omits — specials/experiences/
  // gallery/search-results) so every associated page design is reachable. On a
  // host's own site, list its real nav pages.
  let pages: SitePreviewPage[];
  if (ctx.previewThemeSlug) {
    const templates = await resolveThemePreviewPages(
      ctx.previewThemeSlug,
      ctx.brand.name,
    );
    pages = templates
      .filter((t) => t.kind !== "checkout" && t.kind !== "thank-you")
      .sort((a, b) => (a.nav_order ?? 0) - (b.nav_order ?? 0))
      .map((t) => ({
        label: t.nav_label?.trim() || t.title?.trim() || t.slug,
        href: pageHref(t.kind, t.slug),
      }));
  } else {
    pages = ctx.nav.map((n) => ({ label: n.label, href: n.href }));
  }
  const [rooms, posts] = await Promise.all([
    roomMenuLinks(ctx),
    loadSiteBlogIndex(ctx).catch(() => []),
  ]);
  if (rooms[0]) pages.push({ label: "Room detail", href: rooms[0].href });
  if (posts[0])
    pages.push({ label: "Article", href: `/blog/${posts[0].slug}` });
  pages.push({ label: "Checkout", href: "/checkout" });
  pages.push({ label: "Thank you", href: "/thank-you" });
  return pages;
}

/** First visible room's detail — the sample shown in the builder preview. */
export async function loadSampleRoomDetail(
  ctx: SiteContext,
): Promise<RoomDetail | null> {
  const sb = createAdminClient();
  const { ordered } = await orderedVisibleRooms(sb, ctx);
  if (ordered.length === 0) return null;
  const slug = roomSlugMap(ordered).get(ordered[0].roomId);
  return slug ? loadRoomDetail(ctx, slug) : null;
}

export type RoomEditorData = {
  /** The room's live detail (name/photos/price) for the editor preview link. */
  room: RoomDetail | null;
  /** Display name (override → room name) for the editor header. */
  name: string;
  /** Public slug for "preview this room". */
  slug: string | null;
  /** The shared template sections (what every room inherits). */
  templateSections: WebsiteSection[];
  /** This room's current override (null = pure template). */
  override: RoomDetailOverride | null;
};

/**
 * Everything the per-room editor needs for ONE room: its live detail, the shared
 * template sections, and the room's current overrides. Returns null when the room
 * isn't a visible member of the site. Reuses the same resolution as the public
 * room page so the editor is consistent with what renders.
 */
export async function loadRoomEditorData(
  ctx: SiteContext,
  roomId: string,
): Promise<RoomEditorData | null> {
  const sb = createAdminClient();
  const { ordered } = await orderedVisibleRooms(sb, ctx);
  const entry = ordered.find((r) => r.roomId === roomId);
  if (!entry) return null;
  const slug = roomSlugMap(ordered).get(roomId) ?? null;
  const [room, templateSections, ovRow] = await Promise.all([
    slug ? loadRoomDetail(ctx, slug) : Promise.resolve(null),
    loadRoomDetailSections(ctx),
    sb
      .from("website_rooms")
      .select("detail_overrides")
      .eq("website_id", ctx.websiteId)
      .eq("room_id", roomId)
      .maybeSingle<{ detail_overrides: unknown }>(),
  ]);
  return {
    room,
    name: entry.name,
    slug,
    templateSections,
    override: parseRoomDetailOverride(ovRow.data?.detail_overrides),
  };
}

/**
 * The sections that make up the room-detail template — the host's `room_detail`
 * page when present (draft in preview, published live), else the theme's
 * designed default so a room page always renders.
 */
export async function loadRoomDetailSections(
  ctx: SiteContext,
): Promise<WebsiteSection[]> {
  const sb = createAdminClient();
  const { data: pageRow } = await sb
    .from("website_pages")
    .select("draft_sections, published_sections")
    .eq("website_id", ctx.websiteId)
    .eq("kind", "room_detail")
    .maybeSingle<{ draft_sections: unknown; published_sections: unknown }>();

  const sections = sanitiseSectionsHtml(
    parseSectionsLoose(
      pageRow
        ? ctx.preview
          ? pageRow.draft_sections
          : pageRow.published_sections
        : null,
    ),
  ).filter((s) => ctx.preview || withinSchedule(s.schedule));

  if (sections.length > 0) return sections;
  // No host template yet (or empty) → the theme's designed default.
  return getThemeRoomDetailSections(ctx.theme.preset);
}

/**
 * Path to a "rooms" listing page if the host has one (a page at slug `rooms`),
 * else null — drives the middle "Rooms" breadcrumb crumb on a room page.
 */
export async function findRoomsIndexHref(
  ctx: SiteContext,
): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("website_pages")
    .select("kind, slug")
    .eq("website_id", ctx.websiteId)
    .eq("slug", "rooms")
    .neq("kind", "room_detail")
    .maybeSingle<{ kind: string; slug: string }>();
  return data ? pageHref(data.kind, data.slug) : null;
}

export type SiteRoomResult = {
  room: RoomDetail;
  sections: WebsiteSection[];
  data: SiteData;
  /** "/rooms" listing page path, when one exists (for the breadcrumb). */
  roomsHref: string | null;
};

/**
 * Assemble a full room-detail page: the viewed room + the template sections +
 * their live data (with the active room injected into the room-scoped sections).
 * Returns null when the slug matches no visible room.
 */
export async function loadSiteRoomPage(
  ctx: SiteContext,
  roomSlug: string,
): Promise<SiteRoomResult | null> {
  const room = await loadRoomDetail(ctx, roomSlug);
  if (!room) return null;
  const sb = createAdminClient();
  const [template, roomsHref, overrideRow] = await Promise.all([
    loadRoomDetailSections(ctx),
    findRoomsIndexHref(ctx),
    sb
      .from("website_rooms")
      .select("detail_overrides")
      .eq("website_id", ctx.websiteId)
      .eq("room_id", room.id)
      .maybeSingle<{ detail_overrides: unknown }>(),
  ]);
  // Layer this room's optional per-room overrides over the shared template
  // (drop hidden → swap replaced → append extras). Pure-template rooms (the
  // common case) merge to the template unchanged. The merged list then gets the
  // active room's live data injected like any room-detail page.
  const sections = mergeRoomDetailSections(
    template,
    parseRoomDetailOverride(overrideRow.data?.detail_overrides),
  );
  const data = await assembleSectionData(sb, ctx, sections, room);
  return { room, sections, data, roomsHref };
}

/** Load a single published blog post by slug (for the blog detail page). */
export async function loadSiteBlogPost(
  ctx: SiteContext,
  postSlug: string,
): Promise<{
  title: string;
  bodyHtml: string;
  coverUrl: string | null;
  date: string | null;
  authorName: string | null;
  authorBio: string | null;
  authorAvatarUrl: string | null;
  excerpt: string | null;
  tags: { name: string; slug: string }[];
  /** Per-post marketing overrides (live post page only): custom head code + a
   *  Meta-Pixel/GA4 event — parity with per-page seo_overrides. */
  headCode: string;
  pixelEvent: string;
} | null> {
  const sb = createAdminClient();
  let q = sb
    .from("website_blog_posts")
    .select(
      "title, body_html, cover_path, publish_at, created_at, author_name, excerpt, status, deleted_at, seo, author:website_blog_authors ( name, avatar_path, bio ), tags:website_blog_post_tags ( tag:website_blog_tags ( name, slug ) )",
    )
    .eq("website_id", ctx.websiteId)
    .eq("slug", postSlug);
  if (!ctx.preview) q = q.eq("status", "published");
  const { data: post } = await q.is("deleted_at", null).maybeSingle<{
    title: string;
    body_html: string | null;
    cover_path: string | null;
    publish_at: string | null;
    created_at: string;
    author_name: string | null;
    excerpt: string | null;
    seo: { headCode?: string; pixelEvent?: string } | null;
    author: {
      name: string | null;
      avatar_path: string | null;
      bio: string | null;
    } | null;
    tags:
      | {
          tag:
            | { name: string; slug: string }
            | { name: string; slug: string }[]
            | null;
        }[]
      | null;
  }>();
  if (!post) return null;
  const tags = (post.tags ?? [])
    .map((row) => {
      const t = Array.isArray(row.tag) ? row.tag[0] : row.tag;
      return t ? { name: t.name, slug: t.slug } : null;
    })
    .filter((t): t is { name: string; slug: string } => t !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    title: post.title,
    bodyHtml: sanitiseListingHtml(post.body_html ?? ""),
    // Resolve the storage path to a public URL (matches blog index / related /
    // blog_preview); returning the raw path broke the detail-page cover image.
    coverUrl: websiteAssetUrl(post.cover_path ?? undefined) ?? null,
    date: (post.publish_at ?? post.created_at)?.slice(0, 10) ?? null,
    // Reusable author profile (Phase 8) wins; fall back to the legacy free-text name.
    authorName: post.author?.name ?? post.author_name,
    authorBio: post.author?.bio ?? null,
    authorAvatarUrl:
      websiteAssetUrl(post.author?.avatar_path ?? undefined) ?? null,
    excerpt: post.excerpt,
    tags,
    headCode: post.seo?.headCode?.trim() || "",
    pixelEvent: post.seo?.pixelEvent || "none",
  };
}

export type BlogIndexPost = {
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  date: string | null;
  authorName: string | null;
  featured: boolean;
};

/**
 * Load all published blog posts for the site's blog index page (featured-first).
 */
export async function loadSiteBlogIndex(
  ctx: SiteContext,
): Promise<BlogIndexPost[]> {
  const sb = createAdminClient();
  const { data: posts } = await sb
    .from("website_blog_posts")
    .select(
      "title, slug, excerpt, cover_path, publish_at, created_at, featured, author_name, author:website_blog_authors ( name )",
    )
    .eq("website_id", ctx.websiteId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("featured", { ascending: false, nullsFirst: true })
    .order("publish_at", { ascending: false, nullsFirst: false });

  return (posts ?? []).map((p) => {
    const row = p as {
      title: string;
      slug: string;
      excerpt: string | null;
      cover_path: string | null;
      publish_at: string | null;
      created_at: string;
      featured: boolean | null;
      author_name: string | null;
      author: { name: string | null } | { name: string | null }[] | null;
    };
    // author may come back as array from the join
    const authorObj = Array.isArray(row.author) ? row.author[0] : row.author;
    return {
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      coverUrl: websiteAssetUrl(row.cover_path ?? undefined) ?? null,
      date: (row.publish_at ?? row.created_at)?.slice(0, 10) ?? null,
      authorName: authorObj?.name ?? row.author_name,
      featured: row.featured ?? false,
    };
  });
}

export type RelatedPost = {
  title: string;
  slug: string;
  coverUrl: string | null;
};

/**
 * Load related posts for a blog post (same category, limit 3, excluding current).
 */
export async function loadRelatedPosts(
  ctx: SiteContext,
  postSlug: string,
): Promise<RelatedPost[]> {
  const sb = createAdminClient();

  // First, get the current post's category
  const { data: current } = await sb
    .from("website_blog_posts")
    .select("id, category_id")
    .eq("website_id", ctx.websiteId)
    .eq("slug", postSlug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!current?.category_id) return [];

  // Then fetch posts in the same category, excluding the current one
  const { data: posts } = await sb
    .from("website_blog_posts")
    .select("title, slug, cover_path")
    .eq("website_id", ctx.websiteId)
    .eq("category_id", current.category_id)
    .eq("status", "published")
    .neq("id", current.id)
    .is("deleted_at", null)
    .order("featured", { ascending: false, nullsFirst: true })
    .order("publish_at", { ascending: false, nullsFirst: false })
    .limit(3);

  return (posts ?? []).map((p) => ({
    title: (p as { title: string }).title,
    slug: (p as { slug: string }).slug,
    coverUrl:
      websiteAssetUrl((p as { cover_path: string | null }).cover_path) ?? null,
  }));
}

/**
 * Load a tag's published posts for its archive page (`/blog/tag/<slug>`).
 * Returns null when the tag slug doesn't exist on this site.
 */
export async function loadSiteBlogByTag(
  ctx: SiteContext,
  tagSlug: string,
): Promise<{ tagName: string; posts: BlogIndexPost[] } | null> {
  const sb = createAdminClient();
  const { data: tag } = await sb
    .from("website_blog_tags")
    .select("id, name")
    .eq("website_id", ctx.websiteId)
    .eq("slug", tagSlug)
    .maybeSingle();
  if (!tag) return null;

  const { data: joins } = await sb
    .from("website_blog_post_tags")
    .select("post_id")
    .eq("tag_id", tag.id);
  const postIds = (joins ?? []).map((j) => (j as { post_id: string }).post_id);
  if (postIds.length === 0) return { tagName: tag.name, posts: [] };

  const { data: posts } = await sb
    .from("website_blog_posts")
    .select(
      "title, slug, excerpt, cover_path, publish_at, created_at, featured, author_name, author:website_blog_authors ( name )",
    )
    .eq("website_id", ctx.websiteId)
    .in("id", postIds)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("featured", { ascending: false, nullsFirst: true })
    .order("publish_at", { ascending: false, nullsFirst: false });

  const mapped: BlogIndexPost[] = (posts ?? []).map((p) => {
    const row = p as {
      title: string;
      slug: string;
      excerpt: string | null;
      cover_path: string | null;
      publish_at: string | null;
      created_at: string;
      featured: boolean | null;
      author_name: string | null;
      author: { name: string | null } | { name: string | null }[] | null;
    };
    const authorObj = Array.isArray(row.author) ? row.author[0] : row.author;
    return {
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      coverUrl: websiteAssetUrl(row.cover_path ?? undefined) ?? null,
      date: (row.publish_at ?? row.created_at)?.slice(0, 10) ?? null,
      authorName: authorObj?.name ?? row.author_name,
      featured: row.featured ?? false,
    };
  });
  return { tagName: tag.name, posts: mapped };
}
