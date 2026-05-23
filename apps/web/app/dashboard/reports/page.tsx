import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { ComingSoon } from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Reports · Vilo",
};

export default function ReportsPage() {
  return (
    <ComingSoon
      icon={BarChart3}
      title="Reports"
      tagline="Earnings, occupancy, conversion, channel mix — exported as CSV."
      phase="Phase 4"
      bullets={[
        "Revenue + bookings by month, listing, channel",
        "Occupancy heatmap across the next 12 months",
        "Booking funnel: enquiries → confirmed → completed",
        "CSV export for your accountant",
      ]}
    />
  );
}
