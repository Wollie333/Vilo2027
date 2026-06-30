import type { SitePreviewPage } from "@/lib/site/loadSitePage";
import type { SafariNavData } from "@/lib/site/safariNav";
import type {
  SiteAnalyticsSettings,
  SiteAssetResolver,
  SiteData,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SabelaSectionList, type SabelaCtx } from "./SabelaSections";
import { SabelaShell } from "./SabelaShell";

/** Page kinds (loadSitePage `kind`) the Sabela theme renders bespoke. Mirrors
 *  SAFARI_PAGE_KINDS — every standard kind renders through the Sabela layer. */
export const SABELA_PAGE_KINDS = new Set<string>([
  "home",
  "rooms",
  "about",
  "contact",
  "blog",
  "checkout",
  "thank-you",
]);

/**
 * Renders a Sabela page from its sections through the Sabela bands and wraps it
 * in the shared Sabela chrome (nav + footer). Every content page is
 * section-driven, so live === builder and every band is host-editable. Mounted
 * by SitePageView for `sabela` sites.
 */
export function SabelaSiteView({
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
  const sabelaCtx: SabelaCtx = {
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
    <SabelaSectionList
      sections={sections}
      data={data}
      asset={asset}
      ctx={sabelaCtx}
      websiteId={websiteId}
      // Always live on the public render so forms work in preview too; the shell
      // keeps its own `interactive` for analytics (gated off in preview).
      interactive
    />
  );

  return (
    <SabelaShell
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
            <h1>{pageTitle || brandName}</h1>
          </div>
        </section>
      )}
    </SabelaShell>
  );
}
