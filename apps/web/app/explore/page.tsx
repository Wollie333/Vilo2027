import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  MapPin,
  Search,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";
import {
  getCategoryBySlug,
  getDescendantIds,
} from "@/lib/taxonomy/getCategories";

import { SearchBar } from "./SearchBar";
import { TypeChips } from "./TypeChips";

export const metadata: Metadata = {
  title: "Explore stays · Vilo",
  description:
    "Search direct-booking stays across South Africa — book straight with the host.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

const TYPE_LABEL: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  bb: "B&B",
  self_catering: "Self-catering",
  lodge: "Lodge",
  other: "Stay",
};

type SearchParams = {
  where?: string;
  guests?: string;
  type?: string;
  sort?: string;
  page?: string;
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

export default async function ExplorePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = createServerClient();

  const where = (searchParams?.where ?? "").trim();
  const type = searchParams?.type ?? "";
  const sort = searchParams?.sort ?? "newest";
  const guestsRaw = parseInt(searchParams?.guests ?? "", 10);
  const guests = Number.isFinite(guestsRaw) && guestsRaw > 0 ? guestsRaw : null;

  const pageRaw = parseInt(searchParams?.page ?? "", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const rangeStart = (page - 1) * PAGE_SIZE;
  const rangeEnd = rangeStart + PAGE_SIZE - 1;

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
      // Treat `type` as a category slug. Look it up in the taxonomy and
      // include every descendant id when filtering. Fall back to the legacy
      // accommodation_type text column for listings that haven't been
      // backfilled yet.
      const category = await getCategoryBySlug(type);
      if (category) {
        const ids = await getDescendantIds(category.id);
        const idList = `(${ids.join(",")})`;
        query = query.or(
          `category_id.in.${idList},accommodation_type.eq.${type}`,
        );
      } else {
        // Unknown slug — still try the legacy text column so old URLs work.
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
    query = query.order("avg_rating", {
      ascending: false,
      nullsFirst: false,
    });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.range(rangeStart, rangeEnd);

  const { data: listings, count } = await query;

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const prevHref =
    safePage > 1
      ? `/explore${(() => {
          const qs = buildQueryString(
            { where, type, sort, guests },
            safePage - 1,
          );
          return qs ? `?${qs}` : "";
        })()}`
      : null;
  const nextHref =
    safePage < totalPages
      ? `/explore?${buildQueryString({ where, type, sort, guests }, safePage + 1)}`
      : null;

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      {/* Search bar */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 lg:px-8">
          <SearchBar
            where={where}
            guests={guests ?? 0}
            currentType={type}
            currentSort={sort}
          />
        </div>
      </section>

      {/* Type chips */}
      <section className="sticky top-16 z-20 border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <TypeChips currentType={type} />
        </div>
      </section>

      {/* Results */}
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-brand-ink md:text-2xl">
              {where ? `Stays matching "${where}"` : "All stays"}
            </h1>
            {hasFilters ? (
              <Link
                href="/explore"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
              >
                <X className="h-3 w-3" />
                Clear filters
              </Link>
            ) : null}
          </div>
          <div className="text-sm text-brand-mute">
            {totalCount} {totalCount === 1 ? "result" : "results"}
            {totalPages > 1 ? ` · page ${safePage} of ${totalPages}` : ""}
          </div>
        </div>

        {!listings || listings.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="font-display text-lg font-bold text-brand-ink">
              No matches yet
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              Try a different city, change the type, or drop the guests filter.
              New hosts join Vilo every week.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((l) => {
              const photos =
                (l.photos as Array<{
                  url: string;
                  sort_order: number;
                }> | null) ?? [];
              const hero = photos.sort(
                (a, b) => a.sort_order - b.sort_order,
              )[0];
              const host = l.host as unknown as {
                display_name: string;
                is_verified: boolean;
              };
              const location = [l.city, l.province].filter(Boolean).join(", ");
              return (
                <Link
                  key={l.id}
                  href={`/listing/${l.slug}`}
                  className="group overflow-hidden rounded-card"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-brand-accent">
                    {hero ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero.url}
                        alt={l.name}
                        className="card-img absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-brand-mute">
                        <MapPin className="h-10 w-10" />
                      </div>
                    )}
                    {l.instant_booking ? (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
                        Instant
                      </span>
                    ) : null}
                    {host.is_verified ? (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-pill bg-white/90 px-2 py-0.5 text-[10px] font-bold text-brand-primary">
                        <BadgeCheck className="h-3 w-3" />
                        Verified
                      </span>
                    ) : null}
                  </div>
                  <div className="pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-display font-semibold text-brand-ink group-hover:text-brand-secondary">
                          {l.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-brand-mute">
                          {TYPE_LABEL[l.accommodation_type ?? "other"] ??
                            "Stay"}
                          {location ? ` · ${location}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs">
                        {l.avg_rating != null &&
                        l.total_reviews != null &&
                        l.total_reviews > 0 ? (
                          <>
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span className="font-semibold text-brand-ink">
                              {Number(l.avg_rating).toFixed(1)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {(() => {
                      const rooms =
                        (l.listing_rooms as Array<{
                          base_price: number;
                          is_active: boolean | null;
                          deleted_at: string | null;
                        }> | null) ?? [];
                      let amount: number | null = null;
                      let fromLabel = false;
                      const perLabel = "/ night";
                      if (l.booking_mode === "rooms_only") {
                        const prices = rooms
                          .filter(
                            (r) =>
                              r.is_active !== false && r.deleted_at == null,
                          )
                          .map((r) => Number(r.base_price))
                          .filter((p) => p > 0);
                        amount = prices.length > 0 ? Math.min(...prices) : null;
                        fromLabel = true;
                      } else if (l.base_price != null) {
                        amount = Number(l.base_price);
                      }
                      if (amount == null) return null;
                      return (
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="num font-display font-bold text-brand-ink">
                            {fromLabel ? "from " : ""}
                            {fmtR(amount, l.currency)}
                          </span>
                          <span className="text-xs text-brand-mute">
                            {perLabel}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {totalPages > 1 && listings && listings.length > 0 ? (
          <nav
            aria-label="Pagination"
            className="mt-10 flex items-center justify-center gap-3"
          >
            {prevHref ? (
              <Link
                href={prevHref}
                rel="prev"
                className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-brand-light/40 px-4 py-2 text-sm font-medium text-brand-mute">
                <ArrowLeft className="h-4 w-4" />
                Previous
              </span>
            )}
            <span className="text-sm font-medium text-brand-mute">
              Page {safePage} of {totalPages}
            </span>
            {nextHref ? (
              <Link
                href={nextHref}
                rel="next"
                className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-brand-light/40 px-4 py-2 text-sm font-medium text-brand-mute">
                Next
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </nav>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
