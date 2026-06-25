import type { SitePreviewPage } from "@/lib/site/loadSitePage";

/**
 * A small Vilo bar pinned above the header while a host is PREVIEWING a theme
 * (like the WordPress admin bar). It both signals "you're previewing" and acts
 * as a full page navigator — every page of the design, including ones not in the
 * site menu (a sample room detail, checkout, thank-you) — so the host can see
 * each page's design. Links are tenant-relative; `SafariPreviewLinks` rewrites
 * them to stay in the preview. Only rendered in preview.
 */
export function SafariPreviewBar({
  themeName,
  pages,
}: {
  themeName: string;
  pages: SitePreviewPage[];
}) {
  return (
    <div className="safari-prebar">
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
  );
}
