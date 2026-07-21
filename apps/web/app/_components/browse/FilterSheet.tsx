"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import type { BrowseAmenityOption } from "./browseAmenities";
import { DEFAULT_SORT } from "./browseSort";
import type { AdvancedFilters } from "./searchListings";

// Advanced filters for the public directory. The URL is the state: every
// control edits a local draft, and applying pushes a real, shareable,
// back-button-able /explore URL. The server already reads these params, so the
// sheet is an enhancement over that contract — never a replacement for it.

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: DEFAULT_SORT, label: "Best match" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price · low to high" },
  { value: "price_desc", label: "Price · high to low" },
  { value: "rating", label: "Top-rated" },
];

const ROOM_CHOICES = [1, 2, 3, 4, 5] as const;
const GUEST_CHOICES = [1, 2, 4, 6, 8, 10] as const;
const RATING_CHOICES = [3, 4, 5] as const;

type Draft = {
  minPrice: string;
  maxPrice: string;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  amenities: string[];
  instant: boolean;
  verified: boolean;
  rating: number | null;
  sort: string;
};

function draftFrom(
  advanced: AdvancedFilters,
  guests: number | null,
  sort: string,
): Draft {
  return {
    minPrice: advanced.minPrice != null ? String(advanced.minPrice) : "",
    maxPrice: advanced.maxPrice != null ? String(advanced.maxPrice) : "",
    bedrooms: advanced.bedrooms,
    bathrooms: advanced.bathrooms,
    guests,
    amenities: advanced.amenities,
    instant: advanced.instant,
    verified: advanced.verified,
    rating: advanced.rating,
    sort: sort || DEFAULT_SORT,
  };
}

const EMPTY: Draft = {
  minPrice: "",
  maxPrice: "",
  bedrooms: null,
  bathrooms: null,
  guests: null,
  amenities: [],
  instant: false,
  verified: false,
  rating: null,
  sort: DEFAULT_SORT,
};

/** Positive whole rands only; anything else means "no bound". */
function money(value: string): string | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

const pill = (active: boolean) =>
  `rounded-pill border px-3.5 py-2 text-sm font-medium transition-colors ${
    active
      ? "border-brand-primary bg-brand-primary text-white"
      : "border-brand-line bg-white text-brand-ink hover:bg-brand-accent"
  }`;

