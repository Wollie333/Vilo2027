"use client";

import {
  Building2,
  Grape,
  Home,
  Mountain,
  PawPrint,
  SlidersHorizontal,
  Sparkles,
  Tent,
  Trees,
  Warehouse,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

type Chip = { key: string; label: string; icon: LucideIcon };

const CHIPS: Chip[] = [
  { key: "all", label: "All stays", icon: Sparkles },
  { key: "cottages", label: "Cottages", icon: Home },
  { key: "beach", label: "Beach houses", icon: Waves },
  { key: "lodges", label: "Lodges", icon: Mountain },
  { key: "bush", label: "Bush & safari", icon: Trees },
  { key: "vineyards", label: "Vineyards", icon: Grape },
  { key: "glamping", label: "Glamping", icon: Tent },
  { key: "farm", label: "Farm stays", icon: Warehouse },
  { key: "city", label: "City apartments", icon: Building2 },
  { key: "instant", label: "Instant book", icon: Zap },
  { key: "pets", label: "Pet friendly", icon: PawPrint },
];

export function CategoryChips() {
  const [active, setActive] = useState<string>("all");

  return (
    <section className="sticky top-16 z-30 border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="hscroll flex items-center gap-1 overflow-x-auto py-3">
          {CHIPS.map(({ key, label, icon: Icon }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "chip-active"
                    : "text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
          <button
            type="button"
            className="ml-auto inline-flex shrink-0 items-center gap-2 rounded border border-brand-line px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>
    </section>
  );
}
