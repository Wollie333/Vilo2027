import {
  resolveMembershipAmount,
  round2,
  type MembershipPricing,
} from "@/lib/billing/membershipPricing";

// WS-8 — the maths behind the public commission calculator. Pure and unit-tested:
// it is the number a host decides on, and the partner pack links straight to it.
//
// Honesty rules baked in (BUSINESS_PRINCIPLES — "talks in rand", never oversells):
//   • The subscription is a real cost, always subtracted — never a "R0" headline.
//   • Below the break-even revenue the subscription costs MORE than commission,
//     and `betterOnWielo` says so rather than rendering a negative "saving".
//   • Wielo's price comes from the products row (WS-5 reader), never a constant.

export const COMMISSION_PRESETS = [
  { key: "lekkeslaap", label: "Lekkeslaap", rate: 17, note: "15% + VAT" },
  { key: "booking", label: "Booking.com", rate: 15, note: "typical rate" },
  { key: "airbnb", label: "Airbnb", rate: 15, note: "host service fee" },
] as const;

export const REVENUE_MIN = 5_000;
export const REVENUE_MAX = 200_000;
export const RATE_MIN = 5;
export const RATE_MAX = 25;
export const LISTINGS_MIN = 1;
export const LISTINGS_MAX = 20;

export type CommissionComparison = {
  monthlyRevenue: number;
  commissionRate: number;
  listings: number;
  /** Commission an OTA takes at this revenue. */
  commissionMonthly: number;
  commissionAnnual: number;
  /** What Wielo charges for this many listings (base + extras). */
  wieloMonthly: number;
  wieloAnnual: number;
  /** Commission minus subscription. Negative when Wielo costs more. */
  differenceAnnual: number;
  betterOnWielo: boolean;
  /** Monthly revenue at which the subscription equals the commission. */
  breakEvenMonthlyRevenue: number;
};

export function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function computeCommissionComparison(input: {
  monthlyRevenue: number;
  commissionRate: number;
  listings: number;
  product: MembershipPricing;
}): CommissionComparison {
  const monthlyRevenue = clampNumber(
    Math.round(input.monthlyRevenue),
    0,
    REVENUE_MAX,
  );
  const commissionRate = clampNumber(input.commissionRate, 0, RATE_MAX);
  const listings = Math.round(
    clampNumber(input.listings, LISTINGS_MIN, LISTINGS_MAX),
  );

  const commissionMonthly = round2(monthlyRevenue * (commissionRate / 100));
  const wieloMonthly = resolveMembershipAmount({
    cycle: "monthly",
    listingCount: listings,
    product: input.product,
  });

  const commissionAnnual = round2(commissionMonthly * 12);
  const wieloAnnual = round2(wieloMonthly * 12);

  return {
    monthlyRevenue,
    commissionRate,
    listings,
    commissionMonthly,
    commissionAnnual,
    wieloMonthly,
    wieloAnnual,
    differenceAnnual: round2(commissionAnnual - wieloAnnual),
    betterOnWielo: commissionAnnual > wieloAnnual,
    // rate 0 ⇒ commission is never paid, so there is no revenue at which the
    // subscription pays for itself. Report 0 rather than Infinity/NaN.
    breakEvenMonthlyRevenue:
      commissionRate > 0 ? round2(wieloMonthly / (commissionRate / 100)) : 0,
  };
}
