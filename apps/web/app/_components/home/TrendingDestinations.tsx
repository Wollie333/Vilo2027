import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";

import type { HomeDestination } from "./home-data";

export function TrendingDestinations({
  destinations,
}: {
  destinations: HomeDestination[];
}) {
  if (destinations.length === 0) return null;

  return (
    <section id="destinations" className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              Trending right now
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
              Where South Africa&rsquo;s going.
            </h2>
          </div>
          <Link
            href="/explore"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-secondary md:inline-flex"
          >
            See all destinations <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {destinations.map((d) => (
            <Link
              key={d.name}
              href={d.href}
              className="group overflow-hidden rounded-card border border-brand-line bg-white transition-shadow hover:shadow-card"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-brand-accent">
                {d.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.image}
                    alt={d.name}
                    loading="lazy"
                    className="card-img absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-brand-mute">
                    <MapPin className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3 text-white">
                  <div className="font-display text-base font-semibold leading-tight">
                    {d.name}
                  </div>
                  <div className="num text-[11px] text-white/80">{d.stays}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
