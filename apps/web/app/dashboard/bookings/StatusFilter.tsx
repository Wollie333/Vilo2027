"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const FILTERS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "checked_in", label: "Checked in" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export function StatusFilter({ counts }: { counts: Record<string, number> }) {
  const sp = useSearchParams();
  const active = sp.get("status") ?? "";
  return (
    <nav
      aria-label="Filter bookings by status"
      className="hscroll -mx-1 flex items-center gap-1 overflow-x-auto px-1"
    >
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        const count = counts[f.key] ?? 0;
        const href = f.key
          ? `/dashboard/bookings?status=${f.key}`
          : "/dashboard/bookings";
        return (
          <Link
            key={f.key}
            href={href}
            className={`inline-flex shrink-0 items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "chip-active"
                : "text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
            }`}
          >
            {f.label}
            {count > 0 ? (
              <span
                className={`num rounded-pill px-1.5 py-0.5 text-[9px] font-bold ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-brand-accent text-brand-primary"
                }`}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
