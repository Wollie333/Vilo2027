import type { createServerClient } from "@/lib/supabase/server";
import {
  getCategoryBySlug,
  getDescendantIds,
} from "@/lib/taxonomy/getCategories";

import { DEFAULT_SORT } from "./browseSort";

// Shared listing-search logic for the public /explore page and the in-portal
// /portal/browse page. Both run the same query and pagination; they differ only
// in their surrounding chrome and the `basePath` used to build links.
//
// Filtering + ordering live in ONE place — the `search_directory` SQL function
// (migration 20260806180000). It owns weighted full-text relevance, the fair
// relevance×quality blend, availability, and every filter, so the result set and
// its "N stays" total can never drift apart. This module resolves the category
// subtree, calls the function, then re-fetches the rich listing rows by id (the
// listing shape stays defined here, in TypeScript).

export const BROWSE_PAGE_SIZE = 24;

// Re-exported so existing importers keep working; defined in browseSort.ts so
// client components can read it without importing this server-side loader.
export { DEFAULT_SORT };

export const BROWSE_TYPE_LABEL: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  bb: "B&B",
  self_catering: "Self-catering",
  lodge: "Lodge",
  other: "Stay",
};

export type BrowseSearchParams = {
  where?: string;
  guests?: string;
  type?: string;
  sort?: string;
  page?: string;
  /** Check-in / check-out (YYYY-MM-DD). Both required to filter availability. */
  checkin?: string;
  checkout?: string;
  /** Nightly price floor/ceiling, in whole rands. */
  min_price?: string;
  max_price?: string;
  bedrooms?: string;
  bathrooms?: string;
  /** Comma-separated amenity slugs — a listing must have ALL of them. */
  amenities?: string;
  /** "1" to show only listings that book without host approval. */
  instant?: string;
  /** Minimum average rating, e.g. "4". */
  rating?: string;
  /** "1" to show only ID-verified hosts. */
  verified?: string;
};

/** Filters beyond the basic where/type/guests, for "N filters applied" UI. */
export type AdvancedFilters = {
  minPrice: number | null;
  maxPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: string[];
  instant: boolean;
  rating: number | null;
  verified: boolean;
};

/** Check-in/out, only set when both are valid and check-out is after check-in. */
export type DateRange = { checkin: string | null; checkout: string | null };

export type BrowseListing = {
  id: string;
  slug: string | null;
  name: string;
  city: string | null;
  province: string | null;
  base_price: number | null;
  currency: string;
  vat_number: string | null;
  vat_rate: number | string | null;
  max_guests: number | null;
  property_type: string;
  accommodation_type: string | null;
  booking_mode: string;
  avg_rating: number | null;
  total_reviews: number | null;
  instant_booking: boolean;
  host: { display_name: string; is_verified: boolean } | unknown;
  photos: Array<{ url: string; sort_order: number }> | null;
  property_rooms: Array<{
    base_price: number;
    is_active: boolean | null;
    deleted_at: string | null;
  }> | null;
};

export type BrowseResult = {
  listings: BrowseListing[];
  where: string;
  type: string;
  sort: string;
  guests: number | null;
  checkin: string | null;
  checkout: string | null;
  hasFilters: boolean;
  advanced: AdvancedFilters;
  /** How many advanced filters are active — drives the "Filters (3)" badge. */
  advancedCount: number;
  totalCount: number;
  totalPages: number;
  safePage: number;
  prevHref: string | null;
  nextHref: string | null;
};

/** Parse + clamp the advanced filters. Anything unparseable is simply ignored:
 *  a hand-edited URL should narrow a search or do nothing, never error. */
function parseAdvanced(p: BrowseSearchParams | undefined): AdvancedFilters {
  const int = (v: string | undefined, min: number, max: number) => {
    const n = parseInt(v ?? "", 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, n));
  };
  return {
    minPrice: int(p?.min_price, 0, 1_000_000),
    maxPrice: int(p?.max_price, 0, 1_000_000),
    bedrooms: int(p?.bedrooms, 1, 20),
    bathrooms: int(p?.bathrooms, 1, 20),
    amenities: (p?.amenities ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      // Slugs only — these reach a query filter, so anything else is dropped.
      .filter((s) => /^[a-z0-9_]{2,40}$/.test(s))
      .slice(0, 20),
    instant: p?.instant === "1",
    rating: int(p?.rating, 1, 5),
    verified: p?.verified === "1",
  };
}

