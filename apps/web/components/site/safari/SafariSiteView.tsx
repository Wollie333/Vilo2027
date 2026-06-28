import type { SitePreviewPage } from "@/lib/site/loadSitePage";
import type { SafariNavData } from "@/lib/site/safariNav";
import type {
  SiteAnalyticsSettings,
  SiteAssetResolver,
  SiteData,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SafariSectionList, type SafariCtx } from "../sections/SafariSections";

import { SafariShell } from "./SafariShell";
import { SafariBookingContent } from "./pages/SafariBookingContent";
import { SafariJournalContent } from "./pages/SafariJournalContent";
import { SafariGenericContent } from "./pages/SafariGenericContent";
import { SafariThankYouContent } from "./pages/SafariThankYouContent";

/** Page kinds (loadSitePage `kind`) the Safari theme renders bespoke. */
export const SAFARI_PAGE_KINDS = new Set<string>([
  "home",
  "rooms",
  "about",
  "contact",
  "blog",
  "checkout",
  "thank-you",
]);

/** Picks the bespoke Safari content for the page kind and wraps it in the shared
 *  Safari chrome (nav + footer). Mounted by SitePageView for `safari` sites whose
 *  page kind is in SAFARI_PAGE_KINDS. */
export function SafariSiteView({
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
  /** Live auto-populate data (rooms/gallery/reviews) keyed by section id. */
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
  /** Live website id, threaded to the section list for the form bands. */
  websiteId?: string;
}) {
  const navLinks = nav.links;
  const roomsHref =
    navLinks.find((l) => /suite|room/i.test(l.label))?.href || "#suites";
  const safariCtx: SafariCtx = {
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

  // Every content page (home/about/rooms/contact/rates + any custom page) renders
  // from its sections through the SAME Safari bands, so live === builder and every
  // band is host-editable. Only the funnel pages stay bespoke: checkout/thank-you
  // (booking flow) and the blog (its own real-posts route + index).
  const sectionList = (
    <SafariSectionList
      sections={sections}
      data={data}
      asset={asset}
      ctx={safariCtx}
      websiteId={websiteId}
      // Always live on the public render (live + preview) so forms work when the
      // host previews. SafariSiteView is never the builder canvas; the shell keeps
      // its own `interactive` for analytics (gated off in preview).
      interactive
    />
  );

  let content;
  switch (kind) {
    case "blog":
      content = <SafariJournalContent />;
      break;
    case "checkout":
      content = <SafariBookingContent />;
      break;
    case "thank-you":
      // Builder preview only (the live thank-you is the booking route, which
      // passes the real booking). Show the confirmed design with sample data.
      content = (
        <SafariThankYouContent
          state="confirmed"
          firstName="traveller"
          reference="NG-204815"
          checkIn="10 Jul 2026"
          checkOut="13 Jul 2026"
          guests={2}
          nights={3}
          total="R45,180"
        />
      );
      break;
    default:
      // home/about/rooms/contact/rates and any custom page: section-driven. A page
      // with NO recognised sections falls back to the Safari generic shell so it's
      // never blank.
      content = sections.length ? (
        sectionList
      ) : (
        <SafariGenericContent
          title={pageTitle || brandName}
          bookHref={bookHref}
        />
      );
  }
  return (
    <SafariShell
      brandName={brandName}
      nav={nav}
      bookHref={bookHref}
      solidNav={kind === "checkout"}
      previewPages={previewPages}
      analytics={analytics}
      interactive={interactive}
    >
      {content}
    </SafariShell>
  );
}
