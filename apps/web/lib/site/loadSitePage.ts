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
import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { createAdminClient } from "@/lib/supabase/admin";
import { websiteAssetUrl } from "@/lib/website/assets";
import {
  parseSectionsLoose,
  type SectionType,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import type { SiteThemeConfig } from "./themes";
import { resolveThemeBase } from "./themes.server";
import type {
  BlogCard,
  GalleryImage,
  Poi,
  PropertyOverride,
  PublishSnapshot,
  ReviewCard,
  RoomCard,
  RoomGroup,
  SiteBrand,
  SiteData,
  SiteDataByType,
  SiteNavItem,
  SnapshotRoom,
  SpecialCard,
} from "./types";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";

export type SiteContext = {
  websiteId: string;
  businessId: string;
  status: string;
  preview: boolean;
  locale: string; // business default_language (drives booking deep-link locale)
  brand: SiteBrand;
  theme: SiteThemeConfig;
  /** Site-level SEO config (title/description/og_image_path/robots/sitemap/gsc). */
  seo: Record<string, unknown>;
  nav: SiteNavItem[];
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
export async function loadSiteContext(
  ref: string,
  opts: { preview?: boolean; themeSlug?: string } = {},
): Promise<SiteContext | null> {
  const preview = opts.preview ?? false;
  const previewThemeSlug = opts.themeSlug;
  const sb = createAdminClient();

  const { data: site } = await sb
    .from("host_websites")
    .select(
      "id, business_id, status, subdomain, custom_domain, brand, theme, seo, published_snapshot, deleted_at, business:businesses ( default_language, trading_name )",
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

  return {
    websiteId: site.id,
    businessId: site.business_id,
    status: site.status,
    preview,
    locale: site.business?.default_language || "en",
    brand,
    theme,
    seo,
    nav,
    propertyIds,
    publishedRoomRows,
    publishedPropertyOverrides,
  };
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
  opts: { preview?: boolean; postSlug?: string } = {},
): Promise<{
  title: string;
  description?: string;
  ogImageUrl?: string;
  faviconUrl?: string;
  appleIconUrl?: string;
  robotsIndex: boolean;
  gscToken?: string;
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

  if (opts.postSlug) {
    const post = await loadSiteBlogPost(ctx, opts.postSlug);
    if (post) {
      pageTitle = post.title;
      pageDesc = post.excerpt ?? undefined;
    }
  } else {
    const result = await loadSitePage(ctx, pathSlug);
    if (result) {
      const ov = result.page.seoOverrides as {
        title?: string;
        description?: string;
      };
      pageTitle = ov.title?.trim() || result.page.title?.trim() || null;
      pageDesc = ov.description?.trim() || undefined;
    }
  }

  const isHome = pathSlug.length === 0 && !opts.postSlug;
  const title =
    isHome || !pageTitle ? siteTitle : `${pageTitle} · ${siteTitle}`;

  return {
    title,
    description: pageDesc || siteDesc,
    ogImageUrl:
      websiteAssetUrl(seo.og_image_path) ?? ctx.brand.logoUrl ?? undefined,
    faviconUrl: ctx.brand.faviconUrl ?? undefined,
    appleIconUrl: ctx.brand.appleIconUrl ?? undefined,
    // Default to indexable; only false when the host opts out AND it's published.
    robotsIndex: seo.robots_index !== false,
    gscToken: seo.gsc_token?.trim() || undefined,
  };
}

/**
 * Load one page (by path slug, [] = home) and assemble the live data for every
 * auto-populate section it contains. Returns null when the page doesn't exist.
 */
export async function loadSitePage(
  ctx: SiteContext,
  pathSlug: string[],
): Promise<SitePageResult | null> {
  const sb = createAdminClient();
  const isHome = pathSlug.length === 0;
  const slug = pathSlug.join("/");

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

  const sections = parseSectionsLoose(
    ctx.preview ? pageRow.draft_sections : pageRow.published_sections,
  );

  const data = await assembleSectionData(sb, ctx, sections);

  return {
    page: {
      id: pageRow.id,
      kind: pageRow.kind,
      slug: pageRow.slug,
      title: pageRow.title,
      seoOverrides: pageRow.seo_overrides ?? {},
    },
    sections,
    data,
  };
}

type Sb = ReturnType<typeof createAdminClient>;

function firstNameLastInitial(name: string | null | undefined): string {
  if (!name) return "Guest";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function bookHref(locale: string, slug: string, roomId?: string): string {
  const path = `/${locale}/property/${slug}/book${roomId ? `?room=${roomId}` : ""}`;
  return APP_URL ? `${APP_URL}${path}` : path;
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

/**
 * Build the SiteData map — one query batch per auto-populate section type present.
 * Resolves the live data once per TYPE (via {@link assembleSiteDataByType}) then
 * fans it out to each section's id, so two `rooms_preview` sections share a query.
 */
async function assembleSectionData(
  sb: Sb,
  ctx: SiteContext,
  sections: WebsiteSection[],
): Promise<SiteData> {
  const types = new Set(sections.map((s) => s.type));
  const byType = await assembleSiteDataByType(sb, ctx, types);
  const data: SiteData = {};
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
      default:
        break;
    }
  }
  return data;
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

  const ids = ctx.propertyIds;
  if (ids.length === 0) return out;

  // Resolve property slugs once (needed by rooms + location).
  const needsSlugs = types.has("rooms_preview") || types.has("location");
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
        .select("url, sort_order, property_id")
        .in("property_id", ids)
        .order("sort_order", { ascending: true })
        .limit(60);
      const images: GalleryImage[] = (photos ?? []).map((p) => ({
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
          const slug = slugByProperty.get(room.property_id) ?? "";
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
            bookHref: bookHref(ctx.locale, slug, room.id),
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
      out.location = { address: address || null, mapEmbedUrl: null, pois };
    })(),

    // REVIEWS — published reviews across visible properties (aggregate + cards).
    (async () => {
      if (!types.has("reviews")) return;
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
      out.reviews = { items, average, count };
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
  ]);

  return out;
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
} | null> {
  const sb = createAdminClient();
  let q = sb
    .from("website_blog_posts")
    .select(
      "title, body_html, cover_path, publish_at, created_at, author_name, excerpt, status, deleted_at, author:website_blog_authors ( name, avatar_path, bio )",
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
    author: {
      name: string | null;
      avatar_path: string | null;
      bio: string | null;
    } | null;
  }>();
  if (!post) return null;
  return {
    title: post.title,
    bodyHtml: sanitiseListingHtml(post.body_html ?? ""),
    coverUrl: post.cover_path,
    date: (post.publish_at ?? post.created_at)?.slice(0, 10) ?? null,
    // Reusable author profile (Phase 8) wins; fall back to the legacy free-text name.
    authorName: post.author?.name ?? post.author_name,
    authorBio: post.author?.bio ?? null,
    authorAvatarUrl:
      websiteAssetUrl(post.author?.avatar_path ?? undefined) ?? null,
    excerpt: post.excerpt,
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
