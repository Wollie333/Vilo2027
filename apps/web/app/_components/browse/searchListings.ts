import { sanitizeSearch } from "@/lib/search/sanitizeSearch";
import type { createServerClient } from "@/lib/supabase/server";
import {
  getCategoryBySlug,
  getDescendantIds,
} from "@/lib/taxonomy/getCategories";

import { DEFAULT_SORT } from "./browseSort";

// Shared listing-search logic for the public /explore page and the in-portal
// /portal/browse page. Both run the same query and pagination; they differ only
// in their surrounding chrome and the `basePath` used to build links.

export const BROWSE_PAGE_SIZE = 24;

// Re-exported so existing importers keep working; defined in browseSort.ts so
// client components can read it without importing this server-side loader.
export { DEFAULT_SORT };

// A uuid no row can have, used to express "this filter matches nothing" — an
// empty .in() list is treated as no constraint by PostgREST, which would turn an
// impossible filter combination into "show everything".
const NO_MATCH = "00000000-0000-0000-0000-000000000000";

/**
 * A filter, described as data rather than applied directly.
 *
 * The results query and the head-count query are different PostgREST builder
 * types, so a shared generic helper trips TS's instantiation depth. Describing
 * the filters once and replaying them into each builder achieves the thing that
 * actually matters: there is exactly ONE list of what the search filters on, so
 * the rows and the "N stays" total cannot drift apart when a filter is added.
 */
type FilterOp =
  | { kind: "or"; value: string }
  | { kind: "eq"; column: string; value: string | number | boolean }
  | { kind: "gte"; column: string; value: string | number }
  | { kind: "lte"; column: string; value: string | number }
  | { kind: "in"; column: string; values: string[] };

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

