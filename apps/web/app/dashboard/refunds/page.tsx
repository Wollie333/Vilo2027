import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";

import { ComingSoon } from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Refunds · Vilo",
};

export default function RefundsPage() {
  return (
    <ComingSoon
      icon={RotateCcw}
      title="Refunds"
      tagline="Approve, decline and process refunds — bound to your cancellation policy."
      phase="Phase 4"
      bullets={[
        "Refund Manager dashboard (pending / approved / declined queues)",
        "Policy-entitlement calculator runs per booking",
        "Paystack / PayPal refund processing + EFT manual mark-as-sent",
        "Guest escalation flow when the host won&rsquo;t respond",
      ]}
    />
  );
}
