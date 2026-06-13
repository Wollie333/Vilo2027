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

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: { business?: string };
}) {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) notFound();

  const admin = createAdminClient();

  // The host's businesses — drives the per-business filter. Only shown when
  // there's more than one. Default business first.
  const { data: bizRows } = await admin
    .from("businesses")
    .select("id, trading_name, legal_name")
    .eq("host_id", hostId)
    .eq("is_archived", false)
    .order("is_default", { ascending: false });
  const businesses = (bizRows ?? []).map((b) => ({
    id: b.id as string,
    name: (b.trading_name || b.legal_name || "Business") as string,
  }));
  // Validate the requested business belongs to this host; else treat as "all".
  const selectedBusiness =
    businesses.find((b) => b.id === searchParams.business)?.id ?? null;

  // Include voided so the board can offer a "Voided" filter (audit view); they
  // carry zero effect, so KPIs and balances are unaffected. When a business is
  // selected, transactions (and their running balances) are scoped to it.
  const entries = await fetchHostTransactions(admin, {
    hostId,
    includeVoided: true,
    businessId: selectedBusiness,
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

  // Closed accounting months (YYYY-MM) for the period control.
  const { data: periods } = await admin
    .from("accounting_periods")
    .select("period_month")
    .eq("host_id", hostId);
  const closedMonths = (periods ?? []).map((p) =>
    (p.period_month as string).slice(0, 7),
  );

  return (
    <LedgerBoard
      entries={entries as Txn[]}
      stats={stats}
      guests={guests}
      currency={currency}
      closedMonths={closedMonths}
      businesses={businesses}
      selectedBusiness={selectedBusiness}
    />
  );
}
