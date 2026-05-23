import type { Metadata } from "next";
import { Receipt } from "lucide-react";

import { ComingSoon } from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Invoices · Vilo",
};

export default function InvoicesPage() {
  return (
    <ComingSoon
      icon={Receipt}
      title="Invoices"
      tagline="Tax invoices for every booking and every subscription month."
      phase="Phase 4"
      bullets={[
        "Per-booking invoice (your VAT details + the guest&rsquo;s)",
        "Monthly Vilo subscription invoice for SARS",
        "Bulk PDF export by date range",
        "Hosted-invoice URL guests can resend themselves",
      ]}
    />
  );
}
