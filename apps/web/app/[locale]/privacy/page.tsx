import type { Metadata } from "next";

import { getBrandName, getCompanyLegalName } from "@/lib/brand";
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

const LAST_UPDATED = "2026-05-23";

const SECTIONS: ReadonlyArray<LegalSectionData> = [
  {
    heading: "1. Introduction",
    body: "Wielo Platform (Pty) Ltd (“Wielo”, “we”, “us”) operates a direct-booking platform connecting accommodation hosts in South Africa with guests. This policy explains what personal information we collect, why we collect it, how we use it, and the rights you have under the Protection of Personal Information Act, 2013 (POPIA).",
  },
  {
    heading: "2. Information we collect",
    body: "We collect information you give us directly (account details, listing content, booking and payment information, messages exchanged through the platform), information we collect automatically (device, IP address, log data, cookies) and information from third parties where you have authorised it (payment providers, identity verification services).",
  },
  {
    heading: "3. How we use your information",
    body: "We use personal information to operate and improve the platform, process bookings and payments, communicate with you about your account and stays, prevent fraud, comply with legal obligations, and — where you have opted in — send you product updates.",
  },
  {
    heading: "4. Sharing and disclosure",
    body: "We share information with hosts and guests as required to complete a booking, with our payment providers (Paystack, PayPal), with hosting and infrastructure providers, and with regulators and law enforcement where legally required. We do not sell personal information.",
  },
  {
    heading: "5. International transfers",
    body: "Our primary database is hosted in the European Union (Frankfurt) and will be migrated to South Africa (Cape Town) before public launch. Cross-border transfers are conducted under appropriate safeguards as required by POPIA.",
  },
  {
    heading: "6. Security",
    body: "We use industry-standard technical and organisational measures, including encryption in transit, encrypted storage of sensitive fields (such as banking details), strict role-based access controls, and regular security review.",
  },
  {
    heading: "7. Your rights",
    body: "You have the right to access, correct, or delete your personal information, to object to processing, to withdraw consent, and to lodge a complaint with the Information Regulator of South Africa. You can request data deletion from your account settings.",
  },
  {
    heading: "8. Retention",
    body: "We retain personal information for as long as your account is active and for a reasonable period afterwards to satisfy legal, accounting, and dispute-resolution requirements.",
  },
  {
    heading: "9. Changes to this policy",
    body: "We may update this policy from time to time. Material changes will be communicated via email or an in-app notice. The “Last updated” date at the top of this page reflects the current version.",
  },
  {
    heading: "10. Contact",
    body: "For privacy questions or to exercise your rights under POPIA, contact privacy@wieloplatform.com.",
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
      lastUpdated={LAST_UPDATED}
      bodyHtml={doc.html}
      sections={applyIdentity(SECTIONS, companyName, brand)}
    />
  );
}
