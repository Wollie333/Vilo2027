import { ArrowRight } from "lucide-react";

type Destination = {
  name: string;
  stays: string;
  image: string;
  alt: string;
};

const DESTINATIONS: Destination[] = [
  {
    name: "Cape Town",
    stays: "412 stays",
    image:
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=400&q=75&auto=format&fit=crop",
    alt: "Cape Town",
  },
  {
    name: "Garden Route",
    stays: "287 stays",
    image:
      "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&q=75&auto=format&fit=crop",
    alt: "Garden Route",
  },
  {
    name: "Drakensberg",
    stays: "156 stays",
    image:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&q=75&auto=format&fit=crop",
    alt: "Drakensberg",
  },
  {
    name: "Kruger & Lowveld",
    stays: "198 stays",
    image:
      "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&q=75&auto=format&fit=crop",
    alt: "Kruger and Lowveld",
  },
  {
    name: "Karoo",
    stays: "94 stays",
    image:
      "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400&q=75&auto=format&fit=crop",
    alt: "Karoo",
  },
  {
    name: "Whale Coast",
    stays: "123 stays",
    image:
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=400&q=75&auto=format&fit=crop",
    alt: "Whale Coast",
  },
];

export function TrendingDestinations() {
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
          <a
            href="#"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-secondary md:inline-flex"
          >
            See all destinations <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {DESTINATIONS.map((d) => (
            <a
              key={d.name}
              href="#"
              className="group overflow-hidden rounded-card border border-brand-line bg-white transition-shadow hover:shadow-card"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-brand-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.image}
                  alt={d.alt}
                  loading="lazy"
                  className="card-img absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3 text-white">
                  <div className="font-display text-base font-semibold leading-tight">
                    {d.name}
                  </div>
                  <div className="num text-[11px] text-white/80">{d.stays}</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
