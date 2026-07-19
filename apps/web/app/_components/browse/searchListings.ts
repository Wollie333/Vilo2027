import { sanitizeSearch } from "@/lib/search/sanitizeSearch";
import type { createServerClient } from "@/lib/supabase/server";
import {
  getCategoryBySlug,
  getDescendantIds,
} from "@/lib/taxonomy/getCategories";

// Shared listing-search logic for the public /explore page and the in-portal
// /portal/browse page. Both run the same query and pagination; they differ only
// in their surrounding chrome and the `basePath` used to build links.

export const BROWSE_PAGE_SIZE = 24;

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
  totalCount: number;
  totalPages: number;
  safePage: number;
  prevHref: string | null;
  nextHref: string | null;
};

function buildQueryString(
  base: { where: string; type: string; sort: string; guests: number | null },
  page: number,
): string {
  const params = new URLSearchParams();
  if (base.where) params.set("where", base.where);
  if (base.guests) params.set("guests", String(base.guests));
  if (base.type) params.set("type", base.type);
  if (base.sort && base.sort !== "newest") params.set("sort", base.sort);
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
  const sort = searchParams?.sort ?? "newest";
  const guestsRaw = parseInt(searchParams?.guests ?? "", 10);
  const guests = Number.isFinite(guestsRaw) && guestsRaw > 0 ? guestsRaw : null;

  const pageRaw = parseInt(searchParams?.page ?? "", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const rangeStart = (page - 1) * BROWSE_PAGE_SIZE;
  const rangeEnd = rangeStart + BROWSE_PAGE_SIZE - 1;

  const hasFilters = where.length > 0 || type !== "" || guests != null;

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
    if (wherePat) {
      q = q.or(
        `name.ilike.${wherePat},city.ilike.${wherePat},province.ilike.${wherePat}`,
      );
    }
    if (categoryOr) q = q.or(categoryOr);
    else if (legacyType) q = q.eq("accommodation_type", legacyType);
    if (guests) q = q.gte("max_guests", guests);
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
    else q = q.order("created_at", { ascending: false });
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
    if (wherePat) {
      q = q.or(
        `name.ilike.${wherePat},city.ilike.${wherePat},province.ilike.${wherePat}`,
      );
    }
    if (categoryOr) q = q.or(categoryOr);
    else if (legacyType) q = q.eq("accommodation_type", legacyType);
    if (guests) q = q.gte("max_guests", guests);
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
  const prevHref =
    safePage > 1
      ? (() => {
          const qs = buildQueryString(
            { where, type, sort, guests },
            safePage - 1,
          );
          return `${basePath}${qs ? `?${qs}` : ""}`;
        })()
      : null;
  const nextHref =
    safePage < totalPages
      ? `${basePath}?${buildQueryString({ where, type, sort, guests }, safePage + 1)}`
      : null;

  return {
    listings: (listings ?? []) as BrowseListing[],
    where,
    type,
    sort,
    guests,
    hasFilters,
    totalCount,
    totalPages,
    safePage,
    prevHref,
    nextHref,
  };
}
