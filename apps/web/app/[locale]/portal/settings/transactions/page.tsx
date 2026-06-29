import type { Metadata } from "next";

import { ViloTransactionHistory } from "@/components/finance/ViloTransactionHistory";

export const metadata: Metadata = {
  title: "Transaction history · Settings",
};

export const dynamic = "force-dynamic";

export default function PortalTransactionsPage() {
  return (
    <ViloTransactionHistory
      heading="Transaction history"
      description="Your payments to Wielo, with downloadable invoices."
    />
  );
}
