import "server-only";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import { formatMoney } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

// Accrue affiliate commission for a settled charge. The "commission earned"
// notification fires from a DB trigger on the new commission row (see migration
// 20260711130000) so it reaches the affiliate no matter which runtime created
// the charge — including the Deno paystack-webhook for subscription renewals.
// Never throws into settlement.
export async function accrueAffiliateAndNotify(
  admin: Db,
  ledgerId: string,
): Promise<void> {
  try {
    await admin.rpc("accrue_affiliate_commission", { p_ledger_id: ledgerId });
  } catch {
    // Accrual must never break settlement.
  }
}

// Notify an affiliate that their payout has been sent (call after settle → paid).
export async function notifyAffiliatePayoutPaid(
  admin: Db,
  payoutId: string,
): Promise<void> {
  try {
    const { data: p } = await admin
      .from("affiliate_payouts")
      .select("net_amount, currency, method, affiliate_id")
      .eq("id", payoutId)
      .maybeSingle();
    if (!p) return;
    const { data: acct } = await admin
      .from("affiliate_accounts")
      .select("user_id, user:user_profiles!user_id ( email )")
      .eq("id", p.affiliate_id)
      .maybeSingle();
    if (!acct?.user_id) return;
    const acctUser = Array.isArray(acct.user) ? acct.user[0] : acct.user;

    await dispatchEvent({
      kind: "affiliate_payout_paid",
      recipientUserId: acct.user_id,
      refs: {
        amount: formatMoney(Number(p.net_amount), p.currency ?? "ZAR"),
        detail: p.method ?? undefined,
        recipient_email: acctUser?.email ?? undefined,
      },
      supabase: admin,
    });
  } catch {
    // Notification must never break the payout settlement.
  }
}
