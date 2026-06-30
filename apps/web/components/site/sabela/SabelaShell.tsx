import type { CSSProperties, ReactNode } from "react";

import type { SitePreviewPage } from "@/lib/site/loadSitePage";
import type { SafariNavData } from "@/lib/site/safariNav";
import type { SiteAnalyticsSettings } from "@/lib/site/types";

import { ChromeEditWrap, type ChromeEditable } from "../SiteChrome";
import { SiteMarketing } from "../SiteMarketing";
import { SitePreviewBar } from "../SitePreviewBar";

import { SabelaNav, type SabelaNavLink } from "./SabelaNav";

import "./sabela.css";

// Shared Sabela chrome: the scoped `.wielo-sabela` root, theme fonts, the
// scroll-aware nav (transparent over the dark hero → solid on scroll) and the
// Sabela footer. Every Sabela page renders its content inside this so the frame
// is identical across the site. Mirrors SafariShell; consumes the same
// theme-agnostic nav model (buildSafariNav → SafariNavData).

/** Footer social icons, keyed by the brand's social platforms. */
const SOCIAL_ICONS: Record<string, ReactNode> = {
  instagram: (
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
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  facebook: (
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
  ),
  x: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.9 2H22l-7 8 8.2 12h-6.4l-5-7.3L6 22H3l7.6-8.7L2.5 2H9l4.6 6.7L18.9 2Zm-1.1 18h1.8L7.3 4H5.4l12.4 16Z" />
    </svg>
  ),
  youtube: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d="M22 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C18.3 5 12 5 12 5s-6.3 0-7.8.5A2.5 2.5 0 0 0 2.4 7.3C2 8.8 2 12 2 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C5.7 19 12 19 12 19s6.3 0 7.8-.5a2.5 2.5 0 0 0 1.8-1.8C22 15.2 22 12 22 12Z" />
      <path d="m10 15 5-3-5-3z" fill="currentColor" stroke="none" />
    </svg>
  ),
  linkedin: (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 13v4" />
    </svg>
  ),
  website: (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  ),
};

