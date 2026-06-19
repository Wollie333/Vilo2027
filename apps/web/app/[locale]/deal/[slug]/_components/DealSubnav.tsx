"use client";

import { useEffect, useState } from "react";

export type DealNavItem = { id: string; label: string };

/**
 * Sticky in-page subnav for the public deal page. Anchor links jump to each
 * section (native, via scroll-margin-top on the targets); an IntersectionObserver
 * highlights the section currently in view. Sticks below the global SiteHeader
 * (h-16). Pure presentational — no data, safe on tenant hosts.
 */
export function DealSubnav({ items }: { items: DealNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el != null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Trip when a section crosses just under the sticky header + subnav.
      { rootMargin: "-128px 0px -55% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  return (
    <div className="sticky top-16 z-30 -mx-5 mt-6 border-b border-brand-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex items-center gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none]">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`whitespace-nowrap border-b-2 py-3.5 text-[13px] transition-colors ${
                isActive
                  ? "border-brand-ink font-semibold text-brand-ink"
                  : "border-transparent font-medium text-brand-mute hover:text-brand-ink"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
