import {
  Accessibility,
  BedDouble,
  Building2,
  Car,
  CheckCircle2,
  Coffee,
  Compass,
  DoorOpen,
  Flame,
  Home,
  Hotel,
  House,
  Map,
  Mountain,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Tent,
  TreePine,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import type { HomeChip } from "./home-data";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  compass: Compass,
  home: Home,
  house: House,
  "building-2": Building2,
  hotel: Hotel,
  tent: Tent,
  coffee: Coffee,
  "door-open": DoorOpen,
  utensils: Utensils,
  map: Map,
  mountain: Mountain,
  palette: Palette,
  car: Car,
  "bed-double": BedDouble,
  flame: Flame,
  "tree-pine": TreePine,
  accessibility: Accessibility,
};

export function CategoryChips({ chips }: { chips: HomeChip[] }) {
  // Always show at least "All stays"; hide the strip only if nothing at all.
  if (chips.length <= 1) return null;

  return (
    <section className="sticky top-16 z-30 border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="hscroll flex items-center gap-1 overflow-x-auto py-3">
          {chips.map(({ slug, label, icon }) => {
            const Icon = ICONS[icon] ?? CheckCircle2;
            const href = slug ? `/explore?type=${slug}` : "/explore";
            return (
              <Link
                key={slug || "all"}
                href={href}
                className="inline-flex shrink-0 items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium text-brand-mute transition-colors hover:bg-brand-accent hover:text-brand-ink"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/explore"
            className="ml-auto inline-flex shrink-0 items-center gap-2 rounded border border-brand-line px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Link>
        </div>
      </div>
    </section>
  );
}
