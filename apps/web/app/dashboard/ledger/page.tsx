import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMyHostId } from "@/lib/host/current";
import {
  fetchHostTransactions,
  txnStats,
  type Txn,
} from "@/lib/finance/transactions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { LedgerBoard } from "./LedgerBoard";

export const metadata: Metadata = { title: "Ledger" };
export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) notFound();

  const admin = createAdminClient();
  // Include voided so the board can offer a "Voided" filter (audit view); they
  // carry zero effect, so KPIs and balances are unaffected.
  const entries = await fetchHostTransactions(admin, {
    hostId,
    includeVoided: true,
  });
  const stats = txnStats(entries);

  // Guest filter options (unique, by gkey).
  const seen = new Map<string, string>();
  for (const e of entries) {
    if (e.guestKey && !seen.has(e.guestKey)) {
      seen.set(e.guestKey, e.guestName ?? "Guest");
    }
  }
  const guests = [...seen.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const currency = entries[0]?.currency ?? "ZAR";

  return (
    <LedgerBoard
      entries={entries as Txn[]}
      stats={stats}
      guests={guests}
      currency={currency}
    />
  );
}
