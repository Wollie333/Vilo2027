"use client";

import { Lock } from "lucide-react";
import { useLocale } from "next-intl";

/**
 * Live theme preview — embeds the REAL render (the standalone /theme-preview
 * route: the theme's demo home composition through the actual section renderer +
 * `.wielo-<slug>` skin) so the host sees the true design, not a mock. The iframe
 * is responsive: at a narrow width it renders the theme's tablet/mobile layout,
 * so `device="mobile"` gives the host a live read on the phone layout.
 */
export function WizardLivePreview({
  slug,
  accent,
  siteName,
  label,
  device = "desktop",
}: {
  slug: string;
  /** Effective accent (from the colours step); omit to use the theme's own. */
  accent?: string;
  siteName?: string;
  /** Fake address-bar text; defaults to the site name slug. */
  label?: string;
  /** "mobile" constrains the frame to a phone width so it renders that layout. */
  device?: "desktop" | "mobile";
}) {
  const locale = useLocale();
  const qs = new URLSearchParams();
  if (accent) qs.set("accent", accent);
  if (siteName) qs.set("name", siteName);
  // Overlay the host's real rooms/photos/reviews onto the theme (falls back to
  // sample for anything not set up yet) — so "your site" shows your listing.
  qs.set("real", "1");
  const src = `/${locale}/theme-preview/${slug}?${qs.toString()}`;
  const addressText =
    label ??
    (siteName ? `${siteName.toLowerCase().replace(/\s+/g, "")}` : slug);
  const mobile = device === "mobile";

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-peek">
      {/* faux browser chrome */}
      <div className="flex items-center gap-2 border-b border-brand-line bg-brand-light/70 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </span>
        <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-pill border border-brand-line bg-white px-3 py-1 text-[11px] text-brand-mute">
          <Lock className="h-3 w-3 shrink-0 text-brand-primary" />
          <span className="truncate font-mono">{addressText}.wielo.site</span>
          <span className="ml-auto rounded-pill bg-brand-light px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-mute">
            Preview
          </span>
        </div>
      </div>
      <div className="bg-brand-light/40 p-4">
        <div
          className={`mx-auto overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition-all duration-300 ${
            mobile ? "max-w-[400px]" : "max-w-full"
          }`}
        >
          <iframe
            // Reload when theme, accent or device changes so the render reflects it.
            key={`${src}-${device}`}
            src={src}
            title="Live theme preview"
            loading="lazy"
            className={`w-full border-0 bg-white ${mobile ? "h-[620px]" : "h-[540px]"}`}
          />
        </div>
      </div>
    </div>
  );
}
