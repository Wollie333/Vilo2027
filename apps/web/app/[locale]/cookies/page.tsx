import type { Metadata } from "next";

import { getBrandName } from "@/lib/brand";

import {
  LegalPage,
  type LegalSectionData,
} from "@/app/_components/legal/LegalPage";

// Swap the placeholder brand token for the configured value at render time.
function applyBrand(
  sections: ReadonlyArray<LegalSectionData>,
  brand: string,
): LegalSectionData[] {
  return sections.map((s) => ({
    ...s,
    body:
      typeof s.body === "string" ? s.body.split("Wielo").join(brand) : s.body,
  }));
}

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: "Cookies Policy",
    description: `How ${brandName} uses cookies and similar technologies on the platform, and how you can manage them.`,
  };
}

const LAST_UPDATED = "2026-05-23";

const SECTIONS: ReadonlyArray<LegalSectionData> = [
  {
    heading: "1. What cookies are",
    body: "Cookies are small text files that a website places on your device when you visit. They are widely used to make websites work efficiently and to provide information to the site’s operators about how the site is being used.",
  },
  {
    heading: "2. Cookies we use",
    body: "We use a small set of strictly necessary cookies to keep you signed in, maintain your session, remember your locale and currency preferences, and protect the platform against fraud and abuse. These cookies cannot be switched off without breaking core functionality.",
  },
  {
    heading: "3. Analytics",
    body: "When analytics is enabled, we use first-party analytics to understand aggregate usage patterns — for example, which features hosts use most often. Analytics is opt-in and runs with IP-address anonymisation. No analytics cookies are set before you consent.",
  },
  {
    heading: "4. Third parties",
    body: "Payment providers (Paystack, PayPal) may set their own cookies on payment pages. Their use of cookies is governed by their own policies. Wielo does not use third-party advertising or behavioural-targeting cookies.",
  },
  {
    heading: "5. Your choices",
    body: "You can manage non-essential cookies from the cookie banner displayed on your first visit, or at any time from your account settings. You can also clear cookies from your browser at any time, although doing so will sign you out and reset your preferences.",
  },
  {
    heading: "6. Changes to this policy",
    body: "We may update this policy when our cookie usage changes. The “Last updated” date at the top of the page reflects the current version.",
  },
  {
    heading: "7. Contact",
    body: "For questions about how we use cookies, contact privacy@wieloplatform.com.",
  },
];

export default async function CookiesPage() {
  const brand = await getBrandName();
  return (
    <LegalPage
      title="Cookies Policy"
      lastUpdated={LAST_UPDATED}
      sections={applyBrand(SECTIONS, brand)}
    />
  );
}
