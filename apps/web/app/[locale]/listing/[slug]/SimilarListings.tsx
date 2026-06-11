import { ArrowRight, MapPin, Star, Zap } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { Money } from "@/components/currency/Money";
import { HeartButton } from "@/app/_components/home/HeartButton";
import { createServerClient } from "@/lib/supabase/server";

type Row = {
  slug: string;
  name: string;
  city: string | null;
  province: string | null;
  base_price: number | null;
  currency: string;
  max_guests: number | null;
  bedrooms: number | null;
  booking_mode: string | null;
  avg_rating: number | null;
  total_reviews: number | null;
  instant_booking: boolean | null;
  photos: { url: string; sort_order: number }[] | null;
  listing_rooms:
    | {
        base_price: number | null;
        is_active: boolean | null;
        deleted_at: string | null;
      }[]
    | null;
};

function heroPhoto(photos: Row["photos"]): string | null {
  if (!photos || photos.length === 0) return null;
  return (
    [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null
  );
}

function amount(l: Row): number | null {
  // listing.base_price is the effective "from" price (cheapest active room incl.
  // per-person rates), maintained by recomputeListingFromRooms — use it so
  // per-person rooms (base_price 0, rate in price_per_person) still show.
  return l.base_price != null ? Number(l.base_price) : null;
}

const SELECT =
  "slug, name, city, province, base_price, currency, max_guests, bedrooms, booking_mode, avg_rating, total_reviews, instant_booking, photos:listing_photos ( url, sort_order ), listing_rooms ( base_price, is_active, deleted_at )";

/**
 * "Similar stays" — other published listings in the same province (same-city
 * first), excluding the current one. Server component; renders nothing when
 * there are no neighbours.
 */
export async function SimilarListings({
  currentSlug,
  city,
  province,
}: {
  currentSlug: string;
  city: string | null;
  province: string | null;
}) {
  if (!province && !city) return null;
  const supabase = createServerClient();

  let query = supabase
    .from("listings")
    .select(SELECT)
    .eq("is_published", true)
    .neq("slug", currentSlug)
    .limit(8);
  query = province ? query.eq("province", province) : query.eq("city", city!);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return null;

  // Same-city first, then by rating.
  const sorted = [...rows]
    .sort((a, b) => {
      const ac = a.city === city ? 0 : 1;
      const bc = b.city === city ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0);
    })
    .slice(0, 4);

  return (
    <section className="mt-14 border-t border-brand-line pt-10">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            More nearby
          </div>
          <h3 className="mt-1 font-display text-2xl font-bold text-brand-ink">
            Similar stays
          </h3>
        </div>
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:text-brand-primary"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map((l) => {
          const img = heroPhoto(l.photos);
          const amt = amount(l);
          const hasRating =
            l.avg_rating != null &&
            l.total_reviews != null &&
            l.total_reviews > 0;
          const location = [l.city, l.province].filter(Boolean).join(" · ");
          return (
            <Link
              key={l.slug}
              href={`/listing/${l.slug}`}
              className="group block"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-brand-accent">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt={l.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-brand-mute">
                    <MapPin className="h-10 w-10" />
                  </div>
                )}
                {l.instant_booking ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
                    <Zap className="h-3 w-3" /> Instant book
                  </span>
                ) : null}
                <HeartButton />
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-semibold text-brand-ink">
                    {l.name}
                  </div>
                  {location ? (
                    <div className="mt-0.5 text-xs text-brand-mute">
                      {location}
                    </div>
                  ) : null}
                </div>
                {hasRating ? (
                  <div className="inline-flex shrink-0 items-center gap-0.5 text-xs text-brand-ink">
                    <Star className="h-3.5 w-3.5 fill-brand-ink stroke-brand-ink" />
                    {Number(l.avg_rating).toFixed(2)}
                  </div>
                ) : null}
              </div>
              {amt != null ? (
                <div className="mt-1 text-sm text-brand-ink">
                  <span className="font-display font-bold">
                    <Money amount={amt} currency={l.currency} />
                  </span>{" "}
                  <span className="text-xs text-brand-mute">/ night</span>
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
