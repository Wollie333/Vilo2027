"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type Tab = { key: string; label: string; count?: number };

export function FilterTabs({
  current,
  counts,
}: {
  current: string;
  counts: { all: number; needsReply: number; replied: number; flagged: number };
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingTab, setLoadingTab] = useState<string | null>(null);

  function hrefFor(tabKey: string): string {
    const next = new URLSearchParams(sp.toString());
    if (tabKey === "all") next.delete("tab");
    else next.set("tab", tabKey);
    const qs = next.toString();
    return qs ? `/dashboard/reviews?${qs}` : "/dashboard/reviews";
  }

  function handleClick(e: React.MouseEvent, tabKey: string) {
    e.preventDefault();
    const isCurrentTab =
      current === tabKey || (current === "" && tabKey === "all");
    if (isCurrentTab) return;
    setLoadingTab(tabKey);
    startTransition(() => {
      router.push(hrefFor(tabKey));
    });
  }

  // Clear loading state when current tab changes
  const effectiveCurrentKey = current || "all";
  if (loadingTab === effectiveCurrentKey) {
    setLoadingTab(null);
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
        const isLoading = isPending && loadingTab === t.key;
        return (
          <a
            key={t.key}
            href={hrefFor(t.key)}
            onClick={(e) => handleClick(e, t.key)}
            className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-brand-secondary text-white"
                : "text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            } ${isLoading ? "pointer-events-none" : ""}`}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
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
          </a>
        );
      })}
    </div>
  );
}
