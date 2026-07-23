// Schema.org JSON-LD emitter for the public micro-site (Phase 3). Builds a single
// @graph the renderer drops into a <script type="application/ld+json"> so hosts
// get rich Google results (lodging panel, room offers, review stars) with zero
// effort. Pure given its inputs; called from SitePageView for public renders only
// (never preview — unpublished data must not be advertised).
//
// ── THEME-AGNOSTIC: this is the single source of truth for every theme ──────────
// The JSON-LD is emitted by the SHARED page views (SitePageView, SiteRoomView, the
// blog route) BEFORE the per-theme component is dispatched, so it is identical
// across OceansView / Marmalade / Sabela / Safari / Royal AND any future theme.
// A new theme gets correct Google structured data for free — never re-implement or
// fork this per theme. Enrich rooms/offers/business HERE and all themes benefit.
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
  RoomDetail,
  RoomsPreviewData,
} from "./types";

type Node = Record<string, unknown>;

/** Google's Offer.priceValidUntil — a near-future date the advertised price holds
 *  until. Computed at the (server) call site so the JSON-LD builders stay pure.
 *  One year out is the conventional rolling window for open-ended nightly rates. */
export function schemaPriceValidUntil(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/** schema.org requires absolute URLs — drop anything relative or empty. */
const abs = (u: string | null | undefined): string | undefined =>
  u && /^https?:\/\//.test(u) ? u : undefined;

/** Resolve a possibly-relative href to an absolute URL against the site origin
 *  (schema.org wants absolute URLs; internal hrefs like `/en/site/book…` are
 *  relative). Returns undefined for empty input. */
const absHref = (
  u: string | null | undefined,
  siteUrl: string,
): string | undefined =>
  !u ? undefined : /^https?:\/\//.test(u) ? u : `${siteUrl}${u}`;

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
  /** ISO date (YYYY-MM-DD) up to which the advertised prices hold — Google's
   *  Offer.priceValidUntil. Passed in (not computed) to keep this pure. */
  priceValidUntil: string;
  /** Live home data for the LodgingBusiness. Passed explicitly because BESPOKE
   *  themes render from assembleSiteDataByType and don't populate result.data —
   *  without this the home business node would be empty on those themes. Falls
   *  back to result.data (generic templates) when absent. */
  assembled?: {
    location?: LocationData;
    rooms?: RoomsPreviewData;
    reviews?: ReviewsData;
    gallery?: GalleryData;
  };
}): Node[] {
  const { ctx, result, pathSlug, origin, priceValidUntil, assembled } = args;
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

  // Home → LodgingBusiness with whatever live data the page surfaces. Prefer the
  // explicitly-assembled data (works for bespoke themes); fall back to result.data
  // for generic section-model templates.
  const reviews = assembled?.reviews ?? find<ReviewsData>(result, "reviews");
  const rooms =
    assembled?.rooms ?? find<RoomsPreviewData>(result, "rooms_preview");
  const location =
    assembled?.location ?? find<LocationData>(result, "location");
  const gallery = assembled?.gallery ?? find<GalleryData>(result, "gallery");

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

  if (
    location?.latitude != null &&
    location?.longitude != null &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  ) {
    lodging.geo = {
      "@type": "GeoCoordinates",
      latitude: location.latitude,
      longitude: location.longitude,
    };
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
        availability: "https://schema.org/InStock",
        priceValidUntil,
      };
      const offerUrl = absHref(r.bookHref, siteUrl);
      if (offerUrl) offer.url = offerUrl;
      return offer;
    });
  }

  graph.push(lodging);
  return graph;
}

/**
 * HotelRoom + breadcrumb graph for a single room-detail page. Breadcrumb is
 * Home › Rooms › <room> (the Rooms crumb is included only when a rooms listing
 * page exists, so no broken intermediate URL).
 */
export function buildRoomJsonLd(args: {
  ctx: SiteContext;
  room: RoomDetail;
  roomSlug: string;
  roomsHref: string | null;
  origin: string;
  /** Reviews shown on this room page → the room's AggregateRating (star snippet). */
  reviews?: ReviewsData | null;
  /** ISO date (YYYY-MM-DD) the price holds until (Offer.priceValidUntil). */
  priceValidUntil: string;
}): Node[] {
  const { ctx, room, roomSlug, roomsHref, origin, reviews, priceValidUntil } =
    args;
  const siteUrl = origin.replace(/\/+$/, "");
  const url = `${siteUrl}/rooms/${roomSlug}`;
  // The room BELONGS TO the site's LodgingBusiness — link them by @id so Google
  // connects the room to the property entity (a minimal business node carrying
  // this @id is emitted in the graph below so the reference resolves on-page).
  const businessId = `${siteUrl}/#business`;

  const node: Node = {
    "@type": "HotelRoom",
    "@id": `${url}#room`,
    name: room.name,
    url,
    containedInPlace: { "@id": businessId },
  };
  if (room.description) node.description = room.description;
  const image = room.images
    .map((i) => abs(i.url))
    .filter((u): u is string => !!u);
  if (image.length) node.image = image;

  // Occupancy / bed / amenities — all shown on the page, so the schema mirrors
  // the visible content (Google's core requirement).
  if (room.maxGuests != null && room.maxGuests > 0) {
    node.occupancy = {
      "@type": "QuantitativeValue",
      maxValue: room.maxGuests,
      unitText: "person",
    };
  }
  const bedFact = (room.facts ?? []).find((f) => /\bbeds?\b/i.test(f));
  if (bedFact) node.bed = bedFact;
  const amenities = (room.amenities ?? [])
    .map((a) => a.label?.trim())
    .filter((l): l is string => !!l);
  if (amenities.length) {
    node.amenityFeature = amenities.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    }));
  }

  if (room.price != null) {
    node.offers = {
      "@type": "Offer",
      price: String(room.price),
      priceCurrency: room.currency ?? "ZAR",
      category: "LodgingReservation",
      availability: "https://schema.org/InStock",
      priceValidUntil,
      url: absHref(room.bookHref, siteUrl) ?? url,
    };
  }

  // Review stars — from the reviews rendered on this room page (matches content).
  if (reviews?.average != null && reviews.average > 0 && reviews.count) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: reviews.average,
      reviewCount: reviews.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const crumbs: Node[] = [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
  ];
  if (roomsHref) {
    crumbs.push({
      "@type": "ListItem",
      position: 2,
      name: "Rooms",
      item: `${siteUrl}${roomsHref}`,
    });
    crumbs.push({
      "@type": "ListItem",
      position: 3,
      name: room.name,
      item: url,
    });
  } else {
    crumbs.push({
      "@type": "ListItem",
      position: 2,
      name: room.name,
      item: url,
    });
  }

  return [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: ctx.brand.name,
      url: siteUrl,
    },
    // Minimal business node so the room's containedInPlace @id resolves on-page
    // (the full LodgingBusiness — address, rating, offers — is on the home page).
    {
      "@type": "LodgingBusiness",
      "@id": businessId,
      name: ctx.brand.name,
      url: siteUrl,
    },
    node,
    { "@type": "BreadcrumbList", itemListElement: crumbs },
  ];
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
