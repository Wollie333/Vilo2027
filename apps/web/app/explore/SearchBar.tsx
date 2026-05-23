"use client";

import { Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBar({
  where,
  guests,
  currentType,
  currentSort,
}: {
  where: string;
  guests: number;
  currentType: string;
  currentSort: string;
}) {
  const router = useRouter();
  const [w, setW] = useState(where);
  const [g, setG] = useState<number>(guests);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (w.trim().length > 0) params.set("where", w.trim());
    if (g > 0) params.set("guests", String(g));
    if (currentType) params.set("type", currentType);
    if (currentSort && currentSort !== "newest")
      params.set("sort", currentSort);
    const qs = params.toString();
    router.push(qs ? `/explore?${qs}` : "/explore");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-2 rounded-card border border-brand-line bg-white p-2 shadow-card sm:grid-cols-[2fr_1fr_auto]"
    >
      <label className="flex items-center gap-2 rounded px-3 py-2 transition-colors hover:bg-brand-light/60">
        <Search className="h-4 w-4 shrink-0 text-brand-primary" />
        <input
          type="text"
          value={w}
          onChange={(e) => setW(e.target.value)}
          placeholder="Where to? City, region, town…"
          className="w-full bg-transparent text-sm font-medium text-brand-ink outline-none placeholder:text-brand-mute/70"
        />
      </label>

      <label className="flex items-center gap-2 rounded px-3 py-2 transition-colors hover:bg-brand-light/60">
        <Users className="h-4 w-4 shrink-0 text-brand-primary" />
        <select
          value={g}
          onChange={(e) => setG(parseInt(e.target.value, 10))}
          className="w-full bg-transparent text-sm font-medium text-brand-ink outline-none"
        >
          <option value={0}>Any guests</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16].map((n) => (
            <option key={n} value={n}>
              {n}+ {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
      >
        <Search className="h-4 w-4" />
        Search
      </button>
    </form>
  );
}
