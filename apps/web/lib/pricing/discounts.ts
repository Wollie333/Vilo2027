// Pure discount maths shared by the booking sidebar (estimate) and the server
// booking action (source of truth) so the two can never drift. Non-client module
// → safe to import from both "use client" and server code.
//
// Moved here from app/listing/[slug]/pricing.ts; that path now re-exports these.

export type StayDiscountInput = {
  /** Room/whole base subtotal, already multiplied by nights (excl. cleaning). */
  base: number;
  cleaning: number;
  nights: number;
  /** True when the stay covers the whole place (all active rooms together). */
  isWholeCombo: boolean;
  /** % off the base when isWholeCombo (null/0 = none). */
  wholePct: number | null;
  /** % off for 7+ night stays (null/0 = none). */
  weeklyPct: number | null;
  /** % off for 28+ night stays — supersedes weekly when both qualify. */
  monthlyPct: number | null;
};

export type StayDiscount = {
  wholeSaving: number;
  losSaving: number;
  losKind: "weekly" | "monthly" | null;
  losPct: number;
  discountTotal: number;
  /** base − wholeSaving − losSaving + cleaning. */
  total: number;
};

const pct = (v: number | null | undefined): number =>
  v == null || !Number.isFinite(v) || v <= 0 ? 0 : v;

/**
 * Whole-place discount applies first (to the base), then the length-of-stay
 * discount applies to what remains. Cleaning is never discounted.
 */
export function applyStayDiscounts(i: StayDiscountInput): StayDiscount {
  const base = Math.max(0, i.base);
  const cleaning = Math.max(0, i.cleaning);

  const wholePct = i.isWholeCombo ? pct(i.wholePct) : 0;
  const wholeSaving = (base * wholePct) / 100;
  const afterWhole = base - wholeSaving;

  let losKind: StayDiscount["losKind"] = null;
  let losPct = 0;
  if (i.nights >= 28 && pct(i.monthlyPct) > 0) {
    losKind = "monthly";
    losPct = pct(i.monthlyPct);
  } else if (i.nights >= 7 && pct(i.weeklyPct) > 0) {
    losKind = "weekly";
    losPct = pct(i.weeklyPct);
  }
  const losSaving = (afterWhole * losPct) / 100;

  const discountTotal = wholeSaving + losSaving;
  return {
    wholeSaving,
    losSaving,
    losKind,
    losPct,
    discountTotal,
    total: afterWhole - losSaving + cleaning,
  };
}
