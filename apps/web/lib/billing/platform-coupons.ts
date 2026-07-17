import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { round2 } from "@/lib/format";

// Server-side promo-code resolution — the single place a Wielo code is validated
// against a product order. Used by the checkout preview (applyPromoCodeAction)
// and by the authoritative order writer, so the rules can't drift. Never trust
// the client for eligibility: this runs with the admin client because the code
// catalogue is admin-private (RLS blocks anon/authenticated entirely).
//
// The host booking coupon is a DIFFERENT feature — see lib/coupons.ts. That one
// discounts a stay for a guest and is owned by a host; this one discounts a
// Wielo product for the buyer and is owned by Wielo.

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

export type PlatformCouponContext = {
  code: string;
  productId: string;
  /** membership | service | product | wielo_credits */
  productType: string;
  /** The order total the code applies to: price + setup fee, before discount. */
  amount: number;
  currency: string;
  /** The buyer, when known — lets us pre-check the per-user cap. */
  userId?: string | null;
};

export type PlatformCouponResolution =
  | {
      ok: true;
      couponId: string;
      code: string;
      /** Buyer-facing label for the applied chip. */
      label: string;
      /** Amount taken off (never more than the order total). */
      discount: number;
      /** What the buyer now pays. */
      total: number;
    }
  | { ok: false; error: string };

type PlatformCouponRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number | string;
  product_id: string | null;
  product_type: string | null;
  currency: string;
  min_spend: number | string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  per_user_limit: number | null;
  redeemed_count: number;
  is_active: boolean;
};

/**
 * Validate a promo code against a product order and return what it takes off.
 * Window, product targeting, currency, min-spend and both caps are checked here;
 * the redemption itself is recorded by redeem_platform_coupon() once the money
 * is real (see the settle paths in product-checkout.ts).
 *
 * Errors are deliberately specific ("expired" vs "doesn't apply to this
 * product") — a buyer who mistypes a real code should not be told the same thing
 * as one whose code has run out.
 */
export async function resolvePlatformCoupon(
  admin: SupabaseClient,
  ctx: PlatformCouponContext,
): Promise<PlatformCouponResolution> {
  const code = normalizePromoCode(ctx.code);
  if (!code) return { ok: false, error: "Enter a promo code." };

  const { data: rows } = await admin
    .from("platform_coupons")
    .select(
      "id, code, description, discount_type, discount_value, product_id, product_type, currency, min_spend, starts_at, ends_at, max_redemptions, per_user_limit, redeemed_count, is_active",
    )
    .ilike("code", code)
    .limit(1);

  const c = (rows ?? [])[0] as PlatformCouponRow | undefined;
  if (!c || !c.is_active)
    return { ok: false, error: "That promo code isn’t valid." };

  const nowIso = new Date().toISOString();
  if (c.starts_at && nowIso < c.starts_at) {
    return { ok: false, error: "This promo code isn’t active yet." };
  }
  if (c.ends_at && nowIso > c.ends_at) {
    return { ok: false, error: "This promo code has expired." };
  }
  if (c.product_id && c.product_id !== ctx.productId) {
    return { ok: false, error: "This promo code doesn’t apply to this item." };
  }
  if (c.product_type && c.product_type !== ctx.productType) {
    return { ok: false, error: "This promo code doesn’t apply to this item." };
  }
  // Currency guard — lib/coupons.ts documents the absence of one as a known gap
  // (the frontend is ZAR-locked today). Cheap to hold the line here from day one.
  if (c.currency !== ctx.currency) {
    return {
      ok: false,
      error: "This promo code can’t be used in this currency.",
    };
  }
  if (c.max_redemptions != null && c.redeemed_count >= c.max_redemptions) {
    return { ok: false, error: "This promo code has been fully redeemed." };
  }
  if (c.min_spend != null && ctx.amount < Number(c.min_spend)) {
    return {
      ok: false,
      error: "Your total is below this promo code’s minimum.",
    };
  }

  // Per-user cap. Only checkable for a known buyer; an order placed by a brand
  // new lead has no history to check against, which is the same limitation the
  // booking coupon has for anonymous checkouts.
  if (c.per_user_limit != null && ctx.userId) {
    const { count } = await admin
      .from("platform_coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", c.id)
      .eq("user_id", ctx.userId);
    if ((count ?? 0) >= c.per_user_limit) {
      return {
        ok: false,
        error:
          "You’ve already used this promo code the maximum number of times.",
      };
    }
  }

  const raw =
    c.discount_type === "fixed"
      ? Number(c.discount_value)
      : (ctx.amount * Number(c.discount_value)) / 100;

  // Discounts land on whole Rands. formatMoney() renders whole Rands app-wide,
  // and every Wielo product is priced in whole Rands — so a percentage was the
  // first thing here able to produce cents (30% off R599 = R179.70). That would
  // print "R 419" on the pay page while Paystack charged R419.30: a label that
  // lies about the price. Rounding the discount keeps shown == charged.
  // Clamp AFTER rounding, so a 100%-off code on an odd price can't round the
  // discount above the total and drive the order negative.
  const discount = round2(Math.min(Math.round(Math.max(raw, 0)), ctx.amount));

  if (discount <= 0) {
    return { ok: false, error: "This promo code doesn’t reduce this total." };
  }

  return {
    ok: true,
    couponId: c.id,
    code,
    label: c.description || code,
    discount,
    total: round2(ctx.amount - discount),
  };
}
