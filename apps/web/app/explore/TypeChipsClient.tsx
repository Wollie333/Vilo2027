"use client";

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
  Sparkles,
  Tent,
  TreePine,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

export function TypeChipsClient({
  chips,
  currentType,
}: {
  chips: Array<{ key: string; label: string; icon: string }>;
  currentType: string;
}) {
  const sp = useSearchParams();

  function hrefFor(typeKey: string): string {
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    if (typeKey) next.set("type", typeKey);
    else next.delete("type");
    const qs = next.toString();
    return qs ? `/explore?${qs}` : "/explore";
  }

  return (
    <nav
      aria-label="Filter listings by type"
      className="hscroll flex items-center gap-1 overflow-x-auto py-3"
    >
      {chips.map(({ key, label, icon }) => {
        const isActive = currentType === key;
        const Icon = ICONS[icon] ?? CheckCircle2;
        return (
          <Link
            key={key || "all"}
            href={hrefFor(key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "chip-active"
                : "text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
