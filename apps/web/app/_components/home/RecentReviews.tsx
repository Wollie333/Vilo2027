import { Star } from "lucide-react";

type Review = {
  body: string;
  initials: string;
  name: string;
  detail: string;
  avatarBg: string;
  avatarText: string;
};

const REVIEWS: Review[] = [
  {
    body: '"Booked the Karoo Cottage directly with Lerato — replied in twelve minutes, sent extra blanket photos when I asked. Felt human in a way booking sites never do."',
    initials: "AM",
    name: "Anna M.",
    detail: "Karoo Cottage · Sept 2026",
    avatarBg: "bg-brand-accent",
    avatarText: "text-brand-secondary",
  },
  {
    body: '"Drakensberg Lodge for the long weekend — exactly the photos, exactly the price. No surprise cleaning fee at checkout. Refreshing."',
    initials: "JV",
    name: "Jordan V.",
    detail: "Drakensberg Lodge · Oct 2026",
    avatarBg: "bg-brand-primary",
    avatarText: "text-white",
  },
  {
    body: '"Tide Beach House for ten days. The instant-book flow took thirty seconds and Naledi WhatsApped me directions before I\'d left Cape Town."',
    initials: "SK",
    name: "Sam K.",
    detail: "Tide Beach House · Aug 2026",
    avatarBg: "bg-brand-secondary",
    avatarText: "text-white",
  },
];

export function RecentReviews() {
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
          <div className="hidden shrink-0 items-center gap-3 md:flex">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 font-display text-2xl font-bold text-brand-ink">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" /> 4.83
              </div>
              <div className="text-xs text-brand-mute">
                across 12 489 verified reviews
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:gap-5">
          {REVIEWS.map((r) => (
            <div
              key={r.name}
              className="rounded-card border border-brand-line p-6"
            >
              <div className="mb-3 flex items-center gap-0.5 text-amber-400">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="leading-relaxed text-brand-ink">{r.body}</p>
              <div className="mt-5 flex items-center gap-3 border-t border-brand-line pt-5">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${r.avatarBg} ${r.avatarText}`}
                >
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
