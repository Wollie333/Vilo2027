// Server-side coupon resolution — the single place a coupon code is validated
// against a stay. Used by the guest preview (validateCouponAction) and the
// authoritative booking action so the rules can't drift. Never trust the client
// for eligibility: this runs with the admin client (coupons are host-private).

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResolvedCoupon } from "@/lib/pricing";

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export type CouponContext = {
  code: string;
  /** The listing's host — coupons are scoped to a host. */
  hostId: string;
  listingId: string;
  nights: number;
  /** Booked room ids (rooms scope) — a room-scoped coupon must match one. */
  roomIds: string[];
  /** Discounted accommodation subtotal (for order/accommodation min-spend). */
  accommodationAmount: number;
  /** Add-ons subtotal (for addons/order min-spend). */
  addonsAmount: number;
};

export type CouponResolution =
  | { ok: true; resolved: ResolvedCoupon; couponId: string; label: string }
  | { ok: false; error: string };

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number | string;
  scope: "order" | "accommodation" | "addons";
  listing_id: string | null;
  room_id: string | null;
  min_nights: number | null;
  min_spend: number | string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  per_guest_limit: number | null;
  redeemed_count: number;
  is_active: boolean;
};

/**
 * Validate a code for this stay and return the ResolvedCoupon the pricing engine
 * applies. Window, listing/room targeting, min-nights, min-spend and the total
 * cap are checked here; the per-guest cap + the final atomic decrement happen in
 * redeem_coupon() at booking time.
 */
export async function resolveCoupon(
  admin: SupabaseClient,
  ctx: CouponContext,
): Promise<CouponResolution> {
  const code = normalizeCouponCode(ctx.code);
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const { data: rows } = await admin
    .from("coupons")
    .select(
      "id, code, description, discount_type, discount_value, scope, listing_id, room_id, min_nights, min_spend, starts_at, ends_at, max_redemptions, per_guest_limit, redeemed_count, is_active",
    )
    .eq("host_id", ctx.hostId)
    .ilike("code", code)
    .limit(1);

  const c = (rows ?? [])[0] as CouponRow | undefined;
  if (!c || !c.is_active)
    return { ok: false, error: "That coupon isn’t valid." };

  const nowIso = new Date().toISOString();
  if (c.starts_at && nowIso < c.starts_at) {
    return { ok: false, error: "This coupon isn’t active yet." };
  }
  if (c.ends_at && nowIso > c.ends_at) {
    return { ok: false, error: "This coupon has expired." };
  }
  if (c.listing_id && c.listing_id !== ctx.listingId) {
    return { ok: false, error: "This coupon doesn’t apply to this listing." };
  }
  if (c.room_id && !ctx.roomIds.includes(c.room_id)) {
    return { ok: false, error: "Add the eligible room to use this coupon." };
  }
  if (c.min_nights && ctx.nights < c.min_nights) {
    return {
      ok: false,
      error: `This coupon needs a stay of at least ${c.min_nights} nights.`,
    };
  }
  if (c.max_redemptions != null && c.redeemed_count >= c.max_redemptions) {
    return { ok: false, error: "This coupon has been fully redeemed." };
  }

  const eligible =
    c.scope === "addons"
      ? ctx.addonsAmount
      : c.scope === "accommodation"
        ? ctx.accommodationAmount
        : ctx.accommodationAmount + ctx.addonsAmount;
  if (c.min_spend != null && eligible < Number(c.min_spend)) {
    return {
      ok: false,
      error: `Your eligible total is below this coupon’s minimum.`,
    };
  }

  return {
    ok: true,
    couponId: c.id,
    label: c.description || code,
    resolved: {
      code,
      discountType: c.discount_type === "fixed" ? "fixed" : "percent",
      discountValue: Number(c.discount_value),
      scope: c.scope,
      roomId: c.room_id,
    },
  };
}
