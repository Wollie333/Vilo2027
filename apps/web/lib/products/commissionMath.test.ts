import { describe, expect, it } from "vitest";

import {
  clampNumber,
  computeCommissionComparison,
  REVENUE_MAX,
} from "./commissionMath";

// WS-8 — the public commission calculator. This is a number a host makes a
// buying decision on and a partner shares in a pitch, so it must never flatter
// Wielo: the subscription is always subtracted, and below break-even the tool
// has to admit commission is cheaper.

// The live products row (WS-5 seed): R999 base, R299 per additional place.
const PRODUCT = { price: 999, annual_price: 9990, per_listing_amount: 299 };
// A Founding host is quoted the same shape at the Founding numbers.
const FOUNDING = { price: 599, annual_price: 5988, per_listing_amount: 179 };

describe("computeCommissionComparison", () => {
  it("computes commission and the annual gap for one place", () => {
    const c = computeCommissionComparison({
      monthlyRevenue: 65_000,
      commissionRate: 17,
      listings: 1,
      product: PRODUCT,
    });
    expect(c.commissionMonthly).toBe(11_050);
    expect(c.commissionAnnual).toBe(132_600);
    expect(c.wieloMonthly).toBe(999);
    expect(c.wieloAnnual).toBe(11_988);
    expect(c.differenceAnnual).toBe(120_612);
    expect(c.betterOnWielo).toBe(true);
  });

  it("charges per ADDITIONAL place only — the first is included", () => {
    const one = computeCommissionComparison({
      monthlyRevenue: 40_000,
      commissionRate: 15,
      listings: 1,
      product: PRODUCT,
    });
    const three = computeCommissionComparison({
      monthlyRevenue: 40_000,
      commissionRate: 15,
      listings: 3,
      product: PRODUCT,
    });
    expect(one.wieloMonthly).toBe(999);
    expect(three.wieloMonthly).toBe(999 + 2 * 299);
  });

  it("uses whatever price it is given — Founding numbers included", () => {
    const c = computeCommissionComparison({
      monthlyRevenue: 30_000,
      commissionRate: 15,
      listings: 2,
      product: FOUNDING,
    });
    expect(c.wieloMonthly).toBe(599 + 179);
  });

  it("ADMITS when the subscription costs more than commission", () => {
    const c = computeCommissionComparison({
      monthlyRevenue: 5_000,
      commissionRate: 15,
      listings: 1,
      product: PRODUCT,
    });
    expect(c.commissionMonthly).toBe(750);
    expect(c.betterOnWielo).toBe(false);
    expect(c.differenceAnnual).toBeLessThan(0);
  });

  it("reports the break-even revenue where the two are equal", () => {
    const c = computeCommissionComparison({
      monthlyRevenue: 20_000,
      commissionRate: 15,
      listings: 1,
      product: PRODUCT,
    });
    expect(c.breakEvenMonthlyRevenue).toBe(6_660);
    // Sanity: at exactly break-even the yearly figures match.
    const atBreakEven = computeCommissionComparison({
      monthlyRevenue: c.breakEvenMonthlyRevenue,
      commissionRate: 15,
      listings: 1,
      product: PRODUCT,
    });
    expect(atBreakEven.commissionAnnual).toBeCloseTo(
      atBreakEven.wieloAnnual,
      6,
    );
    expect(atBreakEven.betterOnWielo).toBe(false);
  });

  it("never divides by zero when no commission is charged", () => {
    const c = computeCommissionComparison({
      monthlyRevenue: 50_000,
      commissionRate: 0,
      listings: 1,
      product: PRODUCT,
    });
    expect(c.commissionAnnual).toBe(0);
    expect(c.breakEvenMonthlyRevenue).toBe(0);
    expect(Number.isFinite(c.differenceAnnual)).toBe(true);
  });

  it("degrades safely when the product has no price on file", () => {
    const c = computeCommissionComparison({
      monthlyRevenue: 50_000,
      commissionRate: 15,
      listings: 4,
      product: { price: 0, annual_price: null, per_listing_amount: null },
    });
    expect(c.wieloMonthly).toBe(0);
    expect(c.commissionAnnual).toBe(90_000);
  });

  it("clamps hostile or nonsense inputs instead of rendering NaN", () => {
    const c = computeCommissionComparison({
      monthlyRevenue: 9_999_999,
      commissionRate: 900,
      listings: -3,
      product: PRODUCT,
    });
    expect(c.monthlyRevenue).toBe(REVENUE_MAX);
    expect(c.commissionRate).toBe(25);
    expect(c.listings).toBe(1);

    const junk = computeCommissionComparison({
      monthlyRevenue: Number.NaN,
      commissionRate: Number.NaN,
      listings: Number.NaN,
      product: PRODUCT,
    });
    expect(Number.isNaN(junk.commissionMonthly)).toBe(false);
    expect(Number.isNaN(junk.wieloMonthly)).toBe(false);
  });
});

describe("clampNumber", () => {
  it("clamps a real number into the range", () => {
    expect(clampNumber(50, 0, 10)).toBe(10);
    expect(clampNumber(-5, 0, 10)).toBe(0);
    expect(clampNumber(5, 0, 10)).toBe(5);
  });

  it("falls back to the MINIMUM for junk — never the flattering maximum", () => {
    // A URL like ?revenue=Infinity must not render the biggest possible saving.
    expect(clampNumber(Number.NaN, 3, 10)).toBe(3);
    expect(clampNumber(Number.POSITIVE_INFINITY, 3, 10)).toBe(3);
  });
});
