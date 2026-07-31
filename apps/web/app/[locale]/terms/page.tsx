import type { Metadata } from "next";

import { getBrandName, getCompanyLegalName } from "@/lib/brand";
import { LEGAL_EMAIL } from "@/lib/contact";
import { getPlacedDocument } from "@/lib/legalDocuments";

import {
  LegalPage,
  type LegalSectionData,
} from "@/app/_components/legal/LegalPage";

export const dynamic = "force-dynamic";

// Swap the placeholder brand/company tokens for the configured values. Replace
// the full legal name first (it contains the brand word), then brand mentions.
function applyIdentity(
  sections: ReadonlyArray<LegalSectionData>,
  companyName: string,
  brand: string,
): LegalSectionData[] {
  return sections.map((s) => ({
    ...s,
    body:
      typeof s.body === "string"
        ? s.body
            .split("Wielo Platform (Pty) Ltd")
            .join(companyName)
            .split("Wielo")
            .join(brand)
        : s.body,
  }));
}

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: "Terms of Service",
    description: `The terms that govern your use of the ${brandName} direct-booking platform as a host or guest.`,
  };
}

const LAST_UPDATED = "2026-07-31";

// Consolidated Terms of Service (see docs/legal/TERMS_OF_SERVICE.md for the full
// lawyer-facing draft, incl. Schedule A — Host Data-Processing terms). This
// static copy is the launch fallback; the admin-published version (Admin →
// Platform settings → Legal) supersedes it and is version-stamped onto bookings.
const SECTIONS: ReadonlyArray<LegalSectionData> = [
  {
    heading: "1. Introduction",
    body: "These Terms of Service (“Terms”) govern your access to and use of the Wielo platform, operated by Wielo Platform (Pty) Ltd. By creating an account, listing a property or experience, or making a booking, you agree to these Terms and to our Privacy Policy.",
  },
  {
    heading: "2. What Wielo is — and is not",
    body: "Wielo is a management and direct-booking platform. We give hosts the tools to list, price, manage calendars and policies, take payment, and communicate with guests directly. Wielo is not a travel agent or tour operator and is not party to the agreement between a host and a guest — that contract is concluded directly between them. Wielo does not own, control, or inspect any listing. Hosts pay a flat subscription fee; Wielo does not take a per-booking commission.",
  },
  {
    heading: "3. Your account",
    body: "You must be at least 18 years old to create an account. You are responsible for keeping your credentials secure and for all activity under your account, and for providing accurate information and keeping it up to date. Some features require a verified email address.",
  },
  {
    heading: "4. Host obligations",
    body: "Hosts are responsible for the accuracy of their listings (photos, descriptions, pricing, availability, policies); for complying with all applicable laws, licensing, insurance, and tax obligations; for the safety and condition of the property or experience; and for honouring confirmed bookings. Where a host processes a guest’s personal information, the host acts as the Responsible Party and Wielo acts as the host’s Operator under the Host Data-Processing terms (Schedule A of these Terms).",
  },
  {
    heading: "5. Guest obligations",
    body: "Guests agree to provide accurate booking information, to pay in full and on time, to comply with the listing’s house rules and cancellation policy, to treat the property with care and be responsible for any damage they cause, and to respect the host’s and neighbours’ rights to privacy and quiet enjoyment.",
  },
  {
    heading: "6. Bookings and payments",
    body: "Wielo facilitates direct bookings between guests and hosts. Payments are processed by Paystack, PayPal, or via manual EFT (bank transfer) under those providers’ own terms. All amounts are displayed in South African Rand unless stated otherwise, and prices are calculated and confirmed by Wielo server-side at the time of booking.",
  },
  {
    heading: "7. Cancellations and refunds",
    body: "Each listing displays a cancellation policy chosen by the host, and the version you accept forms part of your agreement with the host. Refunds, where due, are calculated against that policy and processed via the original payment method. Nothing in a host’s policy limits your rights under the Consumer Protection Act. Disputes that cannot be resolved between guest and host may be escalated to Wielo for good-faith review.",
  },
  {
    heading: "8. Subscriptions and billing",
    body: "Host subscriptions auto-renew at the displayed price until cancelled. You may cancel at any time from your subscription settings; cancellation takes effect at the end of the current billing period. If a renewal payment fails, the account enters a 5-day grace period before paid features are restricted. We give reasonable prior notice of any price change, which takes effect at your next renewal.",
  },
  {
    heading: "9. Founding Host offer",
    body: "Hosts who join under the Founding Host offer receive the benefits described at enrolment, which may include a lifetime price-lock on their subscription tier. The full, binding terms of that offer are published at /legal/founding-host-terms and apply in addition to these Terms.",
  },
  {
    heading: "10. Reviews and user content",
    body: "Reviews must be honest, first-hand, and lawful; you must not post or induce false, incentivised, or manipulated reviews. How Wielo collects, verifies, and displays reviews is described at /legal/review-disclosure. We may remove content that breaches these Terms or the law, but we do not routinely pre-screen user content.",
  },
  {
    heading: "11. Acceptable use",
    body: "You may not use the platform to publish unlawful, fraudulent, discriminatory, or misleading content; to circumvent Wielo’s fee structure or take bookings off-platform to avoid subscription obligations; to scrape or harvest data; to introduce malware or attempt to breach security; to impersonate any person; or to harass other users or our staff.",
  },
  {
    heading: "12. Intellectual property",
    body: "Wielo and its licensors retain all rights in the platform’s software, design, and brand assets. You retain rights in the content you upload but grant Wielo a worldwide, non-exclusive, royalty-free licence to host and display that content for the purpose of operating, promoting, and improving the platform.",
  },
  {
    heading: "13. Third-party services",
    body: "The platform integrates third-party services (including Paystack, PayPal, Resend, and infrastructure providers). Your use of those services is governed by their own terms and privacy policies. Wielo is not responsible for third-party services it does not control.",
  },
  {
    heading: "14. Suspension and termination",
    body: "We may suspend or terminate accounts that breach these Terms, that pose a safety, legal, or fraud risk, or where required by law. Where reasonable, we will notify you and give you an opportunity to respond first. Closing an account does not relieve you of obligations accrued before closure.",
  },
  {
    heading: "15. Disclaimers and liability",
    body: "The platform is provided “as is” and “as available”. Wielo is not party to, and gives no warranty about, any host–guest agreement, listing, or stay. To the maximum extent permitted by law, and subject to any liability that cannot lawfully be limited, Wielo’s total liability is limited to the fees you have paid to Wielo in the 12 months preceding the claim. This does not exclude any right or warranty that cannot lawfully be excluded, including under the Consumer Protection Act.",
  },
  {
    heading: "16. Changes to these Terms",
    body: "We may update these Terms from time to time. Material changes will be communicated by email or in-app notice at least 14 days before they take effect. Continued use after the effective date constitutes acceptance, and the version you accept at booking is recorded against that booking.",
  },
  {
    heading: "17. Governing law and disputes",
    body: "These Terms are governed by the laws of the Republic of South Africa. Disputes will be resolved in the courts of Cape Town, unless mandatory consumer-protection law provides otherwise.",
  },
  {
    heading: "18. Contact",
    body: `For questions about these Terms, contact ${LEGAL_EMAIL}.`,
  },
];

export default async function TermsPage() {
  const [companyName, brand, placed] = await Promise.all([
    getCompanyLegalName(),
    getBrandName(),
    getPlacedDocument("terms"),
  ]);
  // Single source of truth: when a doc is published into the "terms" placement
  // (Admin → Legal Docs), render it; otherwise fall back to the built-in draft.
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated={placed?.updatedAt ?? LAST_UPDATED}
      bodyHtml={placed?.bodyHtml ?? null}
      sections={applyIdentity(SECTIONS, companyName, brand)}
    />
  );
}
