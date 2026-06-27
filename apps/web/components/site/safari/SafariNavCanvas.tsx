"use client";

import {
  SafariHero,
  SafariSectionList,
  type SafariCtx,
} from "@/components/site/sections/SafariSections";
import type { SafariNavData } from "@/lib/site/safariNav";
import type { SiteAssetResolver, SiteData } from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";
import { newSection } from "@/lib/website/sectionDefaults";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SafariShell } from "./SafariShell";

// The nav-editor canvas backdrop: the host's REAL home page rendered behind the
// LIVE chrome. The chrome (`nav`) is rebuilt from the editor's in-progress
// navigation every keystroke, so header/menu/footer edits show instantly; the
// body is the genuine home page (its real sections + data), so the host sees
// exactly how their menu sits on the real design — WYSIWYG, not a stock hero.
//
// This is the SAME render path the public Safari site uses (SafariShell +
// SafariSectionList), only non-interactive and fed the editor's live nav, so the
// canvas can't drift from production. When the home page has no sections yet, it
// falls back to a stock hero so the canvas is never blank.

// website-assets path → public URL. The resolver is a pure function (safe on the
// client), so we define it here rather than threading one from the server.
const canvasAsset: SiteAssetResolver = (path) =>
  websiteAssetUrl(path) ?? undefined;

export function SafariNavCanvas({
  brandName,
  nav,
  bookHref,
  sections,
  data,
  contactEmail,
  contactPhone,
  forceMobileOpen = false,
  previewDevice,
}: {
  brandName: string;
  /** Live nav built from the editor's in-progress navigation (updates instantly). */
  nav: SafariNavData;
  bookHref?: string | null;
  /** The real home page's sections + auto-populate data (loaded server-side). */
  sections: WebsiteSection[];
  data?: SiteData;
  contactEmail?: string | null;
  contactPhone?: string | null;
  /** Builder phone preview: open the mobile ☰ drawer so it can be styled. */
  forceMobileOpen?: boolean;
  /** Builder: active device, so per-link styles preview for that screen size. */
  previewDevice?: "desktop" | "tablet" | "phone";
}) {
  const navLinks = nav.links;
  const roomsHref =
    navLinks.find((l) => /suite|room/i.test(l.label))?.href || "#suites";
  // Mirror SafariSiteView's ctx derivation so the bands link the same way live.
  const ctx: SafariCtx = {
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

  let body;
  if (sections.length > 0) {
    body = (
      <SafariSectionList
        sections={sections}
        data={data}
        asset={canvasAsset}
        ctx={ctx}
        interactive={false}
      />
    );
  } else {
    const hero = newSection("hero");
    body = hero.type === "hero" ? <SafariHero props={hero.props} /> : null;
  }

  return (
    <SafariShell
      brandName={brandName}
      nav={nav}
      bookHref={bookHref}
      forceMenuOpen={forceMobileOpen}
      previewDevice={previewDevice}
    >
      {body}
    </SafariShell>
  );
}
