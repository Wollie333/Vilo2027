import type { Metadata } from "next";

import { WieloTransactionHistory } from "@/components/finance/WieloTransactionHistory";

export const metadata: Metadata = {
  title: "Transaction history · Settings",
};

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  return <WieloTransactionHistory />;
}
