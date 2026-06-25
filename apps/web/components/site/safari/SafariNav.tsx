"use client";

import { useEffect, useState } from "react";

/** A nav link as rendered in the Safari header. */
export type SafariNavLink = { label: string; href: string };

/**
 * NenGama-style fixed header: transparent + light over the hero, fading to a
 * solid blurred bar on scroll (the design's `.nav.over-hero` → `.solid`). The
 * scroll listener is the only reason this is a client component.
 */
export function SafariNav({
  brandName,
  monogram,
  tagline,
  links,
  bookHref,
  bookLabel = "Reserve",
  forceSolid = false,
}: {
  brandName: string;
  monogram: string;
  tagline?: string | null;
  links: SafariNavLink[];
  bookHref?: string | null;
  bookLabel?: string;
  /** Pages without a dark hero (e.g. checkout) need a solid bar from the top. */
  forceSolid?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (forceSolid) return;
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [forceSolid]);

  const cls = forceSolid
    ? "nav solid"
    : scrolled
      ? "nav over-hero solid"
      : "nav over-hero";

  return (
    <header className={cls}>
      <div className="wrap nav-in">
        <a href={links[0]?.href || "#"} className="brand">
          <span className="brand-mark">{monogram}</span>
          <span className="brand-name">
            {brandName}
            {tagline ? <small>{tagline}</small> : null}
          </span>
        </a>
        <nav className="nav-links">
          {links.map((l) => (
            <a key={l.href + l.label} href={l.href} className="nav-link">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav-right">
          {bookHref ? (
            <a href={bookHref} className="btn btn-on-dark btn-sm">
              <span>{bookLabel}</span>
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
