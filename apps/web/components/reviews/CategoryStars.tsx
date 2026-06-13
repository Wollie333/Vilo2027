"use client";

import { Star } from "lucide-react";
import { useState } from "react";

/**
 * Compact, interactive 1–5 star row for a single rating dimension.
 *
 * Single source of truth for the click-to-rate star input — used by the guest's
 * listing-review form (per-category sub-ratings) and the host's rate-a-guest
 * modal (reputation dimensions). Clicking the current value clears it back to 0,
 * so an optional dimension can be unset again.
 */
export function CategoryStars({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-brand-ink">{label}</span>
      <div
        className="inline-flex items-center gap-0.5"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-label={`${label}: ${n} ${n === 1 ? "star" : "stars"}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => onChange(value === n ? 0 : n)}
            className="rounded p-0.5 transition-colors hover:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 disabled:cursor-not-allowed"
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                n <= display
                  ? "fill-amber-400 text-amber-400"
                  : "text-brand-mute/40"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
