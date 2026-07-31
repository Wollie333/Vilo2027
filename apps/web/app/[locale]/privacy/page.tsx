import type { Metadata } from "next";

import { getBrandName, getCompanyLegalName } from "@/lib/brand";
import { PRIVACY_EMAIL } from "@/lib/contact";
import { getLegalDocument } from "@/lib/legal";

import {
  LegalPage,
  type LegalSectionData,
} from "@/app/_components/legal/LegalPage";

export const dynamic = "force-dynamic";

// Swap the placeholder brand/company tokens for the configured values so the
// legal text reflects the real entity once it's set. Replace the full legal
// name first (it contains the brand word), then any remaining brand mentions.
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
    title: "Privacy Policy",
    description: `How ${brandName} collects, uses, and protects personal information for hosts and guests on the platform.`,
  };
}

const LAST_UPDATED = "2026-07-31";

// Consolidated Privacy Policy (see docs/legal/PRIVACY_POLICY.md for the full
// lawyer-facing draft). This now also absorbs the cookies notice, the
// Looking-For notice, and the data side of the review disclosure. Static copy is
// the launch fallback; the admin-published version (Admin → Platform settings →
// Legal) supersedes it and is version-stamped onto bookings.
const SECTIONS: ReadonlyArray<LegalSectionData> = [
  {
    heading: "1. Introduction",
    body: "Wielo Platform (Pty) Ltd (“Wielo”, “we”, “us”) operates a direct-booking platform connecting accommodation hosts and experience operators in South Africa with guests. This policy explains what personal information we collect, why, how we use and protect it, and the rights you have under the Protection of Personal Information Act, 2013 (POPIA). It covers our website and apps and absorbs our cookies notice and our notices for reviews and Looking-For requests.",
  },
  {
    heading: "2. Who this policy covers",
    body: "This policy covers hosts, guests, affiliates, and visitors. Where a host collects a guest’s personal information to fulfil a booking, the host is the Responsible Party for that information and Wielo acts as the host’s Operator (see Schedule A of the Terms of Service). This policy governs Wielo’s own processing.",
  },
  {
    heading: "3. Information we collect",
    body: "We collect information you give us directly (account details, listing content, banking and payout details, booking and enquiry details, messages, reviews, and support requests), information we collect automatically (device and connection data, IP address, log and usage data, and cookies), and information from third parties where you have authorised it (such as confirmations from payment providers). Please do not submit special personal information or children’s information.",
  },
  {
    heading: "4. How we use your information, and our lawful basis",
    body: "We use personal information to create and manage your account and provide the platform; to process bookings, subscriptions, and payments; to enable host–guest communication; to send transactional messages; to prevent and investigate fraud and abuse; to provide support and resolve disputes; to comply with legal, tax, and accounting obligations; and — with your consent — to send product updates and enable optional analytics. Our POPIA lawful bases include performance of a contract, compliance with a legal obligation, our legitimate interests balanced against your rights, and your consent where required.",
  },
  {
    heading: "5. Reviews",
    body: "When you leave a review we collect the review content and associate it with your account and the relevant booking to verify it is genuine. Published reviews show your display name and may be publicly visible. How we collect, verify, and display reviews is described at /legal/review-disclosure.",
  },
  {
    heading: "6. Looking-For requests",
    body: "When you post a Looking-For request, we process the details you share (such as destination, dates, party size, budget, and contact preference) so hosts can respond, and only what is necessary is shared with hosts who may fulfil the request. The specific notice is at /legal/looking-for-notice.",
  },
  {
    heading: "7. Cookies and similar technologies",
    body: "We use strictly necessary cookies to keep you signed in, maintain your session, remember your locale and currency, and protect against fraud — these cannot be switched off without breaking core functionality. Analytics, when enabled, is opt-in, first-party, and runs with IP-address anonymisation; no analytics cookies are set before you consent. Payment providers may set their own cookies on payment pages. Wielo does not use third-party advertising or behavioural-targeting cookies. You can manage non-essential cookies from the cookie banner or your settings.",
  },
  {
    heading: "8. Sharing and disclosure",
    body: "We share information between host and guest as needed to complete a booking; with our payment providers (Paystack, PayPal); with service providers who process on our behalf under contract (infrastructure and database hosting, email delivery); and with regulators or law enforcement where legally required. We may share information in a business transfer, subject to this policy. We do not sell personal information.",
  },
  {
    heading: "9. International transfers",
    body: "Your personal information is stored outside South Africa. Our database and file storage are hosted in Frankfurt, Germany, and some of our service providers process personal information in other countries. POPIA permits these cross-border transfers because the recipients are subject to laws or binding agreements that uphold principles of lawful processing substantially similar to POPIA, and our contracts with them require a comparable standard of protection.",
  },
  {
    heading: "10. Security",
    body: "We use reasonable, appropriate technical and organisational measures, including encryption in transit, encrypted storage of sensitive fields (such as banking details), strict role-based access controls, and regular security review. No system is perfectly secure; please protect your credentials and report concerns to us.",
  },
  {
    heading: "11. Retention",
    body: "We retain personal information for as long as your account is active and for a reasonable period afterwards to satisfy legal, tax, accounting, and dispute-resolution requirements, after which it is deleted or de-identified. Certain records are retained for the periods the law requires.",
  },
  {
    heading: "12. Your rights",
    body: "You have the right to access, correct, or delete your personal information; to object to processing; to withdraw consent; not to be subject to unsolicited electronic marketing; and to lodge a complaint with the Information Regulator of South Africa. You can request data export or deletion from your account settings. Some information may be retained where the law requires it even after a deletion request.",
  },
  {
    heading: "13. Children",
    body: "The platform is not intended for people under 18, and we do not knowingly collect information from children. If you believe a child has given us information, contact us and we will delete it.",
  },
  {
    heading: "14. Changes to this policy",
    body: "We may update this policy from time to time. Material changes will be communicated via email or an in-app notice. The “Last updated” date at the top of this page reflects the current version.",
  },
  {
    heading: "15. Complaints and contact",
    body: `For privacy questions or to exercise your rights under POPIA, contact ${PRIVACY_EMAIL}. You may also lodge a complaint with the Information Regulator of South Africa.`,
  },
];

export default async function PrivacyPage() {
  const [companyName, brand, doc] = await Promise.all([
    getCompanyLegalName(),
    getBrandName(),
    getLegalDocument("privacy"),
  ]);
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={doc.updatedAt ?? LAST_UPDATED}
      bodyHtml={doc.html}
      sections={applyIdentity(SECTIONS, companyName, brand)}
    />
  );
}
