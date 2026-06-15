import type { Metadata } from "next";

import { getBrandName } from "@/lib/brand";
import { getSubscriptionProducts } from "@/lib/products/getProducts";

import { PitchDeck } from "./_components/PitchDeck";

// Full-screen, slide-style pitch deck for presenting the platform to hosts at a
// stage/webinar. Pricing comes live from the products table and the brand name
// from platform_settings, so the deck never goes stale. The deck shell itself
// (navigation, keyboard) is a Client Component; this page only fetches data.

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: `${brandName} for hosts`,
    description: `Why South African hosts choose ${brandName}: keep 100% of every booking, own the guest relationship, run everything from one dashboard.`,
    robots: { index: false, follow: false },
  };
}

export default async function PitchPage() {
  const plans = await getSubscriptionProducts();
  return <PitchDeck plans={plans} />;
}
