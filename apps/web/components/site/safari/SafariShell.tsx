import type { ReactNode } from "react";

import type { SitePreviewPage } from "@/lib/site/loadSitePage";

import { SafariLightbox } from "./SafariLightbox";
import { SafariNav, type SafariNavLink } from "./SafariNav";
import { SafariPreviewBar } from "./SafariPreviewBar";
import { SafariPreviewLinks } from "./SafariPreviewLinks";

import "./safari.css";

// Shared Safari chrome: the scoped `.vilo-safari` root, theme fonts, the
// scroll-aware nav and the NenGama footer. Every Safari page renders its content
// inside this so the frame is identical across the site.

export function SafariShell({
  brandName,
  navLinks,
  bookHref,
  solidNav = false,
  previewPages,
  children,
}: {
  brandName: string;
  navLinks: SafariNavLink[];
  bookHref?: string | null;
  /** For pages with no dark hero behind the nav (checkout): solid bar + top pad. */
  solidNav?: boolean;
  /** When previewing a theme: the page navigator for the Vilo preview bar. */
  previewPages?: SitePreviewPage[];
  children: ReactNode;
}) {
  const monogram = (brandName.trim()[0] || "N").toUpperCase();
  const roomsHref =
    navLinks.find((l) => /suite|room/i.test(l.label))?.href || "#";
  const contactHref = navLinks.find((l) => /contact/i.test(l.label))?.href;
  const reserve = bookHref || roomsHref;
  const bar = previewPages && previewPages.length > 0;
  // Top padding for the solid-nav (checkout) pages, plus the preview bar height.
  const topPad = (solidNav ? 90 : 0) + (bar ? 44 : 0);

  return (
    <div className={bar ? "vilo-safari pre" : "vilo-safari"}>
      {bar ? (
        <SafariPreviewBar themeName="Safari" pages={previewPages} />
      ) : null}
      <SafariPreviewLinks />
      {/* Theme-scoped fonts (only the Safari design uses them) — intentionally
          not in the root layout. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@300;400;500;600&family=Marcellus&display=swap"
      />

      <SafariNav
        brandName={brandName}
        monogram={monogram}
        tagline="Lodge · Direct booking"
        links={navLinks}
        bookHref={reserve}
        forceSolid={solidNav}
      />

      {topPad ? <div style={{ paddingTop: topPad }}>{children}</div> : children}

      <SafariLightbox />

      <footer className="footer">
        <div className="wrap">
          <div className="footer-top">
            <div>
              <span className="brand-name">{brandName}</span>
              <p className="footer-blurb">
                A luxury lodge on a private reserve. A handful of suites, the
                wild at your door, and a slower way to be in the world.
              </p>
            </div>
            <div>
              <div className="foot-head">Explore</div>
              <div className="foot-col">
                {navLinks.slice(0, 5).map((l) => (
                  <a key={l.href + l.label} href={l.href}>
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div className="foot-head">Visit</div>
              <div className="foot-col">
                {contactHref ? <a href={contactHref}>Getting here</a> : null}
                {contactHref ? <a href={contactHref}>Transfers</a> : null}
                <a href={reserve}>Reserve a suite</a>
                {contactHref ? <a href={contactHref}>FAQ</a> : null}
              </div>
            </div>
            <div>
              <div className="foot-head">The reserve, in your inbox</div>
              <p className="footer-blurb" style={{ marginTop: 0 }}>
                Sightings, open dates and the occasional field note. Twice a
                season, never more.
              </p>
              <div className="foot-news">
                <input
                  type="email"
                  placeholder="you@email.com"
                  aria-label="Email"
                />
                <button className="btn btn-primary btn-sm" type="button">
                  <span>Join</span>
                </button>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {brandName} · South Africa</span>
            <span className="foot-vilo">
              <svg width="15" height="15" viewBox="0 0 100 100" fill="none">
                <rect width="100" height="100" rx="24" fill="#10B981" />
                <path d="M50 66L26 32H38L50 50L62 32H74L50 66Z" fill="#fff" />
              </svg>
              Powered by Vilo · 0% booking fees
            </span>
            <div className="foot-socials">
              <a href="#" aria-label="Instagram">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle
                    cx="17.5"
                    cy="6.5"
                    r="1"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </a>
              <a href="#" aria-label="Facebook">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export const SAFARI_NEWSLETTER_FOOT = true;
export type { SafariNavLink };