function buildQueryString(
  base: {
    where: string;
    type: string;
    sort: string;
    guests: number | null;
    advanced: AdvancedFilters;
  },
  page: number,
): string {
  const params = new URLSearchParams();
  if (base.where) params.set("where", base.where);
  if (base.guests) params.set("guests", String(base.guests));
  if (base.type) params.set("type", base.type);
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

  const pageRaw = parseInt(searchParams?.page ?? "", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const rangeStart = (page - 1) * BROWSE_PAGE_SIZE;
  const rangeEnd = rangeStart + BROWSE_PAGE_SIZE - 1;

  const hasFilters =
    where.length > 0 || type !== "" || guests != null || advancedCount > 0;

  // Amenities are a many-to-many, which PostgREST cannot express as "has ALL of
  // these" in one filter. Resolve the matching property ids first, then constrain
  // by id. `null` means "no amenity filter"; an empty array means "filter applied
  // but nothing matches" — the two must not be conflated, or an impossible
  // amenity combination would silently return everything.
  let amenityIds: string[] | null = null;
  if (advanced.amenities.length > 0) {
    const { data: rows } = await supabase
      .from("property_amenities")
      .select("property_id, amenity_key")
      .in("amenity_key", advanced.amenities);
    const perProperty = new Map<string, Set<string>>();
    for (const r of rows ?? []) {
      if (!r.property_id || !r.amenity_key) continue;
      const set = perProperty.get(r.property_id) ?? new Set<string>();
      set.add(r.amenity_key);
      perProperty.set(r.property_id, set);
    }
    amenityIds = [...perProperty.entries()]
      .filter(([, set]) => advanced.amenities.every((a) => set.has(a)))
      .map(([id]) => id);
  }

  const LISTING_SELECT =
    "id, slug, name, city, province, base_price, currency, vat_number, vat_rate, max_guests, property_type, accommodation_type, booking_mode, avg_rating, total_reviews, instant_booking, host:hosts!inner ( display_name, is_verified ), photos:property_photos ( url, sort_order ), property_rooms ( base_price, is_active, deleted_at )";

  // Precompute the free-text + type/category filter specs ONCE so the exact same
  // filters apply across every query below (the single query, or the two country
  // buckets + the total count when prioritising).
  //   `where` MUST be run through sanitizeSearch (strips , ( ) % _ etc.) or a
  //   public visitor could inject extra OR-conditions into the filter grammar.
  const wherePat =
    where.length > 0
      ? (() => {
          const safe = sanitizeSearch(where);
          return safe.length > 0 ? `%${safe}%` : "";
        })()
      : "";
  // Treat `type` as a category slug: look it up + include every descendant id,
  // falling back to the legacy accommodation_type column for un-backfilled rows.
  let categoryOr: string | null = null;
  let legacyType: string | null = null;
  if (type && type !== "accommodation") {
    const category = await getCategoryBySlug(type);
    if (category) {
      const ids = await getDescendantIds(category.id);
      categoryOr = `category_id.in.(${ids.join(",")}),accommodation_type.eq.${type}`;
    } else {
      legacyType = type;
    }
  }

  // EVERY filter lives here, and both the results query and the count query run
  // through it. They used to apply their filter spec separately, which is how a
  // result set and its "N stays" total quietly drift apart when someone adds a
  // filter to one and forgets the other.
  //
  const filterOps: FilterOp[] = [];
  if (wherePat) {
    filterOps.push({
      kind: "or",
      value: `name.ilike.${wherePat},city.ilike.${wherePat},province.ilike.${wherePat}`,
    });
  }
  if (categoryOr) filterOps.push({ kind: "or", value: categoryOr });
  else if (legacyType) {
    filterOps.push({
      kind: "eq",
      column: "accommodation_type",
      value: legacyType,
    });
  }
  if (guests)
    filterOps.push({ kind: "gte", column: "max_guests", value: guests });
  if (advanced.minPrice != null)
    filterOps.push({
      kind: "gte",
      column: "base_price",
      value: advanced.minPrice,
    });
  if (advanced.maxPrice != null)
    filterOps.push({
      kind: "lte",
      column: "base_price",
      value: advanced.maxPrice,
    });
  if (advanced.bedrooms != null)
    filterOps.push({
      kind: "gte",
      column: "bedrooms",
      value: advanced.bedrooms,
    });
  if (advanced.bathrooms != null)
    filterOps.push({
      kind: "gte",
      column: "bathrooms",
      value: advanced.bathrooms,
    });
  if (advanced.instant)
    filterOps.push({ kind: "eq", column: "instant_booking", value: true });
  if (advanced.rating != null)
    filterOps.push({
      kind: "gte",
      column: "avg_rating",
      value: advanced.rating,
    });
  // hosts is an !inner join in the select, so this filters the parent rows.
  if (advanced.verified)
    filterOps.push({ kind: "eq", column: "hosts.is_verified", value: true });
  if (amenityIds != null) {
    // An empty list must match nothing, not everything.
    filterOps.push(
      amenityIds.length > 0
        ? { kind: "in", column: "id", values: amenityIds }
        : { kind: "eq", column: "id", value: NO_MATCH },
    );
  }

  // The listings query (full select + sort), optionally constrained to / away
  // from the priority country for the two-bucket ordering.
  function buildListings(country: "eq" | "neq" | null) {
    let q = supabase
      .from("properties")
      // MVP: accommodation only — experiences/tour guides ship later.
      .select(LISTING_SELECT, { count: "exact" })
      .eq("is_published", true)
      .eq("property_type", "accommodation")
      .is("deleted_at", null);
    for (const op of filterOps) {
      if (op.kind === "or") q = q.or(op.value);
      else if (op.kind === "eq") q = q.eq(op.column, op.value);
      else if (op.kind === "gte") q = q.gte(op.column, op.value);
      else if (op.kind === "lte") q = q.lte(op.column, op.value);
      else q = q.in(op.column, op.values);
    }
    if (country === "eq" && priorityCountry)
      q = q.eq("country", priorityCountry);
    else if (country === "neq" && priorityCountry)
      q = q.neq("country", priorityCountry);
    if (sort === "price_asc")
      q = q.order("base_price", { ascending: true, nullsFirst: false });
    else if (sort === "price_desc")
      q = q.order("base_price", { ascending: false, nullsFirst: false });
    else if (sort === "rating")
      q = q.order("avg_rating", { ascending: false, nullsFirst: false });
    else if (sort === "newest") q = q.order("created_at", { ascending: false });
    // Default "recommended": the ranking the cron computes — profile quality,
    // reviews, responsiveness, plan — with newest as a stable tie-break.
    else
      q = q
        .order("ranking_score", { ascending: false })
        .order("created_at", { ascending: false });
    return q;
  }

  // A head count of every match (both buckets) — the total for pagination.
  function buildTotalCount() {
    let q = supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .eq("property_type", "accommodation")
      .is("deleted_at", null);
    // Same filterOps list as buildListings — that shared source is the point.
    for (const op of filterOps) {
      if (op.kind === "or") q = q.or(op.value);
      else if (op.kind === "eq") q = q.eq(op.column, op.value);
      else if (op.kind === "gte") q = q.gte(op.column, op.value);
      else if (op.kind === "lte") q = q.lte(op.column, op.value);
      else q = q.in(op.column, op.values);
    }
    return q;
  }

  const priority =
    priorityCountry && priorityCountry.length > 0 ? priorityCountry : null;

  let listings: BrowseResult["listings"] | null = null;
  let totalCount = 0;

  if (priority) {
    // Bucket A = the priority country, bucket B = everyone else. They partition
    // all listings (country is NOT NULL), so we slice the requested page window
    // across the A→B boundary: A supplies [rangeStart, a), B fills the rest.
    const aRes = await buildListings("eq").range(rangeStart, rangeEnd);
    const a = aRes.count ?? 0;
    const aRows = aRes.data ?? [];
    let bRows: NonNullable<typeof aRes.data> = [];
    if (rangeEnd >= a) {
      const bRes = await buildListings("neq").range(
        Math.max(0, rangeStart - a),
        rangeEnd - a,
      );
      bRows = bRes.data ?? [];
    }
    const { count: total } = await buildTotalCount();
    totalCount = total ?? 0;
    listings = [...aRows, ...bRows] as unknown as BrowseResult["listings"];
  } else {
    const { data, count } = await buildListings(null).range(
      rangeStart,
      rangeEnd,
    );
    listings = (data ?? []) as unknown as BrowseResult["listings"];
    totalCount = count ?? 0;
  }
  const totalPages = Math.max(1, Math.ceil(totalCount / BROWSE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const linkBase = { where, type, sort, guests, advanced };
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
    listings: (listings ?? []) as BrowseListing[],
    where,
    type,
    sort,
    guests,
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
