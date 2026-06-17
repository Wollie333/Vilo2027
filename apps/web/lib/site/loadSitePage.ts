// Server-side data assembly for the public micro-site renderer (plan §2).
//
// Uses the SERVICE-ROLE admin client with EXPLICIT filters (tenant hosts have no
// session; the public renderer never relies on RLS) and stays free of
// `next/headers` so it can also run from verify scripts — the route files read
// the host header / `?site` param and pass the ref + preview flag in.
//
// Chrome (brand/theme/nav) is read from the live `host_websites` columns for now;
// the `published_snapshot` fast-path is wired in the publish workflow (W10). The
// draft-vs-published split IS honoured here: `preview` selects draft_sections and
// allows any status; public selects published_sections and requires published.
import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { createAdminClient } from "@/lib/supabase/admin";
import { websiteAssetUrl } from "@/lib/website/assets";
import {
  parseSectionsLoose,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import type { SiteThemeConfig } from "./themes";
import type {
  BlogCard,
  GalleryImage,
  Poi,
  ReviewCard,
  RoomCard,
  SiteBrand,
  SiteData,
  SiteNavItem,
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
  nav: SiteNavItem[];
  /** Ordered, visible property ids for this site (channel membership). */
  propertyIds: string[];
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

function pageHref(kind: string, slug: string): string {
  return kind === "home" ? "/" : `/${slug}`;
}

/**
 * Resolve a site by subdomain OR custom domain and build its chrome. Returns
 * null when no site matches (or it isn't published, in non-preview mode).
 */
export async function loadSiteContext(
  ref: string,
  opts: { preview?: boolean } = {},
): Promise<SiteContext | null> {
  const preview = opts.preview ?? false;
  const sb = createAdminClient();

  const { data: site } = await sb
    .from("host_websites")
    .select(
      "id, business_id, status, subdomain, custom_domain, brand, theme, deleted_at, business:businesses ( default_language, trading_name )",
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
      business: {
        default_language: string | null;
        trading_name: string | null;
      } | null;
    }>();

  if (!site) return null;
  if (!preview && site.status !== "published") return null;

  const brandJson = site.brand ?? {};
  const brand: SiteBrand = {
    name:
      (brandJson.name as string)?.trim() ||
      site.business?.trading_name ||
      site.subdomain,
    tagline: (brandJson.tagline as string) ?? null,
    logoUrl: websiteAssetUrl(brandJson.logo_path as string | undefined),
  };

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

  const nav: SiteNavItem[] = (pageRows ?? []).map((p) => ({
    label: p.nav_label?.trim() || p.title?.trim() || p.slug,
    href: pageHref(p.kind, p.slug),
  }));

  return {
    websiteId: site.id,
    businessId: site.business_id,
    status: site.status,
    preview,
    locale: site.business?.default_language || "en",
    brand,
    theme: (site.theme ?? {}) as SiteThemeConfig,
    nav,
    propertyIds: (memberRows ?? []).map((m) => m.property_id),
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

/** Build the SiteData map — one query batch per auto-populate section type present. */
async function assembleSectionData(
  sb: Sb,
  ctx: SiteContext,
  sections: WebsiteSection[],
): Promise<SiteData> {
  const data: SiteData = {};
  const ids = ctx.propertyIds;
  const types = new Set(sections.map((s) => s.type));
  if (ids.length === 0) return data;

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
      for (const s of sections)
        if (s.type === "gallery")
          data[s.id] = { type: "gallery", data: { images } };
    })(),

    // ROOMS — website_rooms (visible) ⨝ property_rooms, with display overrides.
    (async () => {
      if (!types.has("rooms_preview")) return;
      const { data: wr } = await sb
        .from("website_rooms")
        .select(
          "room_id, is_visible, display_name, display_price, display_currency, display_desc, sort_order, room:property_rooms ( id, name, description, base_price, currency, property_id, is_active, deleted_at )",
        )
        .eq("website_id", ctx.websiteId)
        .eq("is_visible", true)
        .order("sort_order", { ascending: true });

      const roomIds = (wr ?? [])
        .map((r) => (r as { room_id: string }).room_id)
        .filter(Boolean);
      const photoByRoom = new Map<string, string>();
      if (roomIds.length > 0) {
        const { data: rphotos } = await sb
          .from("property_photos")
          .select("url, room_id, sort_order")
          .in("room_id", roomIds)
          .order("sort_order", { ascending: true });
        for (const p of rphotos ?? []) {
          const rid = (p as { room_id: string | null }).room_id;
          if (rid && !photoByRoom.has(rid))
            photoByRoom.set(rid, (p as { url: string }).url);
        }
      }

      const rooms: RoomCard[] = (wr ?? [])
        .map((r): RoomCard | null => {
          const room = (r as { room: unknown }).room as {
            id: string;
            name: string;
            description: string | null;
            base_price: number | string | null;
            currency: string | null;
            property_id: string;
            is_active: boolean | null;
            deleted_at: string | null;
          } | null;
          if (!room || room.is_active === false || room.deleted_at) return null;
          const slug = slugByProperty.get(room.property_id) ?? "";
          const ov = r as {
            display_name: string | null;
            display_price: number | string | null;
            display_desc: string | null;
            display_currency: string | null;
          };
          const price = ov.display_price ?? room.base_price;
          return {
            id: room.id,
            name: ov.display_name?.trim() || room.name,
            price: price == null ? null : Number(price),
            currency: ov.display_currency || room.currency || "ZAR",
            description: ov.display_desc?.trim() || room.description,
            imageUrl: photoByRoom.get(room.id) ?? null,
            bookHref: bookHref(ctx.locale, slug, room.id),
          };
        })
        .filter((r): r is RoomCard => r !== null);

      for (const s of sections)
        if (s.type === "rooms_preview")
          data[s.id] = { type: "rooms_preview", data: { rooms } };
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
      for (const s of sections)
        if (s.type === "location")
          data[s.id] = {
            type: "location",
            data: { address: address || null, mapEmbedUrl: null, pois },
          };
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
      for (const s of sections)
        if (s.type === "reviews")
          data[s.id] = { type: "reviews", data: { items, average, count } };
    })(),

    // BLOG — published posts for this site.
    (async () => {
      if (!types.has("blog_preview")) return;
      const { data: posts } = await sb
        .from("website_blog_posts")
        .select("title, slug, excerpt, cover_path, publish_at, created_at")
        .eq("website_id", ctx.websiteId)
        .eq("status", "published")
        .is("deleted_at", null)
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
          coverUrl: row.cover_path,
          date: (row.publish_at ?? row.created_at)?.slice(0, 10) ?? null,
        };
      });
      for (const s of sections)
        if (s.type === "blog_preview")
          data[s.id] = { type: "blog_preview", data: { posts: cards } };
    })(),
  ]);

  return data;
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
  excerpt: string | null;
} | null> {
  const sb = createAdminClient();
  let q = sb
    .from("website_blog_posts")
    .select(
      "title, body_html, cover_path, publish_at, created_at, author_name, excerpt, status, deleted_at",
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
  }>();
  if (!post) return null;
  return {
    title: post.title,
    bodyHtml: sanitiseListingHtml(post.body_html ?? ""),
    coverUrl: post.cover_path,
    date: (post.publish_at ?? post.created_at)?.slice(0, 10) ?? null,
    authorName: post.author_name,
    excerpt: post.excerpt,
  };
}