export function FilterSheet({
  advanced,
  advancedCount,
  guests,
  sort,
  amenityOptions,
  basePath = "/explore",
}: {
  advanced: AdvancedFilters;
  advancedCount: number;
  guests: number | null;
  sort: string;
  amenityOptions: BrowseAmenityOption[];
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() =>
    draftFrom(advanced, guests, sort),
  );
  const [preview, setPreview] = useState<number | null>(null);

  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    [],
  );

  // The query string the draft would produce. Built from the CURRENT url so
  // params this sheet does not own (where, type) survive untouched.
  const queryString = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("page");
    const put = (key: string, value: string | null) => {
      if (value) next.set(key, value);
      else next.delete(key);
    };
    put("min_price", money(draft.minPrice));
    put("max_price", money(draft.maxPrice));
    put("bedrooms", draft.bedrooms != null ? String(draft.bedrooms) : null);
    put("bathrooms", draft.bathrooms != null ? String(draft.bathrooms) : null);
    put("guests", draft.guests != null ? String(draft.guests) : null);
    put("amenities", draft.amenities.length ? draft.amenities.join(",") : null);
    put("instant", draft.instant ? "1" : null);
    put("verified", draft.verified ? "1" : null);
    put("rating", draft.rating != null ? String(draft.rating) : null);
    put("sort", draft.sort !== DEFAULT_SORT ? draft.sort : null);
    return next.toString();
  }, [draft, searchParams]);

  // Live "Show N stays" — fetched from the same loader the page runs, so the
  // preview can never disagree with the applied results. Debounced, and the
  // in-flight request is aborted when the draft moves again.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/explore/count?${queryString}`, { signal: controller.signal })
        .then((r) => r.json() as Promise<{ count?: number }>)
        .then((d) => setPreview(typeof d.count === "number" ? d.count : null))
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, queryString]);

  function onOpenChange(next: boolean) {
    // Re-seed from the URL every time it opens so a back-navigation or a plain
    // ?amenities=pool link is what the user sees in the controls.
    if (next) {
      setDraft(draftFrom(advanced, guests, sort));
      setPreview(null);
    }
    setOpen(next);
  }

  function apply() {
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
    setOpen(false);
  }

  function toggleAmenity(slug: string) {
    setDraft((d) => ({
      ...d,
      amenities: d.amenities.includes(slug)
        ? d.amenities.filter((s) => s !== slug)
        : [...d.amenities, slug],
    }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger className="inline-flex shrink-0 items-center gap-2 rounded-pill border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent">
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {advancedCount > 0 ? (
          <span className="num inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-pill bg-brand-primary px-1.5 text-xs font-bold text-white">
            {advancedCount}
          </span>
        ) : null}
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[88vh] flex-col gap-0 rounded-t-card border-brand-line bg-white p-0 sm:bottom-6 sm:max-w-2xl sm:rounded-card"
      >
        <div className="border-b border-brand-line px-5 py-4">
          <SheetTitle className="font-display text-lg font-bold text-brand-ink">
            Filters
          </SheetTitle>
          <SheetDescription className="sr-only">
            Narrow the stays by price, rooms, amenities and more.
          </SheetDescription>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-brand-ink">
              Price per night
            </h3>
            <div className="flex items-center gap-3">
              {(
                [
                  ["minPrice", "Min"],
                  ["maxPrice", "Max"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex-1">
                  <span className="mb-1 block text-xs text-brand-mute">
                    {label}
                  </span>
                  <div className="flex items-center gap-1.5 rounded border border-brand-line px-3 py-2 focus-within:border-brand-primary">
                    <span className="text-sm text-brand-mute">R</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={draft[key]}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder={label === "Min" ? "0" : "Any"}
                      className="num w-full bg-transparent text-sm font-medium text-brand-ink outline-none"
                    />
                  </div>
                </label>
              ))}
            </div>
          </section>

          {(
            [
              ["bedrooms", "Bedrooms", ROOM_CHOICES],
              ["bathrooms", "Bathrooms", ROOM_CHOICES],
              ["guests", "Guests", GUEST_CHOICES],
            ] as const
          ).map(([key, label, choices]) => (
            <section key={key}>
              <h3 className="mb-2 text-sm font-semibold text-brand-ink">
                {label}
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => set(key, null)}
                  className={pill(draft[key] == null)}
                >
                  Any
                </button>
                {choices.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set(key, draft[key] === n ? null : n)}
                    className={pill(draft[key] === n)}
                  >
                    {n}+
                  </button>
                ))}
              </div>
            </section>
          ))}

          {amenityOptions.length > 0 ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-brand-ink">
                Amenities
              </h3>
              <div className="flex flex-wrap gap-2">
                {amenityOptions.map((a) => (
                  <button
                    key={a.slug}
                    type="button"
                    aria-pressed={draft.amenities.includes(a.slug)}
                    onClick={() => toggleAmenity(a.slug)}
                    className={pill(draft.amenities.includes(a.slug))}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-brand-ink">
              Minimum rating
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set("rating", null)}
                className={pill(draft.rating == null)}
              >
                Any
              </button>
              {RATING_CHOICES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("rating", draft.rating === n ? null : n)}
                  className={pill(draft.rating === n)}
                >
                  {n === 5 ? "5" : `${n}+`} ★
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            {(
              [
                ["instant", "Instant book", "Confirms without host approval"],
                ["verified", "Verified host", "ID-verified host"],
              ] as const
            ).map(([key, label, hint]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-3 rounded border border-brand-line px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-brand-ink">
                    {label}
                  </span>
                  <span className="block text-xs text-brand-mute">{hint}</span>
                </span>
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(e) => set(key, e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-brand-primary"
                />
              </label>
            ))}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-brand-ink">
              Sort by
            </h3>
            <select
              value={draft.sort}
              onChange={(e) => set("sort", e.target.value)}
              aria-label="Sort order"
              className="w-full rounded border border-brand-line bg-white px-3 py-2.5 text-sm font-medium text-brand-ink outline-none focus:border-brand-primary"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-brand-line bg-brand-light/40 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY);
              setPreview(null);
            }}
            className="rounded px-3 py-2 text-sm font-medium text-brand-ink underline-offset-4 transition-colors hover:bg-brand-accent hover:underline"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
          >
            {preview == null
              ? "Show stays"
              : `Show ${preview} ${preview === 1 ? "stay" : "stays"}`}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
