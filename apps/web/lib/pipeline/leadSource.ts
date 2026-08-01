import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// One place that turns a user's affiliate attribution into how the pipeline card
// records its SOURCE, so the board reads the same whether the person arrived via
// the default signup or a /go funnel:
//
//   * competition affiliate link  → source_kind 'competition' (badge "🏆 <name>"),
//     drip suppressed (they're already in the competition's own comms), affiliate
//     still recorded so commission is unaffected.
//   * normal affiliate link       → source_kind 'affiliate_referral' ("via <slug>").
//   * no referral                 → the caller's default (direct / host_funnel / …).
//
// The distinction is data-driven: bindAffiliateReferral stamps
// affiliate_referrals.campaign_id ONLY for a real competition CLICK (a typed
// partner code or a plain affiliate link leaves it null) — see
// lib/affiliate/attribution.ts.

export type LeadSource = {
  sourceKind: "competition" | "affiliate_referral" | null;
  /** Display label: the competition name, or the affiliate slug for a referral. */
  sourceLabel: string | null;
  /** The referring affiliate's slug (kept for both competition + normal refs). */
  affiliateRef: string | null;
  /** Competition leads skip the default nurture drip. */
  suppressNurture: boolean;
};

/**
 * Resolve the pipeline source for a user from their (already-bound) affiliate
 * referral. Returns `sourceKind: null` when there is no referral — the caller
 * keeps its own default (e.g. 'direct' for a signup, 'host_funnel' for a funnel).
 * Best-effort: a read failure resolves to "no referral", never throws.
 */
export async function resolveLeadSource(
  admin: SupabaseClient,
  userId: string,
): Promise<LeadSource> {
  const none: LeadSource = {
    sourceKind: null,
    sourceLabel: null,
    affiliateRef: null,
    suppressNurture: false,
  };
  try {
    const { data } = await admin
      .from("affiliate_referrals")
      .select(
        "campaign_id, affiliate_accounts(slug), affiliate_campaigns(name)",
      )
      .eq("referred_user_id", userId)
      .maybeSingle();
    if (!data) return none;

    const slug =
      (data.affiliate_accounts as { slug?: string } | null)?.slug ?? null;
    const campaignName =
      (data.affiliate_campaigns as { name?: string } | null)?.name ?? null;

    // A campaign-bound referral = a competition link.
    if (data.campaign_id) {
      return {
        sourceKind: "competition",
        sourceLabel: campaignName ?? "Competition",
        affiliateRef: slug,
        suppressNurture: true,
      };
    }
    if (slug) {
      return {
        sourceKind: "affiliate_referral",
        sourceLabel: slug,
        affiliateRef: slug,
        suppressNurture: false,
      };
    }
    return none;
  } catch {
    return none;
  }
}
