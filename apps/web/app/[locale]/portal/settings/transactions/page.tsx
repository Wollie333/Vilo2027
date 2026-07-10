import type { Metadata } from "next";

import { WieloTransactionHistory } from "@/components/finance/WieloTransactionHistory";

export const metadata: Metadata = {
  title: "Transaction history · Settings",
};

export const dynamic = "force-dynamic";

export default function PortalTransactionsPage() {
  return (
    <WieloTransactionHistory
      heading="Transaction history"
      description="Your payments to Wielo, with downloadable invoices and credit notes."
    />
  );
}