export function SabelaShell({
  brandName,
  nav,
  bookHref,
  solidNav = false,
  previewPages,
  analytics,
  interactive = false,
  editable,
  forceMenuOpen = false,
  previewDevice,
  children,
}: {
  brandName: string;
  /** Resolved header model (host menu + style + book settings) — shared model. */
  nav: SafariNavData;
  bookHref?: string | null;
  /** For pages with no dark hero behind the nav (checkout): solid bar from top. */
  solidNav?: boolean;
  previewPages?: SitePreviewPage[];
  analytics?: SiteAnalyticsSettings;
  interactive?: boolean;
  editable?: ChromeEditable;
  forceMenuOpen?: boolean;
  previewDevice?: "desktop" | "tablet" | "phone";
  children: ReactNode;
}) {
  const navLinks = nav.links;
  const monogram = (brandName.trim()[0] || "S").toUpperCase();
  const roomsHref =
    navLinks.find((l) => /suite|room/i.test(l.label))?.href || "#";
  const reserve = bookHref || roomsHref;
  const foot = nav.footer;
  const blurb =
    foot.blurb?.trim() ||
    "An intimate, design-led safari lodge on a private reserve. A handful of suites, the wild at your door, and a slower way to be in the world.";
  const copyright = foot.copyright?.trim() || `© ${brandName} · South Africa`;
  const bar = previewPages && previewPages.length > 0;
  const tb = nav.topBar;
  const showTopBar =
    tb.enabled &&
    Boolean(
      tb.message?.trim() ||
      tb.phone?.trim() ||
      tb.email?.trim() ||
      tb.whatsapp?.trim(),
    );
  const builder = !!editable;
  // Header behaviour: solid-from-top when transparency is off, on the checkout
  // (solidNav), or in the builder. Otherwise the nav is transparent over the
  // dark hero, which the CSS gates on the root's data-hero="full".
  const headerSolid = solidNav || builder || !nav.transparent;
  const transparentHero = !headerSolid;
  // Sabela's base nav is position:sticky (in-flow) and the page-head/hero-full
  // self-pad for the 78px bar, so content needs no extra top padding. The
  // announcement bar + preview bar are the only fixed offsets.
  const topPad = builder ? 0 : (bar ? 44 : 0) + (showTopBar ? 40 : 0);
  const rootCls = [
    "wielo-sabela",
    bar ? "pre" : "",
    showTopBar ? "has-topbar" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootCls}
      // Only the full-bleed dark hero gets the transparent-over-hero nav.
      data-hero={transparentHero ? "full" : undefined}
      style={
        {
          "--wielo-sticky-top": `${topPad + 20}px`,
        } as CSSProperties
      }
    >
      {bar ? (
        <SitePreviewBar themeName="Sabela Lodge" pages={previewPages} />
      ) : null}
      {showTopBar ? (
        <div className="topbar">
          <span>{tb.message?.trim() || ""}</span>
          {tb.phone?.trim() ? (
            <a href={`tel:${tb.phone.replace(/\s+/g, "")}`}>{tb.phone}</a>
          ) : null}
          {tb.whatsapp?.trim() ? (
            <a
              href={`https://wa.me/${tb.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          ) : null}
          {tb.email?.trim() ? (
            <a href={`mailto:${tb.email}`}>{tb.email}</a>
          ) : null}
        </div>
      ) : null}
      {/* Theme-scoped fonts (Cormorant Garamond display + Inter body). */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@400;500;600;700&display=swap"
      />

      <ChromeEditWrap editable={editable} target="header" label="Header">
        <SabelaNav
          brandName={brandName}
          monogram={monogram}
          tagline={nav.tagline?.trim() || "Safari Lodge"}
          showLogo={nav.showLogo}
          logoUrl={nav.logoUrl}
          logoLightUrl={nav.logoLightUrl}
          logoMaxHeight={nav.logoMaxHeight}
          links={navLinks}
          layout={nav.layout}
          bookHref={reserve}
          bookLabel={nav.bookLabel}
          showBook={nav.showBook}
          bookColor={nav.bookColor}
          menuStyle={nav.menuStyle}
          forceSolid={headerSolid}
          sticky={nav.sticky && !builder}
          bgColor={nav.bgColor}
          scrolledBgColor={nav.scrolledBgColor}
          scrolledBorderColor={nav.scrolledBorderColor}
          menuCollapse={nav.menuCollapse}
          logoStyle={nav.logoStyle}
          logoTablet={nav.logoTablet}
          logoMobile={nav.logoMobile}
          burger={nav.burger}
          forceMenuOpen={forceMenuOpen}
          previewDevice={previewDevice}
        />
      </ChromeEditWrap>

      {topPad ? <div style={{ paddingTop: topPad }}>{children}</div> : children}

      <ChromeEditWrap editable={editable} target="footer" label="Footer">
        <footer className="footer">
          <div className="wrap">
            <div className="footer-top">
              <div>
                <a href={navLinks[0]?.href || "#"} className="brand">
                  <span className="brand-mark">{monogram}</span>
                  <span className="brand-name">{brandName}</span>
                </a>
                <p className="brand-blurb">{blurb}</p>
              </div>
              {foot.columns.map((col, i) => (
                <div key={(col.heading ?? "") + i}>
                  {col.heading ? (
                    <div className="footer-head">{col.heading}</div>
                  ) : null}
                  <div className="footer-col">
                    {col.links.map((l) => (
                      <a key={l.href + l.label} href={l.href}>
                        {l.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
              {foot.newsletter.enabled ? (
                <div>
                  <div className="footer-head">
                    {foot.newsletter.heading?.trim() ||
                      "The reserve, in your inbox"}
                  </div>
                  <p className="brand-blurb" style={{ marginTop: 0 }}>
                    {foot.newsletter.body?.trim() ||
                      "Sightings, open dates and the occasional field note. Twice a season, never more."}
                  </p>
                  <form
                    className="foot-news"
                    style={{ marginTop: 14, display: "flex", gap: 8 }}
                  >
                    <input
                      type="email"
                      placeholder="you@email.com"
                      aria-label="Email"
                    />
                    <button className="btn btn-primary btn-sm" type="button">
                      <span>Join</span>
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
            <div className="footer-bottom">
              <span>{copyright}</span>
              {foot.showPoweredBy ? (
                <span className="foot-vilo">
                  <svg width="15" height="15" viewBox="0 0 100 100" fill="none">
                    <rect width="100" height="100" rx="24" fill="#10B981" />
                    <path
                      d="M50 66L26 32H38L50 50L62 32H74L50 66Z"
                      fill="#fff"
                    />
                  </svg>
                  Powered by Wielo · 0% booking fees
                </span>
              ) : null}
              {foot.socials.length > 0 ? (
                <div className="foot-socials">
                  {foot.socials.map((s) => (
                    <a
                      key={s.key}
                      href={s.href}
                      aria-label={s.label}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {SOCIAL_ICONS[s.key]}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </footer>
      </ChromeEditWrap>

      {interactive ? (
        <SiteMarketing analytics={analytics} interactive={interactive} />
      ) : null}
    </div>
  );
}

export type { SabelaNavLink };
