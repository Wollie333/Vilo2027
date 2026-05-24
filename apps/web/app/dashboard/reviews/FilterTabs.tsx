"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Tab = { key: string; label: string; count?: number };

export function FilterTabs({
  current,
  counts,
}: {
  current: string;
  counts: { all: number; needsReply: number; replied: number; flagged: number };
}) {
  const sp = useSearchParams();

  function hrefFor(tabKey: string): string {
    const next = new URLSearchParams(sp.toString());
    if (tabKey === "all") next.delete("tab");
    else next.set("tab", tabKey);
    const qs = next.toString();
    return qs ? `/dashboard/reviews?${qs}` : "/dashboard/reviews";
  }

  const tabs: Tab[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "needs-reply", label: "Needs reply", count: counts.needsReply },
    { key: "replied", label: "Replied", count: counts.replied },
    { key: "flagged", label: "Flagged", count: counts.flagged },
  ];

  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-pill border border-brand-line bg-white p-1">
      {tabs.map((t) => {
        const isActive =
          current === t.key || (current === "" && t.key === "all");
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-brand-secondary text-white"
                : "text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 ? (
              <span
                className={`num text-[10px] font-semibold ${
                  isActive ? "text-white/85" : "text-brand-mute"
                }`}
              >
                {t.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
