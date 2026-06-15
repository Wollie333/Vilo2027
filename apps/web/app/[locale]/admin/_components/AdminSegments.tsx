"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { Link } from "@/i18n/navigation";

// Segment pill-tabs matching the host Guests list. Navigates via a search param,
// preserving other params (e.g. the search query).
export function AdminSegments({
  param,
  options,
  current,
}: {
  param: string;
  options: { key: string; label: string; count?: number }[];
  current: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  function href(key: string): string {
    const next = new URLSearchParams(params.toString());
    if (key === "all") next.delete(param);
    else next.set(param, key);
    next.delete("page");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div
      className="flex items-stretch gap-1 overflow-x-auto border-b border-brand-line px-4"
      style={{ scrollbarWidth: "none" }}
    >
      {options.map((o) => {
        const active = current === o.key;
        return (
          <Link
            key={o.key}
            href={href(o.key)}
            className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13px] font-semibold transition-colors ${
              active
                ? "text-brand-secondary"
                : "text-brand-mute hover:text-brand-ink"
            }`}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={`rounded-pill border px-1.5 py-px text-[10.5px] tabular-nums ${
                  active
                    ? "border-brand-accent bg-brand-accent text-brand-secondary"
                    : "border-brand-line bg-brand-light text-brand-mute"
                }`}
              >
                {o.count}
              </span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-primary" />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
