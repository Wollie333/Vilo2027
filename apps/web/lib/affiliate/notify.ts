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

// Tell a partner they have been paused out of — or restored to — a competition.
//
// Sent on BOTH transitions on purpose: a partner who quietly vanishes from the
// leaderboard will assume it is a bug, and one who is quietly restored never
// learns they can compete again. The reason is written by the admin and shown
// to the partner verbatim, so it goes through unedited.
//
// Never throws: a failed notification must not roll back the pause itself.
export async function notifyCampaignPauseChanged(
  admin: Db,
  args: {
    campaignId: string;
    affiliateId: string;
    paused: boolean;
    reason: string | null;
  },
): Promise<void> {
  try {
    const [{ data: acct }, { data: camp }] = await Promise.all([
      admin
        .from("affiliate_accounts")
        .select("user_id, user:user_profiles!user_id ( email, full_name )")
        .eq("id", args.affiliateId)
        .maybeSingle(),
      admin
        .from("affiliate_campaigns")
        .select("name")
        .eq("id", args.campaignId)
        .maybeSingle(),
    ]);
    if (!acct?.user_id) return;
    const acctUser = Array.isArray(acct.user) ? acct.user[0] : acct.user;

    await dispatchEvent({
      kind: "campaign_pause_changed",
      recipientUserId: acct.user_id,
      refs: {
        firstName: (acctUser?.full_name ?? "").trim().split(/\s+/)[0] || "",
        campaignName: camp?.name ?? "the competition",
        paused: args.paused ? "true" : "false",
        reason: args.reason ?? undefined,
        recipient_email: acctUser?.email ?? undefined,
      },
      supabase: admin,
    });
  } catch {
    // A pause must stand even if we could not tell them about it.
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
