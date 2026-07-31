import "server-only";

import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

import { REF_COOKIE } from "./attribution";
import type { Competition } from "./campaigns";
import { computeFoundingTrialEnd, isCampaignWindowOpen } from "./trialRule";

/**
 * The host free-trial a competition grants, resolved server-side.
 *
 * A host who signs up through a partner link during an active competition is
 * placed on a `trialing` subscription for the competition's dedicated product
 * (its own price/rules — the public plan is never re-priced). This module is the
 * single source of truth for "is there a trial, for which product, ending when".
 * The signup page uses `getCompetitionTrialOffer()` (cookie) to render the
 * toolkit step; the finalize action re-resolves from the BOUND referral's
 * campaign via `resolveTrialOfferForCampaign()` — never trusting client input.
 */
export type CompetitionTrialOffer = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  productId: string;
  productName: string;
  priceMonthly: number;
  priceAnnual: number | null;
  currency: string;
  /** ISO instant free access ends — computeFoundingTrialEnd(now, host_trial). */
  trialEndsAt: string;
};

/**
 * Resolve the active trial offer for a campaign id, or null when the campaign is
 * not live, has no host_trial product, or the product is inactive. Authoritative
 * — used by both the cookie-driven page display and the server finalize branch.
 */
export async function resolveTrialOfferForCampaign(
  admin: ReturnType<typeof createAdminClient>,
  campaignId: string,
  nowMs: number,
): Promise<CompetitionTrialOffer | null> {
  const { data: camp } = await admin
    .from("affiliate_campaigns")
    .select("id, name, slug, status, starts_at, ends_at, competition")
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) return null;
  if (!isCampaignWindowOpen(camp.status, camp.starts_at, camp.ends_at, nowMs)) {
    return null;
  }

  const comp = (camp.competition ?? {}) as Competition;
  const ht = comp.host_trial;
  if (!ht?.product_id) return null;

  const trialEndsAt = computeFoundingTrialEnd(nowMs, {
    cohort_end: ht.cohort_end,
    floor_days: ht.floor_days,
  });
  if (!trialEndsAt) return null;

  const { data: product } = await admin
    .from("products")
    .select("id, name, price, annual_price, currency, is_active")
    .eq("id", ht.product_id)
    .maybeSingle();
  if (!product || !product.is_active) return null;

  return {
    campaignId: camp.id,
    campaignName: camp.name,
    campaignSlug: camp.slug,
    productId: product.id,
    productName: product.name,
    priceMonthly: Number(product.price),
    priceAnnual:
      product.annual_price != null ? Number(product.annual_price) : null,
    currency: product.currency,
    trialEndsAt,
  };
}

/**
 * The competition trial offer for the visitor's `vilo_ref` cookie, for rendering
 * the signup toolkit step. Reads the cookie's campaign id, resolves the offer,
 * and adds the referring partner's name for the copy. Read-only; null when there
 * is no cookie, no campaign, or the competition grants no trial. Never throws.
 */
export async function getCompetitionTrialOffer(): Promise<
  (CompetitionTrialOffer & { partnerName: string | null }) | null
> {
  try {
    const raw = cookies().get(REF_COOKIE)?.value;
    if (!raw) return null;
    let payload: { aff?: string; camp?: string };
    try {
      payload = JSON.parse(raw) as { aff?: string; camp?: string };
    } catch {
      return null;
    }
    if (!payload?.camp) return null;

    // Live read: the trial hinges on the campaign's current window, same as /r.
    const admin = createAdminClient({ noStore: true });
    const offer = await resolveTrialOfferForCampaign(
      admin,
      payload.camp,
      Date.now(),
    );
    if (!offer) return null;

    let partnerName: string | null = null;
    if (payload.aff) {
      const { data } = await admin
        .from("affiliate_accounts")
        .select("slug, user:user_profiles!user_id ( full_name )")
        .eq("id", payload.aff)
        .maybeSingle();
      if (data) {
        const u = Array.isArray(data.user) ? data.user[0] : data.user;
        partnerName =
          (u?.full_name as string | null)?.trim() || (data.slug as string);
      }
    }

    return { ...offer, partnerName };
  } catch {
    return null;
  }
}
