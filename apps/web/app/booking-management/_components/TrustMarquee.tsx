const BRANDS = [
  { name: "Karoo Cottages", classes: "font-bold tracking-tight" },
  { name: "Tide & Tarn", classes: "font-semibold" },
  { name: "DRAKENBERG", classes: "font-bold tracking-widest" },
  { name: "Stellenbosch Stays", classes: "font-medium" },
  { name: "Kalahari Co.", classes: "font-bold" },
  { name: "Bay Safari", classes: "font-semibold" },
] as const;

export function TrustMarquee() {
  // Duplicate the set so the -50% keyframe loops seamlessly.
  const sequence = [...BRANDS, ...BRANDS];

  return (
    <section className="border-b border-brand-line bg-white">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-10 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Built for &amp; trusted by
          </div>
          <div className="mt-1 font-display text-lg font-semibold leading-snug text-brand-dark">
            Hosts from Cape Town to Kruger.
          </div>
        </div>

        <div className="relative overflow-hidden lg:col-span-9">
          <div className="absolute bottom-0 left-0 top-0 z-10 w-12 bg-gradient-to-r from-white to-transparent" />
          <div className="absolute bottom-0 right-0 top-0 z-10 w-12 bg-gradient-to-l from-white to-transparent" />
          <div className="marquee-track flex items-center gap-12 whitespace-nowrap">
            {sequence.map((b, i) => (
              <span key={`${b.name}-${i}`} className="flex items-center gap-12">
                <span
                  className={`font-display text-2xl text-brand-mute ${b.classes}`}
                >
                  {b.name}
                </span>
                <span className="text-brand-line">●</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
