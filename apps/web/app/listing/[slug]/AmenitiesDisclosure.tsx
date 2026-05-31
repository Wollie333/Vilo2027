"use client";

import {
  Accessibility,
  Baby,
  Bath,
  BellRing,
  Car,
  CheckCircle2,
  Coffee,
  Cross,
  Dog,
  Flame,
  KeyRound,
  Laptop,
  Shirt,
  ShieldCheck,
  SquareParking,
  Sparkles,
  TreePine,
  Tv,
  UserCheck,
  Users,
  Utensils,
  UtensilsCrossed,
  Waves,
  Wifi,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

const ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  utensils: Utensils,
  "square-parking": SquareParking,
  wind: Wind,
  flame: Flame,
  tv: Tv,
  shirt: Shirt,
  laptop: Laptop,
  "key-round": KeyRound,
  "user-check": UserCheck,
  waves: Waves,
  bath: Bath,
  "utensils-crossed": UtensilsCrossed,
  users: Users,
  "paw-print": Dog,
  "bell-ring": BellRing,
  cross: Cross,
  accessibility: Accessibility,
  "tree-pine": TreePine,
  sparkles: Sparkles,
  "check-circle-2": CheckCircle2,
  baby: Baby,
  "shield-check": ShieldCheck,
  car: Car,
  coffee: Coffee,
};

export type AmenityItem = { key: string; label: string; icon: string };

/**
 * Renders the resolved amenity list, collapsing to `initial` rows with a
 * "Show all N amenities" toggle (design behaviour). Icons are resolved
 * client-side from the serialisable icon key.
 */
export function AmenitiesDisclosure({
  items,
  initial = 10,
}: {
  items: AmenityItem[];
  initial?: number;
}) {
  const [open, setOpen] = useState(false);
  const visible = open ? items : items.slice(0, initial);
  const hasMore = items.length > initial;

  return (
    <>
      <ul className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
        {visible.map((a) => {
          const Icon = ICONS[a.icon] ?? CheckCircle2;
          return (
            <li key={a.key} className="flex items-center gap-3 py-1">
              <Icon className="h-5 w-5 shrink-0 text-brand-mute" />
              <span className="text-[15px] text-brand-ink">{a.label}</span>
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-6 inline-flex items-center gap-1.5 rounded border border-brand-ink px-4 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-ink hover:text-white"
        >
          {open ? "Show less" : `Show all ${items.length} amenities`}
        </button>
      ) : null}
    </>
  );
}
