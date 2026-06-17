import type { Metadata } from "next";
import { Globe } from "lucide-react";

import { getBrandName } from "@/lib/brand";

import { ComingSoon } from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Website",
};

// Placeholder for the Website CMS area. The nav row + route exist now so the
// channel-based IA reads correctly; the real create-site flow + builder land in
// the Website build (plan §8.6+). Replaced then.
export default async function WebsitePage() {
  const brandName = await getBrandName();
  return (
    <ComingSoon
      icon={Globe}
      title="Website"
      tagline={`A branded, hosted micro-site for your business — built from your ${brandName} property data.`}
      phase="the Website build"
      bullets={[
        "Your own site at yourname.vilo.site (and a custom domain)",
        "Drag-together pages — hero, rooms, gallery, reviews, blog — themed to your brand",
        "Rooms and pricing pull live from your properties, so the site never goes stale",
        "Every Book button funnels into your existing booking engine + ledger",
      ]}
    />
  );
}
