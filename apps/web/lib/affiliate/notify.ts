import "server-only";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import { formatMoney } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";

import { loadCampaignResults } from "./finalize";

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

// Tell each winning partner their placing + prizes once a campaign's final
// results are published. One email/in-app per winner, summarising everything
// they won (a partner can take several prizes). Never throws into publish.
export async function notifyCampaignWinners(
  admin: Db,
  args: { campaignId: string; campaignName: string },
): Promise<void> {
  try {
    const results = await loadCampaignResults(args.campaignId);
    if (!results || results.winners.length === 0) return;

    // One line per prize, grouped per partner.
    const phrasesByAffiliate = new Map<string, string[]>();
    for (const w of results.winners) {
      const bits = [w.label];
      if (w.cash > 0) bits.push(formatMoney(w.cash, "ZAR"));
      if (w.floorPct > 0) bits.push(`${w.floorPct}% rate floor`);
      const list = phrasesByAffiliate.get(w.affiliateId) ?? [];
      list.push(bits.join(" · "));
      phrasesByAffiliate.set(w.affiliateId, list);
    }
    const ids = [...phrasesByAffiliate.keys()];
    if (!ids.length) return;

    const { data: accts } = await admin
      .from("affiliate_accounts")
      .select("id, user_id")
      .in("id", ids);
    const userIds = (accts ?? []).map((a) => a.user_id);
    const { data: profs } = userIds.length
      ? await admin
          .from("user_profiles")
          .select("id, email, full_name")
          .in("id", userIds)
      : {
          data: [] as {
            id: string;
            email: string | null;
            full_name: string | null;
          }[],
        };
    const profByUser = new Map((profs ?? []).map((p) => [p.id, p]));

    for (const a of accts ?? []) {
      const p = profByUser.get(a.user_id);
      const detail = (phrasesByAffiliate.get(a.id) ?? []).join("; ");
      await dispatchEvent({
        kind: "affiliate_campaign_won",
        recipientUserId: a.user_id,
        refs: {
          campaignName: args.campaignName,
          firstName: (p?.full_name ?? "").trim().split(/\s+/)[0] || "",
          detail,
          recipient_email: p?.email ?? undefined,
        },
        supabase: admin,
      });
    }
  } catch {
    // Winners must still be published even if we could not email them.
  }
}
