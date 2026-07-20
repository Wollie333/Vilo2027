import { describe, expect, it } from "vitest";

import { resolveMembershipAmount } from "./membershipPricing";

// WS-5 — money math for the Founding price-lock + per-additional-listing.
// The v4 documented config on the one plan (slug=pro):
const PRODUCT = {
  price: 999, // list monthly base
  annual_price: 9990, // list annual base
  per_listing_amount: 299, // list per-additional-listing (monthly figure)
};

// A Founding host's frozen lock (monthly): base 599, per-listing 179.
const FOUNDING_MONTHLY = {
  is_founding: true,
  locked_base_amount: 599,
  locked_per_listing_amount: 179,
};
// Founding annual: base is the annual figure (499×12 = 5988); per-listing stays
// the MONTHLY figure and is annualised by the resolver.
const FOUNDING_ANNUAL = {
  is_founding: true,
  locked_base_amount: 5988,
  locked_per_listing_amount: 179,
};

describe("resolveMembershipAmount — list (unlocked) pricing", () => {
  it("monthly, 1 listing → base only", () => {
    expect(
      resolveMembershipAmount({
        cycle: "monthly",
        listingCount: 1,
        product: PRODUCT,
      }),
    ).toBe(999);
  });

  it("monthly, 0 listings → still just base (first listing included)", () => {
    expect(
      resolveMembershipAmount({
        cycle: "monthly",
        listingCount: 0,
        product: PRODUCT,
      }),
    ).toBe(999);
  });

  it("monthly, 3 listings → base + 2 × per-listing", () => {
    // 999 + 2×299 = 1597
    expect(
      resolveMembershipAmount({
        cycle: "monthly",
        listingCount: 3,
        product: PRODUCT,
      }),
    ).toBe(1597);
  });

  it("annual, 1 listing → annual base", () => {
    expect(
      resolveMembershipAmount({
        cycle: "annual",
        listingCount: 1,
        product: PRODUCT,
      }),
    ).toBe(9990);
  });

  it("annual, 3 listings → annual base + 2 × (per-listing × 12)", () => {
    // 9990 + 2×(299×12) = 9990 + 7176 = 17166
    expect(
      resolveMembershipAmount({
        cycle: "annual",
        listingCount: 3,
        product: PRODUCT,
      }),
    ).toBe(17166);
  });
});

describe("resolveMembershipAmount — Founding lock", () => {
  it("monthly, 1 listing → locked base", () => {
    expect(
      resolveMembershipAmount({
        cycle: "monthly",
        listingCount: 1,
        product: PRODUCT,
        lock: FOUNDING_MONTHLY,
      }),
    ).toBe(599);
  });

  it("monthly, 3 listings → locked base + 2 × locked per-listing", () => {
    // 599 + 2×179 = 957
    expect(
      resolveMembershipAmount({
        cycle: "monthly",
        listingCount: 3,
        product: PRODUCT,
        lock: FOUNDING_MONTHLY,
      }),
    ).toBe(957);
  });

  it("annual, 3 listings → locked annual base + 2 × (locked per-listing × 12)", () => {
    // 5988 + 2×(179×12) = 5988 + 4296 = 10284
    expect(
      resolveMembershipAmount({
        cycle: "annual",
        listingCount: 3,
        product: PRODUCT,
        lock: FOUNDING_ANNUAL,
      }),
    ).toBe(10284);
  });
});

describe("resolveMembershipAmount — the LOCK WINS (the whole point)", () => {
  it("a locked host is unaffected when the product LIST price is raised", () => {
    const raisedProduct = {
      price: 5000, // list price hiked
      annual_price: 50000,
      per_listing_amount: 2000,
    };
    // Founding host still pays their frozen 599 (+179/extra), never the new list.
    expect(
      resolveMembershipAmount({
        cycle: "monthly",
        listingCount: 1,
        product: raisedProduct,
        lock: FOUNDING_MONTHLY,
      }),
    ).toBe(599);
    expect(
      resolveMembershipAmount({
        cycle: "monthly",
        listingCount: 2,
        product: raisedProduct,
        lock: FOUNDING_MONTHLY,
      }),
    ).toBe(778); // 599 + 179, NOT touched by the 5000/2000 list hike
  });

  it("a NON-locked host DOES follow the live list price", () => {
    const raisedProduct = {
      price: 1499,
      annual_price: null,
      per_listing_amount: 399,
    };
    expect(
      resolveMembershipAmount({
        cycle: "monthly",
        listingCount: 2,
        product: raisedProduct,
        lock: null,
      }),
    ).toBe(1898); // 1499 + 399
  });

  it("a zero/absent locked base is treated as UNLOCKED (falls back to list)", () => {
    expect(
      resolveMembershipAmount({
        cycle: "monthly",
        listingCount: 1,
        product: PRODUCT,
        lock: { locked_base_amount: 0, locked_per_listing_amount: 0 },
      }),
    ).toBe(999);
  });
});
