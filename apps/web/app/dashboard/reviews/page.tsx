import type { Metadata } from "next";
import { Star } from "lucide-react";

import { ComingSoon } from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Reviews · Vilo",
};

export default function ReviewsPage() {
  return (
    <ComingSoon
      icon={Star}
      title="Reviews"
      tagline="Verified-stay reviews from your guests — read, reply, and showcase."
      phase="Phase 3"
      bullets={[
        "Automatic review request email 24h after checkout",
        "48-hour auto-publish window",
        "Reply inline to any review",
        "Flag a review for moderation",
      ]}
    />
  );
}
