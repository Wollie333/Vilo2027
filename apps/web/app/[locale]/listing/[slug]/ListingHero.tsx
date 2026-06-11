import {
  Award,
  BadgeCheck,
  BedDouble,
  ChevronRight,
  Heart,
  MapPin,
  Share2,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { getBrandName } from "@/lib/brand";

/**
 * Full-bleed dark night-gradient hero for the public listing page
 * (per `Listing 3.0.html`). Holds the breadcrumb, title pills, name, the
 * rating/location/rooms meta and the host TrustCard. The photo gallery is
 * pulled up to overlap the bottom of this hero by the page layout.
 *
 * The TrustCard is passed in as a node so this component stays unaware of
 * host internals (the page already assembles it).
 */
export async function ListingHero({
  country,
  province,
  city,
  name,
  locationLabel,
  rating,
  reviewCount,
  isSuperhost,
  isVerified,
  isFavourite,
  instantBooking,
  roomCount,
  maxGuests,
  trustCard,
}: {
  country?: string | null;
  province?: string | null;
  city?: string | null;
  name: string;
  locationLabel: string;
  rating: number | null;
  reviewCount: number | null;
  isSuperhost: boolean;
  isVerified: boolean;
  isFavourite: boolean;
  instantBooking: boolean;
  roomCount: number;
  maxGuests: number | null;
  trustCard: React.ReactNode;
}) {
  const brandName = await getBrandName();
  const countryLabel = country === "ZA" ? "South Africa" : (country ?? null);
  const crumbs = [countryLabel, province, city].filter(Boolean) as string[];
  const hasReviews = rating != null && reviewCount != null && reviewCount > 0;

  return (
    <section
      className="relative isolate overflow-hidden text-white"
      style={{
        background:
          "linear-gradient(150deg,#11201A 0%,#0A1410 55%,#06100C 100%)",
      }}
    >
      <div
        aria-hidden
        className="dotgrid pointer-events-none absolute inset-0 opacity-[0.16]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-[26rem] w-[26rem] rounded-full bg-brand-primary/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-brand-secondary/40 blur-[120px]"
      />

      <div className="relative mx-auto max-w-7xl px-5 pb-[150px] pt-5 sm:pb-[176px] lg:px-8">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="hscroll flex items-center gap-1.5 overflow-x-auto text-[12px] text-white/60"
        >
          <Link href="/" className="shrink-0 hover:text-white">
            {brandName}
          </Link>
          {crumbs.map((c) => (
            <span key={c} className="flex shrink-0 items-center gap-1.5">
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="hover:text-white">{c}</span>
            </span>
          ))}
          <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
          <span className="truncate font-medium text-white">{name}</span>
        </nav>

        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {isSuperhost ? (
                <span className="pill pill-success">
                  <Award className="h-3 w-3" /> Superhost
                </span>
              ) : null}
              {isFavourite ? (
                <span className="inline-flex items-center gap-1 rounded-pill border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  <Sparkles className="h-3 w-3" /> Guest favourite
                </span>
              ) : null}
              {instantBooking ? (
                <span className="inline-flex items-center gap-1 rounded-pill border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  <Zap className="h-3 w-3" /> Instant book
                </span>
              ) : null}
            </div>

            <h1 className="max-w-2xl text-balance font-display text-[30px] font-extrabold leading-[1.03] tracking-tight sm:text-[38px] lg:text-[46px]">
              {name}
            </h1>

            <div className="text-white/72 mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
              {hasReviews ? (
                <span className="inline-flex items-center gap-1.5 text-white">
                  <Star className="h-4 w-4 fill-white stroke-white" />
                  <span className="num font-semibold">
                    {(rating ?? 0).toFixed(2)}
                  </span>
                  <span className="opacity-50">·</span>
                  <a
                    href="#sec-reviews"
                    className="num underline underline-offset-2"
                  >
                    {reviewCount} review{reviewCount === 1 ? "" : "s"}
                  </a>
                </span>
              ) : null}
              {locationLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <a
                    href="#sec-location"
                    className="text-white underline underline-offset-2"
                  >
                    {locationLabel}
                  </a>
                </span>
              ) : null}
              {roomCount > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4" />
                  <span>
                    {roomCount} room{roomCount === 1 ? "" : "s"}
                    {maxGuests != null ? ` · sleeps up to ${maxGuests}` : ""}
                  </span>
                </span>
              ) : maxGuests != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4" />
                  <span>Sleeps up to {maxGuests}</span>
                </span>
              ) : null}
              {isVerified ? (
                <span className="text-white/72 inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-brand-primary" /> Verified
                  host
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col items-stretch gap-3 md:ml-auto md:w-auto md:items-end">
            {trustCard}
            <div className="flex items-center gap-2 md:self-end">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded border border-white/20 bg-white/[0.07] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.14]"
              >
                <Share2 className="h-4 w-4" /> Share
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded border border-white/20 bg-white/[0.07] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.14]"
              >
                <Heart className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
