import { Star } from "lucide-react";

import type { HomeReview } from "./home-data";

export function RecentReviews({ reviews }: { reviews: HomeReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              From the guests
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
              Real stays. Real reviews.
            </h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:gap-5">
          {reviews.map((r, i) => (
            <div key={i} className="rounded-card border border-brand-line p-6">
              <div className="mb-3 flex items-center gap-0.5 text-amber-400">
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="leading-relaxed text-brand-ink">{r.body}</p>
              <div className="mt-5 flex items-center gap-3 border-t border-brand-line pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent text-xs font-semibold text-brand-secondary">
                  {r.initials}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-brand-ink">
                    {r.name}
                  </div>
                  <div className="text-xs text-brand-mute">{r.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
