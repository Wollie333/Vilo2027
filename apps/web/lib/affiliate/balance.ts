import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

import { round2 } from "./fees";

// Canonical affiliate balance derivation — sum the signed commission rows.
// Mirrors lib/payments/ledger.ts ("sum the rows"): negative clawback offsets
// reduce lifetime/available automatically, no special-casing. This backs the
// affiliate Overview, the payout threshold check, and the admin detail page.

type Db = ReturnType<typeof createAdminClient>;

export type AffiliateBalance = {
  pending: number; // accrued, still in the refund hold window
  cleared: number; // past the hold window (cleared total, incl. negative offsets)
  available: number; // cleared AND not yet attached to a payout — withdrawable
  inPayout: number; // cleared AND attached to a payout in flight
  paid: number; // settled to the affiliate
  clawedBack: number; // magnitude voided/offset by refunds (informational)
  lifetime: number; // net earned across all non-voided rows
  currency: string;
};

export type CommissionRowLike = {
  status: string;
  entry_type: string;
  payout_id: string | null;
  commission_amount: number;
  currency: string | null;
};

export function summariseCommissions(
  rows: CommissionRowLike[],
  currency = "ZAR",
): AffiliateBalance {
  let pending = 0;
  let cleared = 0;
  let available = 0;
  let inPayout = 0;
  let paid = 0;
  let clawedBack = 0;
  let lifetime = 0;
  let cur = currency;

  for (const r of rows) {
    const amt = Number(r.commission_amount ?? 0);
    if (r.currency) cur = r.currency;

    if (r.status === "voided") {
      // A voided accrual was never real income; count its magnitude as clawed back.
      if (r.entry_type === "accrual") clawedBack += Math.abs(amt);
      continue;
    }

    lifetime += amt;
    if (amt < 0) clawedBack += Math.abs(amt); // negative offset = clawed back

    if (r.status === "pending") {
      pending += amt;
    } else if (r.status === "cleared") {
      cleared += amt;
      if (r.payout_id) inPayout += amt;
      else available += amt;
    } else if (r.status === "paid") {
      paid += amt;
    }
  }

  return {
    pending: round2(pending),
    cleared: round2(cleared),
    available: round2(Math.max(0, available)),
    inPayout: round2(inPayout),
    paid: round2(paid),
    clawedBack: round2(clawedBack),
    lifetime: round2(lifetime),
    currency: cur,
  };
}

export async function getAffiliateBalance(
  admin: Db,
  affiliateId: string,
): Promise<AffiliateBalance> {
  const { data, error } = await admin
    .from("affiliate_commissions")
    .select("status, entry_type, payout_id, commission_amount, currency")
    .eq("affiliate_id", affiliateId);
  if (error) throw new Error(`getAffiliateBalance: ${error.message}`);
  return summariseCommissions((data ?? []) as CommissionRowLike[]);
}
