import { MapPin, Mountain, Plane, UtensilsCrossed } from "lucide-react";
import dynamic from "next/dynamic";

export type Poi = {
  id: string;
  category: "eat" | "do" | "travel";
  name: string;
  travelTime: string | null;
};

// Map is client-only (Leaflet touches the DOM) — load it without SSR.
const LocationMap = dynamic(
  () => import("./LocationMap").then((m) => m.LocationMap),
  { ssr: false },
);

const GROUPS: {
  key: Poi["category"];
  label: string;
  icon: typeof UtensilsCrossed;
}[] = [
  { key: "eat", label: "Eat", icon: UtensilsCrossed },
  { key: "do", label: "Do", icon: Mountain },
  { key: "travel", label: "Travel", icon: Plane },
];

/**
 * "Where you'll be" — approximate-location Leaflet map + host-curated
 * neighbourhood points of interest (Eat / Do / Travel). Renders only when
 * there are coordinates or POIs.
 */
export function LocationSection({
  lat,
  lng,
  city,
  province,
  pois,
}: {
  lat: number | null;
  lng: number | null;
  city: string | null;
  province: string | null;
  pois: Poi[];
}) {
  const hasMap = lat != null && lng != null;
  if (!hasMap && pois.length === 0) return null;

  const where = [city, province].filter(Boolean).join(", ");

  return (
    <section id="sec-location" className="border-b border-brand-line py-7">
      <h3 className="font-display text-xl font-bold text-brand-ink">
        Where you&rsquo;ll be
      </h3>
      {where ? (
        <div className="mt-1 text-sm text-brand-mute">{where}</div>
      ) : null}

      {hasMap ? (
        // `isolate` contains Leaflet's internal z-indexes (panes/controls up to
        // ~1000) + the z-[500] label inside their own stacking context, so they
        // can't render over the sticky header (z-40) when the page scrolls.
        <div className="relative isolate mt-5 overflow-hidden rounded-card border border-brand-line">
          <div className="aspect-[16/9] sm:aspect-[16/7]">
            <LocationMap lat={lat} lng={lng} />
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-pill border border-brand-line bg-white/85 px-2.5 py-1 text-[11px] text-brand-secondary backdrop-blur">
            <MapPin className="mr-1 inline-block h-3 w-3 align-text-bottom" />
            Approximate location · exact address shared after booking
          </div>
        </div>
      ) : null}

      {pois.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {GROUPS.map((g) => {
            const items = pois.filter((p) => p.category === g.key);
            if (items.length === 0) return null;
            const Icon = g.icon;
            return (
              <div key={g.key} className="rounded border border-brand-line p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-mute">
                  <Icon className="h-3.5 w-3.5" /> {g.label}
                </div>
                <ul className="mt-2 space-y-1.5 text-sm text-brand-ink">
                  {items.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>{p.name}</span>
                      {p.travelTime ? (
                        <span className="font-mono text-xs text-brand-mute">
                          {p.travelTime}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
