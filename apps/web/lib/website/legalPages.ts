import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { getLegalDocument } from "@/lib/legal";

import { flatSectionsToPageDoc } from "./blueprints";
import { parseSectionsLoose } from "./sections.schema";
import type { PageDoc } from "./pageDoc.schema";

// Auto-generated legal + footer pages (wizard arc, issue #3).
//
// Every new site ships the legal pages a hospitality website needs to be
// Google-Ads-eligible and POPIA-compliant WITHOUT the host writing a word:
//
//   • Privacy Policy (/privacy)  — POPIA. Sourced from the platform-wide legal
//     document (Vilo-authored, super-admin editable — see lib/legal.ts); falls
//     back to a built-in POPIA template when none is published yet.
//   • Terms & Conditions (/terms) — the platform-wide booking-terms document,
//     with a built-in fallback.
//   • House Rules (/house-rules) — ONLY when the host has an active house_rules
//     policy with body copy (a host-controlled type; see the legal-platform-wide
//     migration). Skipped entirely when the host hasn't written any.
//
// Booking terms + privacy are platform-wide (hosts must not draft legal text),
// so the two always-on pages read the same versioned document guests accept at
// checkout — the footer link and the checkout text can never drift apart.
//
// Each page is a Builder-V2 PageDoc built from `[intro, rich_text]` so it renders
// in the active theme's scoped CSS exactly like every other page, and the host
// can restyle or extend it in the builder. HTML is sanitised on store AND at
// render (defence-in-depth). The pages are `kind:'custom'`, `show_in_nav:false`
// (they belong in the footer, not the top nav), and a "Legal" footer column is
// appended linking to whichever pages were created.

/** A legal page ready to insert into `website_pages` (draft == published: the
 *  legal copy is live the moment the site is, no separate publish step). */
export type LegalPageRow = {
  kind: "custom";
  slug: string;
  title: string;
  nav_label: string;
  nav_order: number;
  show_in_nav: false;
  draft_sections: PageDoc;
  published_sections: PageDoc;
};

/** A footer link {id,label,href} for the appended "Legal" column. */
type FooterLink = { id: string; label: string; href: string };

/** Both halves of the legal seed: the page rows + the footer column to graft. */
export type LegalSeed = {
  pages: LegalPageRow[];
  footerColumn: { id: string; heading: string; links: FooterLink[] } | null;
};

const uuid = () => crypto.randomUUID();

/** Build one legal page's PageDoc: a short intro lead + the legal HTML body.
 *  Sections are round-tripped through `parseSectionsLoose` so props are validated
 *  against the schema before conversion (a malformed body is dropped, never stored). */
function legalPageDoc(title: string, lead: string, bodyHtml: string): PageDoc {
  const sections = parseSectionsLoose([
    {
      id: uuid(),
      type: "intro",
      enabled: true,
      props: { heading: title, body: lead, variant: "centered" },
    },
    {
      id: uuid(),
      type: "rich_text",
      enabled: true,
      props: { html: bodyHtml, variant: "narrow" },
    },
  ]);
  return flatSectionsToPageDoc(sections, { title });
}

/** Built-in POPIA-aware privacy policy, used until platform legal is published. */
function builtinPrivacyHtml(siteName: string, contactEmail?: string): string {
  const contact = contactEmail
    ? `<a href="mailto:${contactEmail}">${contactEmail}</a>`
    : "the contact details on our website";
  return `
<p>This Privacy Policy explains how ${siteName} ("we", "us") collects, uses and protects the personal information you share with us when you browse this website or make a booking. We are committed to handling your information lawfully and transparently in line with the Protection of Personal Information Act (POPIA).</p>
<h2>Information we collect</h2>
<p>We collect the information you give us when you make an enquiry or booking — such as your name, email address, phone number, stay dates and payment details — together with basic technical information (like your device and pages viewed) that helps us run and improve the site.</p>
<h2>How we use your information</h2>
<p>We use your information to confirm and manage your booking, to communicate with you about your stay, to process payments securely, to meet our legal and accounting obligations, and — where you have agreed — to send you occasional updates. We do not sell your personal information.</p>
<h2>Sharing</h2>
<p>We share information only where needed to deliver your booking: with the payment providers who process your payment and the service providers who host this website and send our emails. Each is required to protect your information and use it only for that purpose.</p>
<h2>Your rights</h2>
<p>Under POPIA you may ask to see the personal information we hold about you, ask us to correct or delete it, or object to certain uses. To exercise any of these rights, contact us at ${contact}.</p>
<h2>Retention &amp; security</h2>
<p>We keep your information only as long as we need it for the purposes above or to meet our legal obligations, and we take reasonable measures to keep it secure.</p>
<h2>Cookies</h2>
<p>This site uses cookies to make it work and, with your consent, to measure how it is used. You can manage cookies through your browser settings.</p>
<h2>Contact</h2>
<p>Questions about this policy or your information? Reach us at ${contact}.</p>
`.trim();
}

