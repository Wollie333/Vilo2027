import type { Metadata } from "next";

import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

import { PartnerSignupScreen } from "../PartnerSignupScreen";

export const dynamic = "force-dynamic";

// Per-competition signup URL. Every campaign gets one of these for free —
// the slug is the only difference, and the screen reads the rest from the
// campaign row.
export async function generateMetadata({
  params,
}: {
  params: { campaign: string };
}): Promise<Metadata> {
  const brand = await getBrandName();
  const admin = createAdminClient();
  const { data } = await admin
    .from("affiliate_campaigns")
    .select("name, status")
    .ilike("slug", params.campaign)
    .maybeSingle();

  const name = data?.status === "active" ? data.name : null;
  return {
    title: name
      ? `Enter ${name} — ${brand} partners`
      : `Become a ${brand} partner`,
    description: name
      ? `Sign up as a ${brand} partner and enter ${name}. Refer hosts, earn recurring commission, and compete for prizes.`
      : `Refer South African hosts to ${brand} and earn recurring commission.`,
  };
}

export default function CampaignPartnerSignupPage({
  params,
}: {
  params: { campaign: string };
}) {
  return <PartnerSignupScreen campaignSlug={params.campaign} />;
}
