import type { Metadata } from "next";
import { Cable } from "lucide-react";

import { getBrandName } from "@/lib/brand";

import { ComingSoon } from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Channels",
};

export default async function ChannelsPage() {
  const brandName = await getBrandName();
  return (
    <ComingSoon
      icon={Cable}
      title="Channels"
      tagline="Cross-post your listings to other booking platforms from one place."
      phase="Post-launch"
      bullets={[
        "Push listings to Airbnb + Booking.com via partner APIs",
        `Sync pricing + availability one-way from ${brandName} as the source of truth`,
        "Pull external bookings into your unified inbox",
        "Pro+ feature — Free + Basic tiers see iCal sync only",
      ]}
    />
  );
}
