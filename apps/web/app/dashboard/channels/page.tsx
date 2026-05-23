import type { Metadata } from "next";
import { Cable } from "lucide-react";

import { ComingSoon } from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Channels · Vilo",
};

export default function ChannelsPage() {
  return (
    <ComingSoon
      icon={Cable}
      title="Channels"
      tagline="Cross-post your listings to other booking platforms from one place."
      phase="Post-launch"
      bullets={[
        "Push listings to Airbnb + Booking.com via partner APIs",
        "Sync pricing + availability one-way from Vilo as the source of truth",
        "Pull external bookings into your unified inbox",
        "Pro+ feature — Free + Basic tiers see iCal sync only",
      ]}
    />
  );
}
