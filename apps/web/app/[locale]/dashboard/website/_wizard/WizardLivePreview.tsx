"use client";

import { useLocale } from "next-intl";

/**
 * Live theme preview — embeds the REAL render (the standalone /theme-preview
 * route: the theme's demo home composition through the actual section renderer +
 * `.wielo-<slug>` skin) so the host sees the true design, not a mock. The iframe
 * is responsive: at the wizard's width it renders the theme's tablet/mobile
 * layout, so the host also gets a live read on how the site looks on a phone.
 */
export function WizardLivePreview({
  slug,
  accent,
  siteName,
  label,
}: {
  slug: string;
  /** Effective accent (from the colours step); omit to use the theme's own. */
  accent?: string;
  siteName?: string;
  /** Fake address-bar text; defaults to the site name slug. */
  label?: string;
}) {
  const locale = useLocale();
  const qs = new URLSearchParams();
  if (accent) qs.set("accent", accent);
  if (siteName) qs.set("name", siteName);
  const src = `/${locale}/theme-preview/${slug}?${qs.toString()}`;
  const addressText =
    label ??
    (siteName ? `${siteName.toLowerCase().replace(/\s+/g, "")}` : slug);

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {/* faux browser chrome */}
      <div className="flex items-center gap-2 border-b border-brand-line bg-brand-light px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        </span>
        <span className="ml-1 truncate rounded-md bg-white px-2.5 py-1 font-mono text-[11px] text-brand-mute">
          {addressText}.wielo.site
        </span>
        <span className="ml-auto rounded-pill bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
          Live preview
        </span>
      </div>
      <iframe
        // Reload when theme or accent changes so the render reflects the choice.
        key={src}
        src={src}
        title="Live theme preview"
        loading="lazy"
        className="h-[540px] w-full border-0 bg-white"
      />
    </div>
  );
}
