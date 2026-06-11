"use client";

import {
  CalendarCheck,
  Home as HomeIcon,
  PackagePlus,
  RotateCcw,
  Search,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

import type { SearchHit } from "@/lib/search/entitySearch";

const ICON: Record<SearchHit["kind"], typeof HomeIcon> = {
  listing: HomeIcon,
  booking: CalendarCheck,
  review: Star,
  refund: RotateCcw,
  addon: PackagePlus,
};

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  listing: "Listings",
  booking: "Bookings",
  review: "Reviews",
  refund: "Refunds",
  addon: "Add-ons",
};

const ORDER: Array<SearchHit["kind"]> = [
  "booking",
  "listing",
  "refund",
  "review",
  "addon",
];

export function EntitySearch() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(
          `/api/dashboard/search?q=${encodeURIComponent(q.trim())}`,
        );
        if (!resp.ok) {
          setHits([]);
          return;
        }
        const json = (await resp.json()) as {
          success: boolean;
          data?: { hits: SearchHit[] };
        };
        setHits(json.data?.hits ?? []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  const grouped = React.useMemo(() => {
    const buckets: Partial<Record<SearchHit["kind"], SearchHit[]>> = {};
    for (const hit of hits) {
      (buckets[hit.kind] ??= []).push(hit);
    }
    return ORDER.flatMap((kind) =>
      buckets[kind]?.length ? [{ kind, items: buckets[kind]! }] : [],
    );
  }, [hits]);

  const close = () => {
    setOpen(false);
    setQ("");
    setHits([]);
  };

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <Popover open={open && q.trim().length >= 2} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative hidden w-full items-center md:flex">
          <Search className="pointer-events-none absolute left-4 h-4 w-4 text-brand-mute" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => q.trim().length >= 2 && setOpen(true)}
            placeholder="Search guests, bookings, listings…"
            className="h-11 w-full rounded-pill border border-transparent bg-[#F4F8F5] pl-11 pr-8 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
            aria-label="Entity search"
          />
          {q ? (
            <button
              type="button"
              onClick={close}
              aria-label="Clear search"
              className="absolute right-2 rounded p-0.5 text-brand-mute hover:bg-brand-light"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[--radix-popover-trigger-width] max-w-[min(28rem,calc(100vw-2rem))] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {loading ? (
          <div className="p-4 text-center text-xs text-brand-mute">
            Searching…
          </div>
        ) : grouped.length === 0 ? (
          <div className="p-4 text-center text-xs text-brand-mute">
            No matches.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {grouped.map(({ kind, items }) => {
              const Icon = ICON[kind];
              return (
                <div key={kind} className="px-1 pb-1">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                    {KIND_LABEL[kind]}
                  </div>
                  {items.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => go(hit.href)}
                      className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-brand-light"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-mute" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-brand-ink">
                          {hit.title}
                        </div>
                        {hit.subtitle ? (
                          <div className="truncate text-[11px] text-brand-mute">
                            {hit.subtitle}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
