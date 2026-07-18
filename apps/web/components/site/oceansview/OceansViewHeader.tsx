"use client";

import "./oceansChrome.css";

import { useEffect, useState } from "react";

import { siteImageUrl } from "@/lib/site/image";
import { buildNavHref, hrefToPageKey } from "@/lib/site/navHref";
import type { SiteBrand, SiteMenuItem } from "@/lib/site/types";

type Preview = { subdomain: string; themeSlug?: string };

const ChevronIcon = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const BurgerIcon = (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
const CloseIcon = (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/** Brand lock-up: the host's logo when set, else a monogram in the accent disc,
 *  plus the wordmark (with an optional short locality/tagline subtitle). */
function Brand({
  brand,
  subtitle,
  href,
}: {
  brand: SiteBrand;
  subtitle?: string | null;
  href: string;
}) {
  const initial =
    brand.monogram?.trim().slice(0, 2).toUpperCase() ||
    (brand.name || "·").trim().charAt(0).toUpperCase();
  return (
    <a href={href} className="brand" data-nav-page="home">
      <span className="brand-mark">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={siteImageUrl(brand.logoUrl, { width: 120, quality: 85 })}
            alt={brand.name}
          />
        ) : (
          initial
        )}
      </span>
      <span className="brand-name">
        {brand.name}
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </a>
  );
}

/**
 * Oceans View bespoke HEADER — the founder's reference nav ported class-by-class
 * (scoped `.ovchrome`). A fixed bar that floats transparent over the page's hero
 * and fades to a solid, blurred surface on scroll; primary menu with CSS
 * hover/focus dropdowns and an active state; a coral "Book a stay" CTA; and a
 * full-screen mobile drawer behind the burger. Wired to the site's live brand +
 * menu (same data the generic chrome uses). Client-only for the scroll + drawer.
 */
export function OceansViewHeader({
  brand,
  menu,
  bookHref,
  bookLabel,
  preview,
  currentPageKey,
  transparent,
  topOffset = 0,
  subtitle,
}: {
  brand: SiteBrand;
  menu: SiteMenuItem[];
  bookHref?: string;
  bookLabel?: string;
  preview?: Preview;
  currentPageKey?: string;
  /** Float transparent over an opening hero (→ solid on scroll). Else solid. */
  transparent: boolean;
  /** Push the fixed bar down by N px (the theme-preview bar height). */
  topOffset?: number;
  /** Short locality/tagline shown under the wordmark; omitted when absent. */
  subtitle?: string | null;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!transparent) return;
    const read = () => {
      const top = Math.max(
        window.scrollY || 0,
        document.documentElement.scrollTop || 0,
      );
      setScrolled(top > 24);
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [transparent]);

  const solid = !transparent || scrolled;
  const navClass = `nav${transparent ? " over" : ""}${solid ? " solid" : ""}`;
  const homeHref = buildNavHref("/", preview);
  const cta = bookLabel?.trim() || "Book a stay";

  // Flat list for the mobile drawer (top level + one level of children).
  const flat: { label: string; href: string }[] = [];
  for (const item of menu) {
    flat.push({ label: item.label, href: item.href });
    for (const child of item.children ?? [])
      flat.push({ label: child.label, href: child.href });
  }

  return (
    <div className="ovchrome">
      {/* When the header is solid (no opening hero to float over) it can't overlay
          content, so reserve its height to keep the page from starting underneath. */}
      {!transparent ? <div aria-hidden style={{ height: 84 }} /> : null}
      <header className={navClass} style={{ top: topOffset }}>
        <div className="wrap">
          <div className="nav-in">
            <Brand brand={brand} subtitle={subtitle} href={homeHref} />

            <nav className="nav-links">
              {menu.map((item) => {
                const active = hrefToPageKey(item.href) === currentPageKey;
                if (item.children && item.children.length > 0) {
                  return (
                    <div key={item.id} className="nav-has-sub">
                      <button
                        type="button"
                        className={active ? "nav-link active" : "nav-link"}
                      >
                        {item.label}
                        {ChevronIcon}
                      </button>
                      <div className="nav-sub">
                        {item.children.map((child) => (
                          <a
                            key={child.id}
                            href={buildNavHref(child.href, preview)}
                            target={child.newTab ? "_blank" : undefined}
                            rel={
                              child.newTab ? "noopener noreferrer" : undefined
                            }
                            data-nav-page={
                              child.href.startsWith("http")
                                ? undefined
                                : hrefToPageKey(child.href)
                            }
                          >
                            {child.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <a
                    key={item.id}
                    href={buildNavHref(item.href, preview)}
                    target={item.newTab ? "_blank" : undefined}
                    rel={item.newTab ? "noopener noreferrer" : undefined}
                    data-nav-page={
                      item.href.startsWith("http")
                        ? undefined
                        : hrefToPageKey(item.href)
                    }
                    className={active ? "nav-link active" : "nav-link"}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="nav-right">
              {bookHref ? (
                <a href={bookHref} className="btn btn-coral btn-sm">
                  {cta}
                </a>
              ) : null}
              <button
                type="button"
                className="nav-burger"
                aria-label="Open menu"
                onClick={() => setOpen(true)}
              >
                {BurgerIcon}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Full-screen mobile drawer */}
      <div className={`mnav${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="mnav-top">
          <Brand brand={brand} href={homeHref} />
          <button
            type="button"
            className="nav-burger"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            {CloseIcon}
          </button>
        </div>
        <nav className="mnav-links">
          {flat.map((l, i) => (
            <a
              key={`${l.href}-${i}`}
              href={buildNavHref(l.href, preview)}
              data-nav-page={
                l.href.startsWith("http") ? undefined : hrefToPageKey(l.href)
              }
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
        </nav>
        {bookHref ? (
          <a href={bookHref} className="btn btn-coral btn-lg btn-block">
            {cta}
          </a>
        ) : null}
      </div>
    </div>
  );
}
