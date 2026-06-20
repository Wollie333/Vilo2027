// Schema.org JSON-LD emitter for the public micro-site (Phase 3). Builds a single
// @graph the renderer drops into a <script type="application/ld+json"> so hosts
// get rich Google results (lodging panel, room offers, review stars) with zero
// effort. Pure given its inputs; called from SitePageView for public renders only
// (never preview — unpublished data must not be advertised).
import { websiteAssetUrl } from "@/lib/website/assets";

import {
  pageHref,
  type SiteContext,
  type SitePageResult,
} from "./loadSitePage";
import type {
  GalleryData,
  LocationData,
  ReviewsData,
  RoomsPreviewData,
} from "./types";

type Node = Record<string, unknown>;

/** schema.org requires absolute URLs — drop anything relative or empty. */
const abs = (u: string | null | undefined): string | undefined =>
  u && /^https?:\/\//.test(u) ? u : undefined;

/** First live-data datum of a given auto-populate type on the page (if any). */
function find<T>(result: SitePageResult, type: string): T | undefined {
  for (const s of result.sections) {
    const entry = result.data[s.id];
    if (entry && entry.type === type) return entry.data as T;
  }
  return undefined;
}

export function buildSiteJsonLd(args: {
  ctx: SiteContext;
  result: SitePageResult;
  pathSlug: string[];
  origin: string;
}): Node[] {
  const { ctx, result, pathSlug, origin } = args;
  const siteUrl = origin.replace(/\/+$/, "");
  const isHome = pathSlug.length === 0;
  const path = isHome ? "/" : pageHref(result.page.kind, result.page.slug);
  const pageUrl = path === "/" ? siteUrl : `${siteUrl}${path}`;

  const graph: Node[] = [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: ctx.brand.name,
      url: siteUrl,
    },
  ];

  if (!isHome) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: result.page.title?.trim() || result.page.slug,
          item: pageUrl,
        },
      ],
    });
    return graph;
  }

  // Home → LodgingBusiness with whatever live data the page surfaces.
  const reviews = find<ReviewsData>(result, "reviews");
  const rooms = find<RoomsPreviewData>(result, "rooms_preview");
  const location = find<LocationData>(result, "location");
  const gallery = find<GalleryData>(result, "gallery");

  const seo = ctx.seo as { og_image_path?: string };
  const logo = abs(ctx.brand.logoUrl);
  const image =
    abs(gallery?.images?.[0]?.url) ??
    abs(websiteAssetUrl(seo.og_image_path)) ??
    logo;

  const sameAs = Object.values(ctx.brand.socials ?? {}).filter(
    (v): v is string => typeof v === "string" && /^https?:\/\//.test(v),
  );

  const lodging: Node = {
    "@type": "LodgingBusiness",
    "@id": `${siteUrl}/#business`,
    name: ctx.brand.name,
    url: siteUrl,
  };
  if (ctx.brand.tagline) lodging.description = ctx.brand.tagline;
  if (image) lodging.image = image;
  if (logo) lodging.logo = logo;
  if (ctx.brand.contactPhone) lodging.telephone = ctx.brand.contactPhone;
  if (ctx.brand.contactEmail) lodging.email = ctx.brand.contactEmail;
  if (sameAs.length) lodging.sameAs = sameAs;

  if (location?.address) {
    const parts = location.address
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const addr: Node = { "@type": "PostalAddress" };
    if (parts[0]) addr.addressLocality = parts[0];
    if (parts[1]) addr.addressRegion = parts[1];
    if (parts[2]) addr.addressCountry = parts[2];
    lodging.address = addr;
  }

  if (reviews?.average != null && reviews.average > 0 && reviews.count) {
    lodging.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: reviews.average,
      reviewCount: reviews.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const priced = (rooms?.rooms ?? []).filter((r) => r.price != null);
  if (priced.length) {
    const prices = priced.map((r) => r.price as number);
    const cur = priced[0].currency ?? "ZAR";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    lodging.priceRange = min === max ? `${cur} ${min}` : `${cur} ${min}–${max}`;
    lodging.makesOffer = priced.slice(0, 25).map((r) => {
      const offer: Node = {
        "@type": "Offer",
        name: r.name,
        price: String(r.price),
        priceCurrency: r.currency ?? "ZAR",
        category: "LodgingReservation",
      };
      if (r.bookHref) offer.url = r.bookHref;
      return offer;
    });
  }

  graph.push(lodging);
  return graph;
}

/** BlogPosting + breadcrumb graph for a single blog post page. */
export function buildBlogPostJsonLd(args: {
  ctx: SiteContext;
  post: {
    title: string;
    date: string | null;
    authorName: string | null;
    coverUrl: string | null;
    excerpt: string | null;
  };
  postSlug: string;
  origin: string;
}): Node[] {
  const { ctx, post, postSlug, origin } = args;
  const siteUrl = origin.replace(/\/+$/, "");
  const url = `${siteUrl}/blog/${postSlug}`;
  const brandLogo = abs(ctx.brand.logoUrl);

  const posting: Node = {
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    headline: post.title,
    url,
    mainEntityOfPage: url,
    publisher: {
      "@type": "Organization",
      name: ctx.brand.name,
      ...(brandLogo
        ? { logo: { "@type": "ImageObject", url: brandLogo } }
        : {}),
    },
  };
  if (post.excerpt) posting.description = post.excerpt;
  const coverAbs = abs(post.coverUrl);
  if (coverAbs) posting.image = coverAbs;
  if (post.date) posting.datePublished = post.date;
  if (post.authorName)
    posting.author = { "@type": "Person", name: post.authorName };

  return [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: ctx.brand.name,
      url: siteUrl,
    },
    posting,
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: `${siteUrl}/blog`,
        },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];
}
