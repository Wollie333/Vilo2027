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

import { getAmenityIndex } from "@/lib/taxonomy/getAmenities";

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

export async function AmenitiesList({ keys }: { keys: string[] }) {
  if (keys.length === 0) {
    return (
      <p className="text-sm text-brand-mute">
        The host hasn&rsquo;t added amenities yet.
      </p>
    );
  }

  const catalog = await getAmenityIndex();

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {keys.map((k) => {
        const entry = catalog.get(k);
        const Icon = entry ? (ICONS[entry.icon] ?? CheckCircle2) : CheckCircle2;
        const label = entry?.label ?? humanize(k);
        return (
          <li key={k} className="flex items-center gap-3">
            <Icon className="h-4 w-4 shrink-0 text-brand-primary" />
            <span className="text-sm text-brand-dark">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function humanize(key: string): string {
  return key
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
