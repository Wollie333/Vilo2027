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
  max_guests: number | null;
  listing_type: string;
  accommodation_type: string | null;
  booking_mode: string;
  avg_rating: number | null;
  total_reviews: number | null;
  instant_booking: boolean;
  host: { display_name: string; is_verified: boolean } | unknown;
  photos: Array<{ url: string; sort_order: number }> | null;
  listing_rooms: Array<{
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

  let query = supabase
    .from("listings")
    .select(
      "id, slug, name, city, province, base_price, currency, max_guests, listing_type, accommodation_type, booking_mode, avg_rating, total_reviews, instant_booking, host:hosts!inner ( display_name, is_verified ), photos:listing_photos ( url, sort_order ), listing_rooms ( base_price, is_active, deleted_at )",
      { count: "exact" },
    )
    .eq("is_published", true)
    // MVP: accommodation only — experiences/tour guides ship later.
    .eq("listing_type", "accommodation")
    .is("deleted_at", null);

  if (where.length > 0) {
    // Search city + province + listing name. PostgREST `or` filter.
    const pat = `%${where.replace(/[%_]/g, "")}%`;
    query = query.or(
      `name.ilike.${pat},city.ilike.${pat},province.ilike.${pat}`,
    );
  }
  if (type) {
    if (type === "accommodation") {
      // Base query already filters to accommodation — nothing more to do.
    } else {
      // Treat `type` as a category slug. Look it up in the taxonomy and include
      // every descendant id when filtering. Fall back to the legacy
      // accommodation_type text column for listings not yet backfilled.
      const category = await getCategoryBySlug(type);
      if (category) {
        const ids = await getDescendantIds(category.id);
        const idList = `(${ids.join(",")})`;
        query = query.or(
          `category_id.in.${idList},accommodation_type.eq.${type}`,
        );
      } else {
        query = query.eq("accommodation_type", type);
      }
    }
  }
  if (guests) {
    query = query.gte("max_guests", guests);
  }

  if (sort === "price_asc") {
    query = query.order("base_price", { ascending: true, nullsFirst: false });
  } else if (sort === "price_desc") {
    query = query.order("base_price", { ascending: false, nullsFirst: false });
  } else if (sort === "rating") {
    query = query.order("avg_rating", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.range(rangeStart, rangeEnd);

  const { data: listings, count } = await query;

  const totalCount = count ?? 0;
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
