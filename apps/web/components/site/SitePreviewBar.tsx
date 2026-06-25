import type { SitePreviewPage } from "@/lib/site/loadSitePage";

import { SitePreviewLinks } from "./SitePreviewLinks";

import "./site-preview.css";

/**
 * Single source of truth for the theme-preview bar — a small Vilo bar pinned
 * above the site while a host is PREVIEWING a theme (like the WordPress admin
 * bar). It signals "you're previewing" AND is a full page navigator: every page
 * of the design, including ones not in the site menu (a sample room detail,
 * checkout, thank-you). Bundles the link interceptor so navigating keeps the
 * preview. Used by EVERY theme (Safari + the standard chrome). Render only when
 * previewing.
 */
export function SitePreviewBar({
  themeName,
  pages,
}: {
  themeName: string;
  pages: SitePreviewPage[];
}) {
  return (
    <>
      <SitePreviewLinks />
      <div className="site-prebar">
        <span className="pb-brand">
          <svg
            width="16"
            height="16"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <rect width="100" height="100" rx="24" fill="#10B981" />
            <path d="M50 66L26 32H38L50 50L62 32H74L50 66Z" fill="#fff" />
          </svg>
          Previewing <b>{themeName}</b>
        </span>
        <span className="pb-sep" aria-hidden="true" />
        <nav className="pb-links" aria-label="Theme pages">
          {pages.map((p, i) => (
            <a key={`${p.href}-${i}`} href={p.href} className="pb-link">
              {p.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
