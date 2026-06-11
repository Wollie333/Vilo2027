import type { Metadata } from "next";

import { getBrandName, getCompanyLegalName } from "@/lib/brand";
import { getLegalDocument } from "@/lib/legal";

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
            .split("Vilo Platform (Pty) Ltd")
            .join(companyName)
            .split("Vilo")
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

const LAST_UPDATED = "2026-05-23";

const SECTIONS: ReadonlyArray<LegalSectionData> = [
  {
    heading: "1. Introduction",
    body: "These Terms of Service (“Terms”) govern your access to and use of the Vilo platform, operated by Vilo Platform (Pty) Ltd. By creating an account, listing a property, or making a booking, you agree to these Terms.",
  },
  {
    heading: "2. Acceptance and changes",
    body: "We may update these Terms from time to time. Material changes will be communicated by email or in-app notice at least 14 days before they take effect. Continued use of the platform after the effective date constitutes acceptance.",
  },
  {
    heading: "3. Your account",
    body: "You must be at least 18 years old to create an account. You are responsible for keeping your credentials secure and for all activity that occurs under your account. Provide accurate information and keep it up to date.",
  },
  {
    heading: "4. Host obligations",
    body: "Hosts are responsible for the accuracy of their listings (photos, descriptions, pricing, availability, policies), for complying with local laws and tax obligations, for honouring confirmed bookings, and for the safety and condition of the property offered.",
  },
  {
    heading: "5. Guest obligations",
    body: "Guests agree to treat the host’s property with care, to comply with the listing’s house rules and cancellation policy, to pay in full and on time, and to respect the host’s and other guests’ rights to privacy and quiet enjoyment.",
  },
  {
    heading: "6. Bookings and payments",
    body: "Vilo facilitates direct bookings between guests and hosts. Payments are processed by Paystack, PayPal, or via manual EFT (bank transfer). All amounts displayed are in South African Rand unless otherwise stated. Hosts pay a flat monthly subscription fee — Vilo does not take a per-booking commission.",
  },
  {
    heading: "7. Cancellations and refunds",
    body: "Each listing displays a cancellation policy chosen by the host. Refunds, where due, are calculated against that policy and processed via the original payment method. Disputes that cannot be resolved between guest and host may be escalated to Vilo for review.",
  },
  {
    heading: "8. Subscriptions",
    body: "Host subscriptions auto-renew at the displayed price until cancelled. You may cancel at any time from your subscription settings; cancellation takes effect at the end of the current billing period. Failed payments enter a 5-day grace period before the account is restricted.",
  },
  {
    heading: "9. Intellectual property",
    body: "Vilo and its licensors retain all rights in the platform’s software, design, and brand assets. You retain rights in the listing content you upload, but grant Vilo a worldwide, non-exclusive, royalty-free licence to host and display that content for the purpose of operating the platform.",
  },
  {
    heading: "10. Prohibited conduct",
    body: "You may not use the platform to publish unlawful, fraudulent, discriminatory, or misleading content; to circumvent the platform fee structure; to scrape or harvest data; to introduce malware; or to harass other users.",
  },
  {
    heading: "11. Suspension and termination",
    body: "We may suspend or terminate accounts that breach these Terms, that pose a safety or fraud risk, or where required by law. Where reasonable, we will notify you and give you an opportunity to respond before doing so.",
  },
  {
    heading: "12. Disclaimers and liability",
    body: "The platform is provided “as is”. Vilo is not party to the agreement between host and guest and is not liable for the condition, legality, or safety of any listing. To the maximum extent permitted by law, Vilo’s liability is limited to fees you have paid to Vilo in the 12 months preceding the claim.",
  },
  {
    heading: "13. Governing law and disputes",
    body: "These Terms are governed by the laws of the Republic of South Africa. Disputes will be resolved in the courts of Cape Town, unless mandatory consumer-protection law provides otherwise.",
  },
  {
    heading: "14. Contact",
    body: "For questions about these Terms, contact legal@viloplatform.com.",
  },
];

export default async function TermsPage() {
  const [companyName, brand, doc] = await Promise.all([
    getCompanyLegalName(),
    getBrandName(),
    getLegalDocument("booking_terms"),
  ]);
  // When Vilo has published custom terms (Admin → Platform settings → Legal),
  // render that; otherwise fall back to the built-in structural draft.
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      bodyHtml={doc.html}
      sections={applyIdentity(SECTIONS, companyName, brand)}
    />
  );
}
