"use client";

import { useEffect, useState } from "react";

/**
 * Sticky in-page anchor nav for the listing detail page (per Listing 3.0).
 * Highlights the section currently in view via IntersectionObserver.
 */
export function StickySubnav({
  links,
}: {
  links: { id: string; label: string }[];
}) {
  const [active, setActive] = useState(links[0]?.id ?? "");

  useEffect(() => {
    const sections = links
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => el != null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost section currently intersecting the viewport band.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Band just below the sticky header so the active link tracks what the
      // reader is actually looking at.
      { rootMargin: "-140px 0px -65% 0px", threshold: 0 },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [links]);

  return (
    <div className="sticky top-16 z-30 -mx-5 mt-8 border-b border-brand-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="hscroll flex items-center gap-6 overflow-x-auto">
        {links.map((l) => {
          const isActive = active === l.id;
          return (
            <a
              key={l.id}
              href={`#${l.id}`}
              className={`whitespace-nowrap border-b-2 py-3.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? "border-brand-ink text-brand-ink"
                  : "border-transparent text-brand-mute hover:text-brand-ink"
              }`}
            >
              {l.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
