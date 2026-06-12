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
import { getTranslations } from "next-intl/server";

import { getBrandName } from "@/lib/brand";
import { Link } from "@/i18n/navigation";

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
  const [brandName, t] = await Promise.all([
    getBrandName(),
    getTranslations("listing"),
  ]);
  const countryLabel =
    country === "ZA" ? t("countrySouthAfrica") : (country ?? null);
  const crumbs = [countryLabel, province, city].filter(Boolean) as string[];
  const hasReviews = rating != null && reviewCount != null && reviewCount > 0;

  return (
    <section className="relative isolate overflow-hidden bg-white text-brand-ink">
      <div className="relative mx-auto max-w-7xl px-5 pb-[150px] pt-5 sm:pb-[176px] lg:px-8">
        {/* Breadcrumb — dark trail, green active page. */}
        <nav
          aria-label={t("heroBreadcrumbAria")}
          className="hscroll flex items-center gap-1.5 overflow-x-auto text-[12px] text-brand-mute"
        >
          <Link href="/" className="shrink-0 hover:text-brand-ink">
            {brandName}
          </Link>
          {crumbs.map((c) => (
            <span key={c} className="flex shrink-0 items-center gap-1.5">
              <ChevronRight className="h-3 w-3 opacity-60" />
              <span className="hover:text-brand-ink">{c}</span>
            </span>
          ))}
          <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
          <span className="truncate font-semibold text-brand-primary">
            {name}
          </span>
        </nav>

        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {isSuperhost ? (
                <span className="pill pill-success">
                  <Award className="h-3 w-3" /> {t("heroSuperhost")}
                </span>
              ) : null}
              {isFavourite ? (
                <span className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary">
                  <Sparkles className="h-3 w-3" /> {t("heroGuestFavourite")}
                </span>
              ) : null}
              {instantBooking ? (
                <span className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary">
                  <Zap className="h-3 w-3" /> {t("instantBook")}
                </span>
              ) : null}
            </div>

            <h1 className="max-w-2xl text-balance font-display text-[30px] font-extrabold leading-[1.03] tracking-tight text-brand-ink sm:text-[38px] lg:text-[46px]">
              {name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-brand-mute">
              {hasReviews ? (
                <span className="inline-flex items-center gap-1.5 text-brand-ink">
                  <Star className="h-4 w-4 fill-amber-400 stroke-amber-400" />
                  <span className="num font-semibold">
                    {(rating ?? 0).toFixed(2)}
                  </span>
                  <span className="opacity-50">·</span>
                  <a
                    href="#sec-reviews"
                    className="num underline underline-offset-2"
                  >
                    {t("reviewsCount", { count: reviewCount ?? 0 })}
                  </a>
                </span>
              ) : null}
              {locationLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <a
                    href="#sec-location"
                    className="text-brand-ink underline underline-offset-2"
                  >
                    {locationLabel}
                  </a>
                </span>
              ) : null}
              {roomCount > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4" />
                  <span>
                    {t("heroRooms", { count: roomCount })}
                    {maxGuests != null
                      ? ` · ${t("sleepsUpTo", { count: maxGuests })}`
                      : ""}
                  </span>
                </span>
              ) : maxGuests != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4" />
                  <span>{t("heroSleepsUpTo", { count: maxGuests })}</span>
                </span>
              ) : null}
              {isVerified ? (
                <span className="inline-flex items-center gap-1.5 text-brand-mute">
                  <BadgeCheck className="h-4 w-4 text-brand-primary" />{" "}
                  {t("hlVerifiedTitle")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col items-stretch gap-3 md:ml-auto md:w-auto md:items-end">
            {trustCard}
            <div className="flex items-center gap-2 md:self-end">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
              >
                <Share2 className="h-4 w-4" /> {t("heroShare")}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
              >
                <Heart className="h-4 w-4" /> {t("heroSave")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