/** Built-in booking terms, used until platform legal is published. */
function builtinTermsHtml(siteName: string, contactEmail?: string): string {
  const contact = contactEmail
    ? `<a href="mailto:${contactEmail}">${contactEmail}</a>`
    : "the contact details on our website";
  return `
<p>These Terms &amp; Conditions apply to bookings made with ${siteName} through this website. By making a booking you agree to these terms.</p>
<h2>Bookings &amp; payment</h2>
<p>A booking is confirmed once we have accepted it and the required payment or deposit has been received. Prices are shown at the time of booking and include any fees stated at checkout.</p>
<h2>Cancellations &amp; changes</h2>
<p>The cancellation and refund terms that apply to your stay are shown during checkout and on your booking confirmation. Please review them before you pay, as they form part of your agreement with us.</p>
<h2>Your stay</h2>
<p>Check-in and check-out times, house rules and any property-specific conditions are provided with your booking. Please treat the property with care; you are responsible for any damage caused during your stay.</p>
<h2>Liability</h2>
<p>We take care to describe the property accurately and to provide the stay you booked. To the extent permitted by law, we are not liable for circumstances beyond our reasonable control.</p>
<h2>Contact</h2>
<p>For any questions about your booking or these terms, contact us at ${contact}.</p>
`.trim();
}

/**
 * Build the legal page rows + footer column for a freshly-created site. Reads the
 * platform-wide legal documents (privacy / booking terms) and, when the host has
 * one, their active house_rules policy body. Returns page rows to insert and the
 * "Legal" footer column to graft onto navigation. Never throws — a lookup failure
 * degrades to the built-in templates (privacy/terms) or a skipped page (house
 * rules), so it can't fail the site create.
 */
export async function buildLegalSeed(
  supabase: SupabaseClient,
  opts: { hostId: string; siteName: string; contactEmail?: string },
): Promise<LegalSeed> {
  const { hostId, siteName, contactEmail } = opts;

  // Platform-wide legal (Vilo-authored, super-admin editable). Already sanitised
  // on read; null → not published yet → use the built-in template.
  const [privacyDoc, termsDoc, houseRulesHtml] = await Promise.all([
    getLegalDocument("privacy").catch(() => ({ html: null })),
    getLegalDocument("booking_terms").catch(() => ({ html: null })),
    loadHostHouseRulesHtml(supabase, hostId),
  ]);

  const pages: LegalPageRow[] = [];
  const links: FooterLink[] = [];

  const add = (
    slug: string,
    title: string,
    navLabel: string,
    lead: string,
    bodyHtml: string,
    navOrder: number,
  ) => {
    const doc = legalPageDoc(title, lead, bodyHtml);
    pages.push({
      kind: "custom",
      slug,
      title,
      nav_label: navLabel,
      nav_order: navOrder,
      show_in_nav: false,
      draft_sections: doc,
      published_sections: doc,
    });
    links.push({ id: uuid(), label: navLabel, href: `/${slug}` });
  };

  add(
    "privacy",
    "Privacy Policy",
    "Privacy",
    "How we collect, use and protect your personal information.",
    privacyDoc.html ?? builtinPrivacyHtml(siteName, contactEmail),
    950,
  );
  add(
    "terms",
    "Terms & Conditions",
    "Terms",
    "The terms that apply when you book with us.",
    termsDoc.html ?? builtinTermsHtml(siteName, contactEmail),
    951,
  );
  if (houseRulesHtml) {
    add(
      "house-rules",
      "House Rules",
      "House Rules",
      "What to know for a comfortable, respectful stay.",
      houseRulesHtml,
      952,
    );
  }

  const footerColumn = links.length
    ? { id: uuid(), heading: "Legal", links }
    : null;

  return { pages, footerColumn };
}

/** The host's active house_rules policy body (sanitised), or null if none. */
async function loadHostHouseRulesHtml(
  supabase: SupabaseClient,
  hostId: string,
): Promise<string | null> {
  try {
    const { data: policy } = await supabase
      .from("policies")
      .select("id")
      .eq("host_id", hostId)
      .eq("type", "house_rules")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!policy?.id) return null;

    const { data: content } = await supabase
      .from("policy_content")
      .select("body_html")
      .eq("policy_id", policy.id)
      .eq("locale", "en")
      .maybeSingle<{ body_html: string | null }>();
    const html = content?.body_html?.trim();
    return html ? sanitiseListingHtml(html) : null;
  } catch {
    return null;
  }
}
