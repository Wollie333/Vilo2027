type TypeCard = {
  title: string;
  meta: string;
  image: string;
  alt: string;
};

const TYPES: TypeCard[] = [
  {
    title: "Cottages",
    meta: "842 stays from R 850",
    image:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80&auto=format&fit=crop",
    alt: "Cottages",
  },
  {
    title: "Beach houses",
    meta: "316 stays from R 1 400",
    image:
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80&auto=format&fit=crop",
    alt: "Beach houses",
  },
  {
    title: "Mountain lodges",
    meta: "198 stays from R 1 800",
    image:
      "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80&auto=format&fit=crop",
    alt: "Mountain lodges",
  },
  {
    title: "Bush & safari",
    meta: "147 camps from R 2 600",
    image:
      "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&q=80&auto=format&fit=crop",
    alt: "Bush and safari camps",
  },
  {
    title: "Wine estates",
    meta: "92 stays from R 1 600",
    image:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80&auto=format&fit=crop",
    alt: "Wine estates",
  },
  {
    title: "Karoo retreats",
    meta: "74 stays from R 950",
    image:
      "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80&auto=format&fit=crop",
    alt: "Karoo retreats",
  },
];

export function BrowseByType() {
  return (
    <section id="types" className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              Browse by type
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
              What kind of stay?
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-5">
          {TYPES.map((t) => (
            <a
              key={t.title}
              href="#"
              className="group relative aspect-[16/10] overflow-hidden rounded-card border border-brand-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.image}
                alt={t.alt}
                loading="lazy"
                className="card-img absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <div className="font-display text-xl font-bold">{t.title}</div>
                <div className="num mt-0.5 text-xs text-white/80">{t.meta}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
