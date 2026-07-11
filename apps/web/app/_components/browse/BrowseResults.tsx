import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  MapPin,
  Search,
  Star,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { Money } from "@/components/currency/Money";
import { effectiveVatRate, grossVat } from "@/lib/pricing/vat";

import { BROWSE_TYPE_LABEL, type BrowseResult } from "./searchListings";

// Presentational results block shared by /explore and /portal/browse: the
// header row (count + clear-filters), the listing grid, and pagination. The
// surrounding chrome (site header/footer vs portal shell) and the SearchBar /
// TypeChips live in each page; only `basePath` differs.
export function BrowseResults({
  result,
  basePath,
  brandName,
}: {
  result: BrowseResult;
  basePath: string;
  brandName: string;
}) {
  const {
    listings,
    where,
    hasFilters,
    totalCount,
    totalPages,
    safePage,
    prevHref,
    nextHref,
  } = result;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-brand-ink md:text-2xl">
            {where ? `Stays matching "${where}"` : "All stays"}
          </h1>
          {hasFilters ? (
            <Link
              href={basePath}
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

      {listings.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Search className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No matches yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Try a different city, change the type, or drop the guests filter.
            New hosts join {brandName} every week.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => {
            const photos = l.photos ?? [];
            const hero = [...photos].sort(
              (a, b) => a.sort_order - b.sort_order,
            )[0];
            const host = l.host as {
              display_name: string;
              is_verified: boolean;
            };
            const location = [l.city, l.province].filter(Boolean).join(", ");
            return (
              <Link
                key={l.id}
                href={`/property/${l.slug}`}
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
                        {BROWSE_TYPE_LABEL[l.accommodation_type ?? "other"] ??
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
                    // listing.base_price = effective "from" (per-person aware),
                    // maintained by recomputeListingFromRooms.
                    // Host base_price is ex-VAT; gross for display so the "from"
                    // rate matches what the guest is charged (0 = no-op).
                    const amount =
                      l.base_price != null
                        ? grossVat(Number(l.base_price), effectiveVatRate(l))
                        : null;
                    const fromLabel = l.booking_mode === "rooms_only";
                    const perLabel = "/ night";
                    if (amount == null) return null;
                    return (
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="num font-display font-bold text-brand-ink">
                          {fromLabel ? "from " : ""}
                          <Money amount={amount} currency={l.currency} />
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

      {totalPages > 1 && listings.length > 0 ? (
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
    </>
  );
}
