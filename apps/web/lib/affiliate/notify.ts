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

const firstName = (full: string | null | undefined): string =>
  (full ?? "").trim().split(/\s+/)[0] || "";

// Welcome a partner into a competition ("you're in the Founding Race"). Fired
// once, when a freshly-activated partner is enrolled. Gated by the override
// layer like every dispatch; never throws into activation.
export async function notifyCampaignPartnerEnrolled(
  admin: Db,
  args: { campaignId: string; affiliateId: string },
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
    const u = Array.isArray(acct.user) ? acct.user[0] : acct.user;

    await dispatchEvent({
      kind: "campaign_partner_enrolled",
      recipientUserId: acct.user_id,
      refs: {
        firstName: firstName(u?.full_name),
        campaignName: camp?.name ?? "the competition",
        recipient_email: u?.email ?? undefined,
      },
      supabase: admin,
    });
  } catch {
    // Enrolment stands even if we could not welcome them.
  }
}

// The kickoff / launch announcement — sent to every active partner in a
// competition the moment it goes live. One send per enrolled partner. Never
// throws into the status change.
export async function notifyCampaignKickoff(
  admin: Db,
  args: { campaignId: string },
): Promise<void> {
  try {
    const { data: camp } = await admin
      .from("affiliate_campaigns")
      .select("name, ends_at")
      .eq("id", args.campaignId)
      .maybeSingle();
    if (!camp) return;

    // Recipients = everyone enrolled now, UNIONED with active accounts that
    // signed up through this competition (pre-launch signups aren't enrolled
    // until the campaign is active, so at the moment of launch the enrollment
    // table alone can be near-empty).
    const [{ data: enrollments }, { data: signups }] = await Promise.all([
      admin
        .from("affiliate_campaign_enrollments")
        .select("affiliate_id")
        .eq("campaign_id", args.campaignId)
        .eq("status", "active"),
      admin
        .from("affiliate_accounts")
        .select("id")
        .eq("signup_campaign_id", args.campaignId)
        .eq("status", "active"),
    ]);
    const affiliateIds = Array.from(
      new Set([
        ...(enrollments ?? []).map((e) => e.affiliate_id),
        ...(signups ?? []).map((s) => s.id),
      ]),
    );
    if (!affiliateIds.length) return;

    const { data: accts } = await admin
      .from("affiliate_accounts")
      .select("id, user_id, user:user_profiles!user_id ( email, full_name )")
      .in("id", affiliateIds);

    const endsOn = camp.ends_at
      ? new Date(camp.ends_at).toLocaleDateString("en-ZA", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : undefined;

    for (const a of accts ?? []) {
      if (!a.user_id) continue;
      const u = Array.isArray(a.user) ? a.user[0] : a.user;
      await dispatchEvent({
        kind: "campaign_kickoff",
        recipientUserId: a.user_id,
        refs: {
          firstName: firstName(u?.full_name),
          campaignName: camp.name ?? "the competition",
          endsOn,
          recipient_email: u?.email ?? undefined,
        },
        supabase: admin,
      });
    }
  } catch {
    // Launch stands even if the announcement failed to go out.
  }
}

// A referred host published a listing — a point on the partner's board. Fired
// from the property-publish path on the host's FIRST live listing only, and
// only when they were referred through a competition that is still running.
// Never throws into publish.
export async function notifyCampaignReferralActivated(
  admin: Db,
  args: { hostId: string; listingId: string; listingName: string },
): Promise<void> {
  try {
    // First activation only: a host who already has another live listing has
    // already "activated" — don't re-ping the partner on every publish.
    const { count: otherLive } = await admin
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("host_id", args.hostId)
      .eq("is_published", true)
      .neq("id", args.listingId);
    if ((otherLive ?? 0) > 0) return;

    // Who referred this host, and through which competition.
    const { data: refs } = await admin
      .from("affiliate_referrals")
      .select("affiliate_id, campaign_id, referred_user_id")
      .eq("referred_host_id", args.hostId)
      .not("campaign_id", "is", null);
    if (!refs?.length) return;

    for (const r of refs) {
      if (!r.campaign_id) continue;
      const { data: camp } = await admin
        .from("affiliate_campaigns")
        .select("name, status")
        .eq("id", r.campaign_id)
        .maybeSingle();
      if (camp?.status !== "active") continue;

      const { data: acct } = await admin
        .from("affiliate_accounts")
        .select("user_id, user:user_profiles!user_id ( email, full_name )")
        .eq("id", r.affiliate_id)
        .maybeSingle();
      if (!acct?.user_id) continue;
      const u = Array.isArray(acct.user) ? acct.user[0] : acct.user;

      // Host display name (the partner sees who activated).
      const { data: hostProfile } = r.referred_user_id
        ? await admin
            .from("user_profiles")
            .select("full_name")
            .eq("id", r.referred_user_id)
            .maybeSingle()
        : { data: null };

      await dispatchEvent({
        kind: "campaign_referral_activated",
        recipientUserId: acct.user_id,
        refs: {
          firstName: firstName(u?.full_name),
          campaignName: camp.name ?? "the competition",
          hostName: hostProfile?.full_name ?? args.listingName,
          listingName: args.listingName,
          recipient_email: u?.email ?? undefined,
        },
        supabase: admin,
      });
    }
  } catch {
    // Publish stands even if the partner could not be notified.
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
