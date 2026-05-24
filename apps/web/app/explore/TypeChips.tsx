"use client";

import {
  Building2,
  Compass,
  Home,
  Mountain,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Chip = { key: string; label: string; icon: LucideIcon };

const CHIPS: Chip[] = [
  { key: "", label: "All", icon: Sparkles },
  { key: "self_catering", label: "Self-catering", icon: Home },
  { key: "bb", label: "B&B", icon: Building2 },
  { key: "guesthouse", label: "Guesthouse", icon: Building2 },
  { key: "lodge", label: "Lodge", icon: Mountain },
  { key: "hotel", label: "Hotel", icon: Building2 },
  { key: "experience", label: "Experiences", icon: Compass },
];

export function TypeChips({ currentType }: { currentType: string }) {
  const sp = useSearchParams();

  function hrefFor(typeKey: string): string {
    // Reset to page 1 whenever the type changes so users don't land on an
    // out-of-range page.
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
      {CHIPS.map(({ key, label, icon: Icon }) => {
        const isActive = currentType === key;
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
