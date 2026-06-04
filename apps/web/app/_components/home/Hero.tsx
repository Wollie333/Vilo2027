import {
  BadgeCheck,
  Lock,
  Percent,
  Search,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { getBrandName } from "@/lib/brand";

import type { HomeListingCard, HomeStats } from "./home-data";

function fmtNum(n: number): string {
  return n.toLocaleString("en-ZA").replace(/,/g, " ");
}

// Fallback hero image when there's no featured listing photo yet.
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1000&q=80&auto=format&fit=crop";

export async function Hero({
  stats,
  popularCities,
  featured,
}: {
  stats: HomeStats;
  popularCities: string[];
  featured: HomeListingCard[];
}) {
  const brandName = await getBrandName();
  const hero = featured[0] ?? null;
  const heroImage = hero?.image ?? FALLBACK_IMAGE;
  const reviewCount = hero?.reviews ? hero.reviews.replace(/[()]/g, "") : null;
  const showInstant = !hero || hero.badge?.tone === "instant";

  return (
    <section
      className="relative overflow-hidden border-b border-brand-line text-white"
      style={{
        background:
          "linear-gradient(150deg,#11201A 0%,#0A1410 55%,#06100C 100%)",
      }}
    >
      {/* Background accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-[26rem] w-[26rem] rounded-full bg-brand-primary/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-14 pt-14 lg:grid-cols-12 lg:gap-14 lg:px-8 lg:pb-20 lg:pt-20">
        {/* LEFT — copy, search, trust */}
        <div className="lg:col-span-6">
          <span className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            Direct booking platform &middot; South Africa
          </span>

          <h1 className="mt-5 font-display text-[40px] font-extrabold leading-[1.02] tracking-tight text-white md:text-5xl lg:text-[58px]">
            Exceptional stays,
            <br />
            <span className="text-emerald-300">booked direct.</span>
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/80 md:text-lg">
            {stats.properties > 0 ? (
              <>
                Browse {fmtNum(stats.properties)} verified{" "}
                {stats.properties === 1 ? "property" : "properties"} and book
                straight with the host &mdash; secure payment, zero booking
                fees, no middle-man.
              </>
            ) : (
              <>
                Book straight with the host &mdash; secure payment, zero booking
                fees, no middle-man.
              </>
            )}
          </p>

          {/* COMPACT search bar — native GET form, works without JS */}
          <div className="mt-8 max-w-xl">
            <form
              action="/explore"
              method="get"
              className="flex items-center rounded-pill border border-brand-line bg-white p-1.5 shadow-lift"
            >
              <label className="min-w-0 flex-[1.4] cursor-text rounded-pill px-4 py-2 transition-colors hover:bg-brand-light">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                  Where
                </div>
                <input
                  type="text"
                  name="where"
                  placeholder="Anywhere in SA"
                  aria-label="Search destinations, regions or towns"
                  className="w-full truncate bg-transparent text-sm font-medium text-brand-ink outline-none placeholder:text-brand-mute/70"
                />
              </label>

              <span className="hidden h-9 w-px shrink-0 bg-brand-line sm:block" />

              <div className="hidden min-w-0 flex-1 px-4 py-2 sm:block">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                  When
                </div>
                <div className="truncate text-sm font-medium text-brand-ink">
                  Any week
                </div>
              </div>

              <span className="h-9 w-px shrink-0 bg-brand-line" />

              <label className="min-w-0 flex-1 px-4 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                  Guests
                </div>
                <select
                  name="guests"
                  defaultValue=""
                  aria-label="Number of guests"
                  className="w-full truncate bg-transparent text-sm font-medium text-brand-ink outline-none"
                >
                  <option value="">Any guests</option>
                  <option value="1">1 guest</option>
                  <option value="2">2 guests</option>
                  <option value="4">4 guests</option>
                  <option value="6">6 guests</option>
                  <option value="8">8+ guests</option>
                </select>
              </label>

              <button
                type="submit"
                aria-label="Search"
                className="ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white transition-colors hover:bg-brand-secondary"
              >
                <Search className="h-5 w-5" />
              </button>
            </form>

            {popularCities.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-xs text-white/60">
                <span className="font-medium">Popular:</span>
                {popularCities.slice(0, 4).map((c, i) => (
                  <span key={c} className="inline-flex items-center gap-2">
                    {i > 0 ? (
                      <span className="text-white/25">&middot;</span>
                    ) : null}
                    <Link
                      href={`/explore?where=${encodeURIComponent(c)}`}
                      className="hover:text-white"
                    >
                      {c}
                    </Link>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Trust row */}
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-300" />
              <span className="text-xs text-white/70">
                Secure Paystack &amp; PayPal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-300" />
              <span className="text-xs text-white/70">ID-verified hosts</span>
            </div>
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-emerald-300" />
              <span className="text-xs text-white/70">
                0% guest booking fees
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT — featured image + floating cards */}
        <div className="relative lg:col-span-6">
          <div className="relative mx-auto max-w-[540px]">
            <div className="relative overflow-hidden rounded-[24px] shadow-lift ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={hero?.name ?? `Featured ${brandName} stay`}
                className="aspect-[5/4] w-full object-cover"
              />
              {showInstant ? (
                <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-pill bg-white/95 px-3 py-1 text-[11px] font-semibold text-brand-secondary shadow-card backdrop-blur">
                  <Zap className="h-3 w-3 text-brand-primary" /> Instant Book
                </div>
              ) : null}
            </div>

            {/* Floating: featured listing summary (live data) */}
            {hero ? (
              <Link
                href={hero.href}
                className="absolute -bottom-6 -left-3 w-[250px] rounded-2xl border border-brand-line bg-white p-4 shadow-lift transition-shadow hover:shadow-glow md:-left-8"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                      Featured
                    </div>
                    <div className="truncate font-display text-sm font-bold leading-tight text-brand-ink">
                      {hero.name}
                    </div>
                    {hero.location ? (
                      <div className="mt-0.5 truncate text-[11px] text-brand-mute">
                        {hero.location}
                      </div>
                    ) : null}
                  </div>
                  {hero.price ? (
                    <div className="shrink-0 text-right">
                      <div className="num font-display text-base font-bold text-brand-primary">
                        {hero.price}
                      </div>
                      <div className="text-[10px] text-brand-mute">
                        {hero.perLabel}
                      </div>
                    </div>
                  ) : null}
                </div>
                {hero.rating && reviewCount ? (
                  <div className="mt-2.5 flex items-center gap-1.5 border-t border-brand-line pt-2.5 text-[11px]">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-brand-ink">
                      {hero.rating}
                    </span>
                    <span className="text-brand-mute">
                      &middot; {reviewCount} reviews
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-brand-primary">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  </div>
                ) : null}
              </Link>
            ) : null}

            {/* Floating: commission stat */}
            <div className="absolute -right-3 -top-5 w-[160px] rounded-2xl bg-brand-dark p-3.5 text-white shadow-lift md:-right-7">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-accent/80">
                Guests save
              </div>
              <div className="num mt-0.5 font-display text-2xl font-extrabold">
                100%
              </div>
              <div className="mt-0.5 text-[10px] text-white/55">
                of platform fees
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
