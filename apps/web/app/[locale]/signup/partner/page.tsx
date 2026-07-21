import type { Metadata } from "next";

import { getBrandName } from "@/lib/brand";

import { PartnerSignupScreen } from "./PartnerSignupScreen";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandName();
  return {
    title: `Become a ${brand} partner`,
    description: `Refer South African hosts to ${brand} and earn recurring commission for as long as they stay.`,
  };
}

export default function PartnerSignupPage() {
  return <PartnerSignupScreen />;
}
