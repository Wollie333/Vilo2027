"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Tab = { id: string; label: string; count?: number };

/**
 * Sticky sub-navigation for the host profile right column. Scroll-spy keeps the
 * active tab in sync with the section in view; clicking smooth-scrolls to it.
 */
export function ProfileTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const els = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [tabs]);

  return (
    <div className="sticky top-16 z-30 -mx-1 border-b border-brand-line bg-brand-light/95 px-1 backdrop-blur">
      <div className="flex items-center gap-7 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              document
                .getElementById(t.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className={cn(
              "relative shrink-0 py-3 text-sm font-medium transition-colors",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-primary after:transition-opacity",
              active === t.id
                ? "text-brand-ink after:opacity-100"
                : "text-brand-mute after:opacity-0 hover:text-brand-ink",
            )}
          >
            {t.label}
            {t.count != null ? (
              <span className="num text-brand-mute"> · {t.count}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
