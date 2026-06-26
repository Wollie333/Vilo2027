import type { SitePreviewPage } from "@/lib/site/loadSitePage";
import type { SiteAssetResolver, SiteData } from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SafariSectionList, type SafariCtx } from "../sections/SafariSections";

import { SafariShell, type SafariNavLink } from "./SafariShell";
import { SafariAboutContent } from "./pages/SafariAboutContent";
import { SafariBookingContent } from "./pages/SafariBookingContent";
import { SafariContactContent } from "./pages/SafariContactContent";
import { SafariJournalContent } from "./pages/SafariJournalContent";
import { SafariGenericContent } from "./pages/SafariGenericContent";
import { SafariRatesContent } from "./pages/SafariRatesContent";
import { SafariRoomsContent } from "./pages/SafariRoomsContent";
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
  navLinks,
  bookHref,
  previewPages,
}: {
  kind: string;
  pageTitle?: string;
  sections: WebsiteSection[];
  /** Live auto-populate data (rooms/gallery/reviews) keyed by section id. */
  data?: SiteData;
  asset?: SiteAssetResolver;
  brandName: string;
  navLinks: SafariNavLink[];
  bookHref?: string | null;
  previewPages?: SitePreviewPage[];
}) {
  const roomsHref =
    navLinks.find((l) => /suite|room/i.test(l.label))?.href || "#suites";
  const safariCtx: SafariCtx = {
    brandName,
    roomsHref,
    aboutHref: navLinks.find((l) => /about|story/i.test(l.label))?.href,
    contactHref: navLinks.find((l) => /contact/i.test(l.label))?.href,
    reserveHref: bookHref || roomsHref,
  };

  let content;
  switch (kind) {
    case "rooms":
      content = <SafariRoomsContent />;
      break;
    case "about":
      content = <SafariAboutContent />;
      break;
    case "contact":
      content = <SafariContactContent />;
      break;
    case "blog":
      content = <SafariJournalContent />;
      break;
    case "rates":
      content = <SafariRatesContent />;
      break;
    case "checkout":
      content = <SafariBookingContent />;
      break;
    case "thank-you":
      content = <SafariThankYouContent />;
      break;
    case "home":
      content = (
        <SafariSectionList
          sections={sections}
          data={data}
          asset={asset}
          ctx={safariCtx}
        />
      );
      break;
    default: {
      // Any other kind — a rates page if its sections are rate-style, otherwise a
      // Safari-styled generic page. Never the old chrome.
      const isRates = sections.some((s) =>
        ["rate_table", "room_rates", "seasonal_pricing", "pricing"].includes(
          s.type,
        ),
      );
      content = isRates ? (
        <SafariRatesContent />
      ) : (
        <SafariGenericContent
          title={pageTitle || brandName}
          bookHref={bookHref}
        />
      );
    }
  }
  return (
    <SafariShell
      brandName={brandName}
      navLinks={navLinks}
      bookHref={bookHref}
      solidNav={kind === "checkout"}
      previewPages={previewPages}
    >
      {content}
    </SafariShell>
  );
}
