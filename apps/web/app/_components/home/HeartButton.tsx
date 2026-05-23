"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

export function HeartButton() {
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      aria-label={saved ? "Unsave listing" : "Save listing"}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaved((s) => !s);
      }}
      className="heart-btn absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 hover:bg-white"
    >
      <Heart
        className={`h-4 w-4 ${saved ? "fill-status-cancelled text-status-cancelled" : "text-brand-ink"}`}
      />
    </button>
  );
}
