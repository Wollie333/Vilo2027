import { ArrowRight, BadgeCheck, Star, Zap } from "lucide-react";

import { getBrandName } from "@/lib/brand";

type Listing = {
  href: string;
  image: string;
  alt: string;
  title: string;
  location: string;
  price: string;
  rating: string;
  reviews: string;
  badge?: { label: string; tone: "instant" | "featured" };
};

const LISTINGS: Listing[] = [
  {
    href: "/explore/karoo-cottage",
    image:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80&auto=format&fit=crop",
    alt: "Karoo Cottage",
    title: "Karoo Cottage",
    location: "Prince Albert · sleeps 4",
    price: "R 1 200",
    rating: "4.9",
    reviews: "(34)",
    badge: { label: "Instant", tone: "instant" },
  },
  {
    href: "/explore/tide-beach-house",
    image:
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=600&q=80&auto=format&fit=crop",
    alt: "Tide Beach House",
    title: "Tide Beach House",
    location: "Wilderness · sleeps 6",
    price: "R 2 450",
    rating: "4.8",
    reviews: "(52)",
  },
  {
    href: "/explore/drakensberg-lodge",
    image:
      "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600&q=80&auto=format&fit=crop",
    alt: "Drakensberg Lodge",
    title: "Drakensberg Lodge",
    location: "Underberg · sleeps 8",
    price: "R 3 800",
    rating: "5.0",
    reviews: "(118)",
    badge: { label: "Featured", tone: "featured" },
  },
  {
    href: "/explore/vineyard-stay",
    image:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&q=80&auto=format&fit=crop",
    alt: "Stellenbosch Vineyard Stay",
    title: "Vineyard Stay",
    location: "Stellenbosch · sleeps 2",
    price: "R 1 850",
    rating: "4.7",
    reviews: "(27)",
    badge: { label: "Instant", tone: "instant" },
  },
];

export async function DirectoryStrip() {
  const brandName = await getBrandName();
  return (
    <section className="border-b border-brand-line bg-brand-light">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              From the {brandName} Directory
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
              Real hosts. Real bookings.
            </h2>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-dark"
          >
            Browse the directory <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {LISTINGS.map((l) => (
            <a
              key={l.title}
              href={l.href}
              className="group overflow-hidden rounded-card border border-brand-line bg-white transition-shadow hover:shadow-card"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-brand-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.image}
                  alt={l.alt}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {l.badge ? (
                  <span
                    className={`absolute left-3 top-3 rounded-pill px-2 py-0.5 text-[10px] font-bold ${
                      l.badge.tone === "instant"
                        ? "inline-flex items-center gap-1 bg-brand-secondary text-white"
                        : "bg-brand-primary text-white"
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
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-display text-sm font-semibold text-brand-dark">
                      {l.title}
                    </div>
                    <div className="mt-0.5 text-xs text-brand-mute">
                      {l.location}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num-display font-display text-sm font-bold text-brand-primary">
                      {l.price}
                    </div>
                    <div className="text-[10px] text-brand-mute">/night</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px]">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="font-medium text-brand-dark">
                    {l.rating}
                  </span>
                  <span className="text-brand-mute">{l.reviews}</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-brand-primary">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
