import { Home, Hotel, Plus, Building2, Tent } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { getBrandName } from "@/lib/brand";

const TILES = [
  {
    Icon: Home,
    title: "Whole place",
    sub: "Apartment, house, villa",
    type: "accommodation",
    sub_type: "self_catering",
  },
  {
    Icon: Building2,
    title: "Rooms",
    sub: "Guesthouse, B&B",
    type: "accommodation",
    sub_type: "bb",
  },
  {
    Icon: Hotel,
    title: "Boutique hotel",
    sub: "Multiple room types",
    type: "accommodation",
    sub_type: "hotel",
  },
  {
    Icon: Tent,
    title: "Lodge",
    sub: "Bush, farm, retreat",
    type: "accommodation",
    sub_type: "lodge",
  },
] as const;

// "Step 2 of 4" listing-teaser card from the design. Shown only when the
// host has not yet created their first listing. Each tile deep-links to
// /dashboard/properties/new with the relevant type pre-selected.
export async function FirstListingTeaser() {
  const brandName = await getBrandName();
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="grid gap-0 md:grid-cols-[1fr_1.2fr]">
        <div
          className="relative min-h-[260px] md:min-h-[280px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(209,250,229,0.6), rgba(240,253,244,0.9))",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-card bg-white text-brand-primary shadow-card">
              <Home className="h-10 w-10" />
            </div>
          </div>
        </div>

        <div className="p-7 md:p-8">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
            Start your first listing
          </div>
          <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-ink">
            Create your first listing
          </h3>
          <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-brand-mute">
            A villa, a guest cottage, a city apartment, a Karoo farmhouse —{" "}
            {brandName}
            handles all of it. Most hosts finish in under ten minutes.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TILES.map(({ Icon, title, sub, type, sub_type }) => (
              <Link
                key={title}
                href={`/dashboard/properties/new?kind=${type}&type=${sub_type}`}
                className="group flex flex-col items-start gap-1.5 rounded-[10px] border border-brand-line p-3 text-left transition hover:-translate-y-px hover:shadow-card"
              >
                <Icon className="h-4 w-4 text-brand-secondary" />
                <span className="text-[12px] font-semibold text-brand-ink">
                  {title}
                </span>
                <span className="text-[10.5px] text-brand-mute">{sub}</span>
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/properties/new"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Start new listing
            </Link>
            <Link
              href="/dashboard/calendar-sync"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-accent"
            >
              Import from Airbnb iCal
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
