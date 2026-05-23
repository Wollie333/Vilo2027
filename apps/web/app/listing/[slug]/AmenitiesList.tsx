import {
  Bath,
  CheckCircle2,
  Cigarette,
  Coffee,
  Dog,
  Flame,
  Flower2,
  Heart,
  Home,
  ShieldCheck,
  Sparkles,
  Tv,
  Users,
  Utensils,
  Wifi,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICON: Record<string, LucideIcon> = {
  wifi: Wifi,
  kitchen: Utensils,
  parking: Home,
  pool: Bath,
  hot_tub: Bath,
  aircon: Wind,
  heating: Flame,
  fireplace: Flame,
  tv: Tv,
  washer: Sparkles,
  dryer: Sparkles,
  workspace: Coffee,
  braai: Flame,
  pet_friendly: Dog,
  family_friendly: Users,
  wheelchair: Heart,
  smoke_alarm: Cigarette,
  first_aid: ShieldCheck,
  self_checkin: Zap,
  host_onsite: Flower2,
};

const LABEL: Record<string, string> = {
  wifi: "WiFi",
  kitchen: "Kitchen",
  parking: "Free parking",
  pool: "Pool",
  hot_tub: "Hot tub",
  aircon: "Air conditioning",
  heating: "Heating",
  fireplace: "Fireplace",
  tv: "TV",
  washer: "Washing machine",
  dryer: "Tumble dryer",
  workspace: "Workspace",
  braai: "Braai / BBQ",
  pet_friendly: "Pet friendly",
  family_friendly: "Family friendly",
  wheelchair: "Wheelchair accessible",
  smoke_alarm: "Smoke alarm",
  first_aid: "First-aid kit",
  self_checkin: "Self check-in",
  host_onsite: "Host on-site",
};

export function AmenitiesList({ keys }: { keys: string[] }) {
  if (keys.length === 0) {
    return (
      <p className="text-sm text-brand-mute">
        The host hasn&rsquo;t added amenities yet.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {keys.map((k) => {
        const Icon = ICON[k] ?? CheckCircle2;
        return (
          <li key={k} className="flex items-center gap-3">
            <Icon className="h-4 w-4 shrink-0 text-brand-primary" />
            <span className="text-sm text-brand-dark">
              {LABEL[k] ?? humanize(k)}
            </span>
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
