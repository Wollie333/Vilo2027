import type { SitePreviewPage } from "@/lib/site/loadSitePage";
import type { SafariNavData } from "@/lib/site/safariNav";
import type {
  SiteAnalyticsSettings,
  SiteAssetResolver,
  SiteData,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { MarmaladeSectionList, type MarmaladeCtx } from "./MarmaladeSections";
import { MarmaladeShell } from "./MarmaladeShell";

/** Page kinds the Marmalade House theme renders bespoke — every standard kind. */
export const OCEANSVIEW_PAGE_KINDS = new Set<string>([
  "home",
  "rooms",
  "about",
  "contact",
  "blog",
  "checkout",
  "thank-you",
]);

/**
 * Renders an Marmalade House page from its sections through the Marmalade House bands and
 * wraps it in the shared chrome (nav + footer). Every content page is
 * section-driven (live === builder). Mounted by SitePageView for `marmalade`.
 */
export function MarmaladeSiteView({
  kind,
  pageTitle,
  sections,
  data,
  asset,
  brandName,
  contactEmail,
  contactPhone,
  nav,
  bookHref,
  previewPages,
  analytics,
  interactive,
  websiteId,
}: {
  kind: string;
  pageTitle?: string;
  sections: WebsiteSection[];
  data?: SiteData;
  asset?: SiteAssetResolver;
  brandName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  nav: SafariNavData;
  bookHref?: string | null;
  previewPages?: SitePreviewPage[];
  analytics?: SiteAnalyticsSettings;
  interactive?: boolean;
  websiteId?: string;
}) {
  const navLinks = nav.links;
  const roomsHref =
    navLinks.find((l) => /suite|room/i.test(l.label))?.href || "#rooms";
  const ctx: MarmaladeCtx = {
    brandName,
    contactEmail,
    contactPhone,
    homeHref:
      navLinks.find((l) => /^home$/i.test(l.label))?.href || navLinks[0]?.href,
    roomsHref,
    aboutHref: navLinks.find((l) => /about|story/i.test(l.label))?.href,
    contactHref: navLinks.find((l) => /contact/i.test(l.label))?.href,
    reserveHref: bookHref || roomsHref,
  };

  const content = (
    <MarmaladeSectionList
      sections={sections}
      data={data}
      asset={asset}
      ctx={ctx}
      websiteId={websiteId}
      interactive
    />
  );

  return (
    <MarmaladeShell
      brandName={brandName}
      nav={nav}
      bookHref={bookHref}
      solidNav={kind === "checkout"}
      previewPages={previewPages}
      analytics={analytics}
      interactive={interactive}
    >
      {sections.length ? (
        content
      ) : (
        <section className="section">
          <div className="wrap" style={{ textAlign: "center" }}>
            <h1 className="lg">{pageTitle || brandName}</h1>
          </div>
        </section>
      )}
    </MarmaladeShell>
  );
}
