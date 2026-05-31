import { Calendar, MapPin, Search, Users } from "lucide-react";
import Link from "next/link";

import type { HomeStats } from "./home-data";

function fmtNum(n: number): string {
  return n.toLocaleString("en-ZA").replace(/,/g, " ");
}

export function Hero({
  stats,
  popularCities,
}: {
  stats: HomeStats;
  popularCities: string[];
}) {
  const statCards = [
    {
      value: fmtNum(stats.properties),
      label: "Verified properties",
      mono: true,
    },
    { value: fmtNum(stats.hosts), label: "Trusted hosts", mono: true },
    { value: fmtNum(stats.provinces), label: "Provinces covered", mono: true },
    { value: "0%", label: "Guest booking fees", mono: false },
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1800&q=80&auto=format&fit=crop"
          alt="South African landscape"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div aria-hidden className="hero-veil absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-16 lg:px-8 lg:pb-32 lg:pt-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            {stats.properties > 0
              ? `${fmtNum(stats.properties)} verified ${stats.properties === 1 ? "property" : "properties"} · book direct with the host`
              : "Book direct with the host"}
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.04] tracking-tight text-white md:text-5xl lg:text-[64px]">
            Find your next stay.
            <br />
            <span className="text-brand-accent">
              Pay the host. Not the platform.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            From a cottage in the Karoo to a lodge in the Drakensberg — every
            booking goes straight to the host. No middle-man, no booking fees,
            no fine print.
          </p>
        </div>

        {/* Search card */}
        <div className="relative mt-10 max-w-5xl rounded-card bg-white p-2 shadow-lift lg:mt-12">
          <form
            className="grid grid-cols-2 divide-x divide-brand-line lg:grid-cols-[2fr_1.3fr_1.3fr_1.2fr_auto]"
            action="/explore"
            method="get"
          >
            <label className="col-span-2 cursor-pointer rounded-card px-5 py-3 transition-colors hover:bg-brand-light/60 lg:col-span-1 lg:py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                Where
              </div>
              <div className="mt-1 flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-brand-primary" />
                <input
                  type="text"
                  name="where"
                  placeholder="Search destinations, regions, towns"
                  className="w-full bg-transparent text-sm font-medium text-brand-ink outline-none placeholder:text-brand-mute/70"
                />
              </div>
            </label>

            <label className="cursor-pointer px-5 py-3 transition-colors hover:bg-brand-light/60 lg:py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                Check in
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-brand-primary" />
                <span className="text-sm font-medium text-brand-ink">
                  Fri, 14 Nov
                </span>
              </div>
            </label>

            <label className="cursor-pointer px-5 py-3 transition-colors hover:bg-brand-light/60 lg:py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                Check out
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-brand-primary" />
                <span className="text-sm font-medium text-brand-ink">
                  Mon, 17 Nov
                </span>
              </div>
            </label>

            <label className="cursor-pointer px-5 py-3 transition-colors hover:bg-brand-light/60 lg:py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                Guests
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-brand-primary" />
                <span className="text-sm font-medium text-brand-ink">
                  2 adults
                </span>
              </div>
            </label>

            <div className="col-span-2 border-t border-brand-line p-2 lg:col-span-1 lg:flex lg:items-center lg:border-t-0 lg:p-0 lg:pr-2">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary px-4 py-3 font-medium text-white transition-colors hover:bg-brand-secondary lg:h-[68px] lg:w-auto lg:px-7"
              >
                <Search className="h-5 w-5" />
                <span>Search</span>
              </button>
            </div>
          </form>

          {popularCities.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-brand-line px-3 py-2.5">
              <span className="pl-2 text-xs font-medium text-brand-mute">
                Popular:
              </span>
              {popularCities.map((p) => (
                <Link
                  key={p}
                  href={`/explore?where=${encodeURIComponent(p)}`}
                  className="rounded-pill bg-brand-light px-3 py-1 text-xs font-medium text-brand-ink transition-colors hover:bg-brand-accent"
                >
                  {p}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 text-white md:grid-cols-4 lg:mt-16">
          {statCards.map((s) => (
            <div key={s.label}>
              <div
                className={`font-display text-2xl font-bold md:text-3xl ${s.mono ? "num" : ""}`}
              >
                {s.value}
              </div>
              <div className="mt-0.5 text-xs text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