function countAdvanced(a: AdvancedFilters): number {
  return (
    (a.minPrice != null || a.maxPrice != null ? 1 : 0) +
    (a.bedrooms != null ? 1 : 0) +
    (a.bathrooms != null ? 1 : 0) +
    a.amenities.length +
    (a.instant ? 1 : 0) +
    (a.rating != null ? 1 : 0) +
    (a.verified ? 1 : 0)
  );
}

/** A search only filters by date when BOTH ends are valid ISO dates and the
 *  stay has at least one night. A half-set or malformed range is treated as no
 *  date filter — never as "matches nothing". */
function parseDates(p: BrowseSearchParams | undefined): DateRange {
  const iso = (v: string | undefined): string | null =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
      ? v
      : null;
  const checkin = iso(p?.checkin);
  const checkout = iso(p?.checkout);
  if (checkin && checkout && checkout > checkin) return { checkin, checkout };
  return { checkin: null, checkout: null };
}

function buildQueryString(
  base: {
    where: string;
    type: string;
    sort: string;
    guests: number | null;
    checkin: string | null;
    checkout: string | null;
    advanced: AdvancedFilters;
  },
  page: number,
): string {
  const params = new URLSearchParams();
  if (base.where) params.set("where", base.where);
  if (base.guests) params.set("guests", String(base.guests));
  if (base.type) params.set("type", base.type);
  if (base.checkin) params.set("checkin", base.checkin);
  if (base.checkout) params.set("checkout", base.checkout);
  if (base.sort && base.sort !== DEFAULT_SORT) params.set("sort", base.sort);
  const a = base.advanced;
  if (a.minPrice != null) params.set("min_price", String(a.minPrice));
  if (a.maxPrice != null) params.set("max_price", String(a.maxPrice));
  if (a.bedrooms != null) params.set("bedrooms", String(a.bedrooms));
  if (a.bathrooms != null) params.set("bathrooms", String(a.bathrooms));
  if (a.amenities.length) params.set("amenities", a.amenities.join(","));
  if (a.instant) params.set("instant", "1");
  if (a.rating != null) params.set("rating", String(a.rating));
  if (a.verified) params.set("verified", "1");
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

// The rich listing shape re-fetched by id after the ranked search returns its
// ordered ids. Kept here so the listing columns live in exactly one place.
const LISTING_SELECT =
  "id, slug, name, city, province, base_price, currency, vat_number, vat_rate, max_guests, property_type, accommodation_type, booking_mode, avg_rating, total_reviews, instant_booking, host:hosts!inner ( display_name, is_verified ), photos:property_photos ( url, sort_order ), property_rooms ( base_price, is_active, deleted_at )";

export async function searchListings(
  supabase: ReturnType<typeof createServerClient>,
  searchParams: BrowseSearchParams | undefined,
  basePath: string,
  // The directory country to float to the top ("prioritise, don't hide"). Pass
  // null / "" to show every country in the normal sort. The caller only sets
  // this when there are ≥2 countries with listings (else it's a no-op).
  priorityCountry?: string | null,
): Promise<BrowseResult> {
  const where = (searchParams?.where ?? "").trim();
  const type = searchParams?.type ?? "";
  const sort = searchParams?.sort ?? DEFAULT_SORT;
  const guestsRaw = parseInt(searchParams?.guests ?? "", 10);
  const guests = Number.isFinite(guestsRaw) && guestsRaw > 0 ? guestsRaw : null;
  const advanced = parseAdvanced(searchParams);
  const advancedCount = countAdvanced(advanced);
  const { checkin, checkout } = parseDates(searchParams);

  const pageRaw = parseInt(searchParams?.page ?? "", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const rangeStart = (page - 1) * BROWSE_PAGE_SIZE;

  const hasFilters =
    where.length > 0 ||
    type !== "" ||
    guests != null ||
    advancedCount > 0 ||
    (checkin != null && checkout != null);

  // Treat `type` as a category slug: resolve it + every descendant id so a
  // parent category ("Guesthouses") matches its leaves too, falling back to the
  // legacy accommodation_type column for un-backfilled rows. "accommodation" is
  // the pseudo-root meaning "no type filter".
  let categoryIds: string[] | null = null;
  let typeSlug: string | null = null;
  if (type && type !== "accommodation") {
    const category = await getCategoryBySlug(type);
    if (category) {
      categoryIds = await getDescendantIds(category.id);
      typeSlug = type;
    } else {
      typeSlug = type;
    }
  }

  const priority =
    priorityCountry && priorityCountry.length > 0 ? priorityCountry : null;

  // One ranked query owns all filtering + ordering. It returns ordered ids plus
  // the full match count (via count(*) OVER()), so paging and the total agree.
  // The generated RPC types mark every arg optional (T | undefined), not
  // nullable — so a null here would be a type error. Omitting an arg falls to
  // the function's DEFAULT NULL, which is exactly "no filter", so `?? undefined`
  // is behaviourally identical to passing null.
  const { data: rankedRows, error } = await supabase.rpc("search_directory", {
    p_where: where.length > 0 ? where : undefined,
    p_category_ids: categoryIds ?? undefined,
    p_type_slug: typeSlug ?? undefined,
    p_guests: guests ?? undefined,
    p_min_price: advanced.minPrice ?? undefined,
    p_max_price: advanced.maxPrice ?? undefined,
    p_bedrooms: advanced.bedrooms ?? undefined,
    p_bathrooms: advanced.bathrooms ?? undefined,
    p_amenities: advanced.amenities.length > 0 ? advanced.amenities : undefined,
    p_instant: advanced.instant,
    p_min_rating: advanced.rating ?? undefined,
    p_verified: advanced.verified,
    p_checkin: checkin ?? undefined,
    p_checkout: checkout ?? undefined,
    p_priority_country: priority ?? undefined,
    p_sort: sort,
    p_limit: BROWSE_PAGE_SIZE,
    p_offset: rangeStart,
  });

  if (error) {
    // A search that errors should render "no results", never a 500 in the user's
    // face. Surface it in logs so a broken filter is not silent.
    console.error("[search] search_directory failed", error);
  }

  const ranked = (rankedRows ?? []) as Array<{
    id: string;
    total_count: number | string;
  }>;
  const totalCount = ranked.length > 0 ? Number(ranked[0].total_count) : 0;
  const orderedIds = ranked.map((r) => r.id);

  // Re-fetch the rich rows by id, then restore the ranked order (an IN() query
  // does not preserve it). RLS still applies here — only published rows return.
  let listings: BrowseListing[] = [];
  if (orderedIds.length > 0) {
    const { data: rows } = await supabase
      .from("properties")
      .select(LISTING_SELECT)
      .in("id", orderedIds);
    const byId = new Map(
      ((rows ?? []) as unknown as BrowseListing[]).map((r) => [r.id, r]),
    );
    listings = orderedIds
      .map((id) => byId.get(id))
      .filter((r): r is BrowseListing => r != null);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / BROWSE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const linkBase = { where, type, sort, guests, checkin, checkout, advanced };
  const prevHref =
    safePage > 1
      ? (() => {
          const qs = buildQueryString(linkBase, safePage - 1);
          return `${basePath}${qs ? `?${qs}` : ""}`;
        })()
      : null;
  const nextHref =
    safePage < totalPages
      ? `${basePath}?${buildQueryString(linkBase, safePage + 1)}`
      : null;

  return {
    listings,
    where,
    type,
    sort,
    guests,
    checkin,
    checkout,
    hasFilters,
    advanced,
    advancedCount,
    totalCount,
    totalPages,
    safePage,
    prevHref,
    nextHref,
  };
}
