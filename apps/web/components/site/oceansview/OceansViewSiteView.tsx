import type { SitePreviewPage } from "@/lib/site/loadSitePage";
import type { SafariNavData } from "@/lib/site/safariNav";
import type {
  SiteAnalyticsSettings,
  SiteAssetResolver,
  SiteData,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import {
  OceansViewSectionList,
  type OceansViewCtx,
} from "./OceansViewSections";
import { OceansViewShell } from "./OceansViewShell";

/** Page kinds the Oceans View theme renders bespoke — every standard kind. */
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
 * Renders an Oceans View page from its sections through the Oceans View bands and
 * wraps it in the shared chrome (nav + footer). Every content page is
 * section-driven (live === builder). Mounted by SitePageView for `oceansview`.
 */
export function OceansViewSiteView({
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
  const ctx: OceansViewCtx = {
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
    <OceansViewSectionList
      sections={sections}
      data={data}
      asset={asset}
      ctx={ctx}
      websiteId={websiteId}
      interactive
    />
  );

  return (
    <OceansViewShell
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
    </OceansViewShell>
  );
}
