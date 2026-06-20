import "server-only";

import { sanitiseListingHtml } from "@/lib/sanitiseHtml";

import type { WebsiteSection, WebsiteSections } from "./sections.schema";

/**
 * Sanitise the free-form HTML carried by `rich_text` sections. Applied both on
 * write (saveDraftSectionsAction) and at the public-render chokepoint
 * (loadSitePage) so HTML that bypasses the save action — theme stock-content
 * seeding, restore points, future AI generation — can never deliver stored XSS.
 * Server-only: `sanitiseListingHtml` pulls in `sanitize-html` (Node).
 */
export function sanitiseSectionHtml(section: WebsiteSection): WebsiteSection {
  if (section.type === "rich_text") {
    return {
      ...section,
      props: {
        ...section.props,
        html: sanitiseListingHtml(section.props.html),
      },
    };
  }
  return section;
}

export function sanitiseSectionsHtml(
  sections: WebsiteSections,
): WebsiteSections {
  return sections.map(sanitiseSectionHtml);
}
