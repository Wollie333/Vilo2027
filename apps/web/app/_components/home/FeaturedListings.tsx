import { ArrowLeft, ArrowRight, Star, Zap } from "lucide-react";

import { HeartButton } from "./HeartButton";

type Listing = {
  href: string;
  image: string;
  alt: string;
  name: string;
  location: string;
  rating: string;
  reviews: string;
  detail: string;
  price: string;
  badge?: { label: string; tone: "instant" | "featured" };
};

const LISTINGS: Listing[] = [
  {
    href: "/listing/karoo-cottage",
    image:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80&auto=format&fit=crop",
    alt: "Karoo Cottage",
    name: "Karoo Cottage",
    location: "Prince Albert · Western Cape",
    rating: "4.9",
    reviews: "(34)",
    detail: "Sleeps 4 · 2 bedrooms · Pet friendly",
    price: "R 1 200",
    badge: { label: "Instant book", tone: "instant" },
  },
  {
    href: "/listing/tide-beach-house",
    image:
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=600&q=80&auto=format&fit=crop",
    alt: "Tide Beach House",
    name: "Tide Beach House",
    location: "Wilderness · Garden Route",
    rating: "4.8",
    reviews: "(52)",
    detail: "Sleeps 6 · 3 bedrooms · Sea view",
    price: "R 2 450",
  },
  {
    href: "/listing/drakensberg-lodge",
    image:
      "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600&q=80&auto=format&fit=crop",
    alt: "Drakensberg Lodge",
    name: "Drakensberg Lodge",
    location: "Underberg · KwaZulu-Natal",
    rating: "5.0",
    reviews: "(118)",
    detail: "Sleeps 8 · 4 bedrooms · Fireplace",
    price: "R 3 800",
    badge: { label: "Featured", tone: "featured" },
  },
  {
    href: "/listing/vineyard-stay",
    image:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&q=80&auto=format&fit=crop",
    alt: "Vineyard Stay",
    name: "Vineyard Stay",
    location: "Stellenbosch · Cape Winelands",
    rating: "4.7",
    reviews: "(27)",
    detail: "Sleeps 2 · 1 bedroom · Vine views",
    price: "R 1 850",
    badge: { label: "Instant book", tone: "instant" },
  },
  {
    href: "/listing/lowveld-safari-camp",
    image:
      "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&q=80&auto=format&fit=crop",
    alt: "Lowveld Safari Camp",
    name: "Lowveld Safari Camp",
    location: "Hoedspruit · Limpopo",
    rating: "4.9",
    reviews: "(61)",
    detail: "Sleeps 6 · Game drives · All meals",
    price: "R 4 200",
  },
  {
    href: "/listing/knysna-forest-cabin",
    image:
      "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80&auto=format&fit=crop",
    alt: "Knysna Forest Cabin",
    name: "Knysna Forest Cabin",
    location: "Knysna · Garden Route",
    rating: "4.8",
    reviews: "(42)",
    detail: "Sleeps 3 · Hot tub · Forest views",
    price: "R 2 100",
  },
  {
    href: "/listing/camps-bay-villa",
    image:
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600&q=80&auto=format&fit=crop",
    alt: "Camps Bay Villa",
    name: "Camps Bay Villa",
    location: "Cape Town · Western Cape",
    rating: "5.0",
    reviews: "(89)",
    detail: "Sleeps 10 · Pool · Ocean view",
    price: "R 8 950",
    badge: { label: "Featured", tone: "featured" },
  },
  {
    href: "/listing/karoo-stargazer",
    image:
      "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600&q=80&auto=format&fit=crop",
    alt: "Karoo Stargazer",
    name: "Karoo Stargazer",
    location: "Sutherland · Northern Cape",
    rating: "4.9",
    reviews: "(73)",
    detail: "Sleeps 4 · Telescope · Dark skies",
    price: "R 1 690",
    badge: { label: "Instant book", tone: "instant" },
  },
];

export function FeaturedListings() {
  return (
    <section id="deals" className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              Featured stays
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
              Hand-picked, host-verified.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-brand-mute md:text-base">
              The places we&rsquo;d send our own friends. Real photos, fair
              pricing, and a host you can actually message.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <button
              type="button"
              aria-label="Previous"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-line text-brand-ink hover:bg-brand-accent"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-line text-brand-ink hover:bg-brand-accent"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {LISTINGS.map((l) => (
            <a
              key={l.name}
              href={l.href}
              className="group overflow-hidden rounded-card"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-brand-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.image}
                  alt={l.alt}
                  loading="lazy"
                  className="card-img absolute inset-0 h-full w-full object-cover"
                />
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
                    <div className="mt-0.5 text-xs text-brand-mute">
                      {l.location}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-brand-ink">
                      {l.rating}
                    </span>
                    <span className="num text-brand-mute">{l.reviews}</span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-brand-mute">{l.detail}</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="num font-display font-bold text-brand-ink">
                    {l.price}
                  </span>
                  <span className="text-xs text-brand-mute">/ night</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded border border-brand-line bg-white px-5 py-3 font-medium text-brand-ink transition-colors hover:bg-brand-accent"
          >
            Show all 2 348 stays
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
