import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Data for the dashboard header trial widget, shown ONLY to hosts who came in
 * via a partner link during a competition and are on a free trial. Returns null
 * for everyone else (organic hosts, paid hosts, no bound referral) so the chip
 * simply doesn't render. Read with the admin client because a host cannot read
 * affiliate_accounts/campaigns under RLS — scoped tightly to this host's own
 * trial + referral. Never throws.
 */
export type HostTrialWidget = {
  referrerName: string | null;
  campaignName: string | null;
  productName: string;
  priceMonthly: number;
  priceAnnual: number | null;
  currency: string;
  /** ISO instant the trial's free access ends. */
  trialEndsAt: string;
};

export async function getHostTrialWidget(
  userId: string,
  hostId: string,
): Promise<HostTrialWidget | null> {
  try {
    const admin = createAdminClient();

    // Must be on a trial right now.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("product_id, trial_ends_at")
      .eq("host_id", hostId)
      .eq("status", "trialing")
      .maybeSingle();
    if (!sub?.product_id || !sub.trial_ends_at) return null;

    // Must have come via a competition partner link (bound referral + campaign).
    const { data: ref } = await admin
      .from("affiliate_referrals")
      .select("affiliate_id, campaign_id")
      .eq("referred_user_id", userId)
      .maybeSingle();
    if (!ref?.campaign_id) return null;

    const [{ data: product }, { data: campaign }] = await Promise.all([
      admin
        .from("products")
        .select("name, price, annual_price, currency")
        .eq("id", sub.product_id)
        .maybeSingle(),
      admin
        .from("affiliate_campaigns")
        .select("name")
        .eq("id", ref.campaign_id)
        .maybeSingle(),
    ]);
    if (!product) return null;

    let referrerName: string | null = null;
    if (ref.affiliate_id) {
      const { data: aff } = await admin
        .from("affiliate_accounts")
        .select("slug, user:user_profiles!user_id ( full_name )")
        .eq("id", ref.affiliate_id)
        .maybeSingle();
      if (aff) {
        const u = Array.isArray(aff.user) ? aff.user[0] : aff.user;
        referrerName =
          (u?.full_name as string | null)?.trim() || (aff.slug as string);
      }
    }

    return {
      referrerName,
      campaignName: campaign?.name ?? null,
      productName: product.name,
      priceMonthly: Number(product.price),
      priceAnnual:
        product.annual_price != null ? Number(product.annual_price) : null,
      currency: product.currency,
      trialEndsAt: sub.trial_ends_at,
    };
  } catch {
    return null;
  }
}
