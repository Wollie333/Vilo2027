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

  const [menuOpen, setMenuOpen] = useState(false);

  const cls = forceSolid
    ? "nav solid"
    : scrolled
      ? "nav over-hero solid"
      : "nav over-hero";

  return (
    <>
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
            <button
              type="button"
              className="nav-burger"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className={menuOpen ? "mnav open" : "mnav"}>
        <div className="mnav-top">
          <a
            href={links[0]?.href || "#"}
            className="brand"
            onClick={() => setMenuOpen(false)}
          >
            <span className="brand-mark">{monogram}</span>
            <span className="brand-name">{brandName}</span>
          </a>
          <button
            type="button"
            className="nav-burger"
            aria-label="Close menu"
            style={{ display: "block" }}
            onClick={() => setMenuOpen(false)}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="mnav-links">
          {links.map((l) => (
            <a
              key={l.href + l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </a>
          ))}
        </nav>
        {bookHref ? (
          <a
            href={bookHref}
            className="btn btn-primary btn-lg btn-block"
            onClick={() => setMenuOpen(false)}
          >
            <span>{bookLabel}</span>
          </a>
        ) : null}
      </div>
    </>
  );
}
