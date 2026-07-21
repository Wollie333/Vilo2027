import { ArrowRight, MapPin, Star, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Money } from "@/components/currency/Money";

import { HeartButton } from "./HeartButton";
import type { HomeListingCard } from "./home-data";
import { Link } from "@/i18n/navigation";

export async function FeaturedListings({
  listings,
  totalStays,
}: {
  listings: HomeListingCard[];
  totalStays: number;
}) {
  if (listings.length === 0) return null;

  const t = await getTranslations("home");
  const totalLabel = totalStays.toLocaleString("en-ZA").replace(/,/g, " ");

  return (
    <section id="deals" className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="mb-6 flex items-end justify-between gap-6">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              {t("featuredEyebrow")}
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
              {t("featuredTitle")}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-brand-mute md:text-base">
              {t("featuredBody")}
            </p>
          </div>
        </div>

        {/* Mobile: a swipeable rail, so four stacked cards don't push the rest
            of the page below the fold. Grid from the small breakpoint up. */}
        <div className="hscroll -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-6">
          {listings.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group w-[78%] shrink-0 snap-start overflow-hidden rounded-card sm:w-auto"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-brand-accent">
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.image}
                    alt={l.name}
                    loading="lazy"
                    className="card-img absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-brand-mute">
                    <MapPin className="h-10 w-10" />
                  </div>
                )}
                {l.badge ? (
                  <span
                    className={`absolute left-3 top-3 rounded-pill px-2 py-0.5 text-[10px] font-bold ${
                      l.badge.tone === "instant"
                        ? "inline-flex items-center gap-1 bg-brand-secondary text-white"
                        : "bg-brand-ink text-white"
                    }`}
                  >
                    {l.badge.tone === "instant" ? (
                      <>
                        <Zap className="h-3 w-3" /> {l.badge.label}
                      </>
                    ) : (
                      l.badge.label
                    )}
                  </span>
                ) : null}
                <HeartButton />
              </div>
              <div className="pt-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-semibold text-brand-ink transition-colors group-hover:text-brand-secondary">
                      {l.name}
                    </div>
                    {l.location ? (
                      <div className="mt-0.5 text-xs text-brand-mute">
                        {l.location}
                      </div>
                    ) : null}
                  </div>
                  {l.rating ? (
                    <div className="flex shrink-0 items-center gap-1 text-xs">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-brand-ink">
                        {l.rating}
                      </span>
                      <span className="num text-brand-mute">{l.reviews}</span>
                    </div>
                  ) : null}
                </div>
                {l.detail ? (
                  <div className="mt-1 text-xs text-brand-mute">{l.detail}</div>
                ) : null}
                {l.priceAmount != null ? (
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="num font-display font-bold text-brand-ink">
                      {l.fromLabel ? "from " : ""}
                      <Money
                        amount={l.priceAmount}
                        currency={l.priceCurrency}
                      />
                    </span>
                    <span className="text-xs text-brand-mute">
                      {l.perLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded border border-brand-line bg-white px-5 py-3 font-medium text-brand-ink transition-colors hover:bg-brand-accent"
          >
            {t("featuredShowAll", { count: totalLabel })}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
