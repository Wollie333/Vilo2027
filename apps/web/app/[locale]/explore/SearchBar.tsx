"use client";

import { ArrowDownUp, Search, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { DEFAULT_SORT } from "@/app/_components/browse/browseSort";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: DEFAULT_SORT, label: "Best match" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price · low to high" },
  { value: "price_desc", label: "Price · high to low" },
  { value: "rating", label: "Top-rated" },
];

export function SearchBar({
  where,
  guests,
  currentType,
  currentSort,
  basePath = "/explore",
}: {
  where: string;
  guests: number;
  currentType: string;
  currentSort: string;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [w, setW] = useState(where);
  const [g, setG] = useState<number>(guests);
  const [s, setS] = useState<string>(currentSort || DEFAULT_SORT);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Start from the current URL so the advanced filters set in the Filters
    // sheet survive a search — searching narrows, it does not reset.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (w.trim().length > 0) params.set("where", w.trim());
    else params.delete("where");
    if (g > 0) params.set("guests", String(g));
    else params.delete("guests");
    if (currentType) params.set("type", currentType);
    else params.delete("type");
    if (s && s !== DEFAULT_SORT) params.set("sort", s);
    else params.delete("sort");
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-2 rounded-card border border-brand-line bg-white p-2 shadow-card sm:grid-cols-[2fr_1fr_1fr_auto]"
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
          aria-label="Minimum guest capacity"
        >
          <option value={0}>Any guests</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16].map((n) => (
            <option key={n} value={n}>
              {n}+ {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 rounded px-3 py-2 transition-colors hover:bg-brand-light/60">
        <ArrowDownUp className="h-4 w-4 shrink-0 text-brand-primary" />
        <select
          value={s}
          onChange={(e) => setS(e.target.value)}
          className="w-full bg-transparent text-sm font-medium text-brand-ink outline-none"
          aria-label="Sort order"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
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
