// WS-5 — PURE membership price math (no server-only, no I/O) so it's unit-testable
// and reusable in UI. The lock-aware reader: when a subscription carries a
// Founding lock (locked_base_amount set), bill THAT and never the live product
// price (strategy §5a). Per-listing: first listing included in the base; each
// additional listing adds the per-listing amount (monthly figure, ×12 for annual).

export type MembershipPricing = {
  price: number | string;
  annual_price: number | string | null;
  per_listing_amount: number | string | null;
};

export type SubscriptionLock = {
  is_founding?: boolean | null;
  locked_base_amount: number | string | null;
  locked_per_listing_amount: number | string | null;
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The ZAR amount to charge for a membership subscription this cycle.
 *   amount = base + max(0, listingCount − 1) × perListing
 * base/perListing come from the LOCK when present, else the live product price.
 */
export function resolveMembershipAmount(input: {
  cycle: "monthly" | "annual";
  listingCount: number;
  product: MembershipPricing;
  lock?: SubscriptionLock | null;
}): number {
  const { cycle, product } = input;
  const listings = Math.max(0, input.listingCount);
  const lockedBase = input.lock?.locked_base_amount;
  const isLocked = lockedBase != null && Number(lockedBase) > 0;

  let base: number;
  let perListingMonthly: number;
  if (isLocked) {
    base = Number(lockedBase);
    perListingMonthly = Number(input.lock?.locked_per_listing_amount ?? 0);
  } else {
    base =
      cycle === "annual"
        ? Number(product.annual_price ?? product.price)
        : Number(product.price);
    perListingMonthly = Number(product.per_listing_amount ?? 0);
  }

  const perListing =
    cycle === "annual" ? perListingMonthly * 12 : perListingMonthly;
  const extra = Math.max(0, listings - 1) * perListing;
  return round2(base + Math.max(0, extra));
}
