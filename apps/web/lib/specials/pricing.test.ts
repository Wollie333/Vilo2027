import { describe, expect, it } from "vitest";

import type { PricingUnit, StayAddon } from "@/lib/pricing";

import {
  priceSpecialStay,
  priceSpecialWithSavings,
  specialSavings,
  syntheticPerNightRule,
} from "./pricing";

// ─────────────────────────────────────────────────────────────────────────
// Specials pricing — the two invariants that matter most:
//   1. A per-night special priced INSIDE a real seasonal window ignores the
//      seasonal rate entirely (the synthetic absolute rule wins).
//   2. A flat special is occupancy-invariant (one price for any party size).
// Plus the savings-badge maths.
//
// Calendar anchor (UTC): 2026-06-04 is a THURSDAY:
//   06-04 Thu · 06-05 Fri · 06-06 Sat · 06-07 Sun …  (weekend = Fri+Sat)
// ─────────────────────────────────────────────────────────────────────────

function unit(over: Partial<PricingUnit> = {}): PricingUnit {
  return {
    roomId: "r1",
    pricing_mode: "per_room",
    base_price: 1000,
    price_per_person: null,
    base_occupancy: null,
    extra_guest_price: null,
    weekend_price: 1500,
    cleaning_fee: 300,
    guests: 2,
    ...over,
  };
}

describe("priceSpecialStay — per-night", () => {
  it("ignores a real seasonal window: per-night × nights (+ cleaning)", () => {
    // A real R5000/night peak season is in force, but the special is R800/night.
    // The synthetic absolute rule must win for all 3 nights.
    const r = priceSpecialStay({
      priceMode: "per_night",
      flatTotal: null,
      perNightPrice: 800,
      currency: "ZAR",
      checkIn: "2026-06-04",
      checkOut: "2026-06-07", // 3 nights, includes Fri + Sat
      unit: unit({ cleaning_fee: 300 }),
      totalGuests: 2,
    });
    // 3 × 800 = 2400 base + 300 cleaning = 2700. No weekend, no seasonal.
    expect(r.baseSubtotal).toBe(2400);
    expect(r.weekendNights).toBe(0);
    expect(r.seasonalNights).toBe(3); // every night resolves via the synthetic rule
    expect(r.cleaningTotal).toBe(300);
    expect(r.total).toBe(2700);
  });

  it("preserves per_room_plus_extra occupancy on top of the override", () => {
    const r = priceSpecialStay({
      priceMode: "per_night",
      flatTotal: null,
      perNightPrice: 800,
      currency: "ZAR",
      checkIn: "2026-06-04",
      checkOut: "2026-06-06", // 2 nights
      unit: unit({
        pricing_mode: "per_room_plus_extra",
        base_occupancy: 2,
        extra_guest_price: 150,
        cleaning_fee: 0,
        guests: 4, // 2 over base → +150 × 2 per night
      }),
      totalGuests: 4,
    });
    // (800 + 2×150) × 2 nights = 1100 × 2 = 2200.
    expect(r.baseSubtotal).toBe(2200);
    expect(r.total).toBe(2200);
  });

  it("syntheticPerNightRule is an absolute, max-priority, full-span rule", () => {
    const rule = syntheticPerNightRule("2026-06-04", "2026-06-07", 800);
    expect(rule.adjustmentType).toBe("absolute");
    expect(rule.adjustmentValue).toBe(800);
    expect(rule.priority).toBe(Number.MAX_SAFE_INTEGER);
    expect(rule.roomId).toBeNull();
    expect(rule.isActive).toBe(true);
  });
});

describe("priceSpecialStay — flat", () => {
  it("is occupancy-invariant: same total for 2 or 8 guests", () => {
    const make = (guests: number) =>
      priceSpecialStay({
        priceMode: "flat",
        flatTotal: 4500,
        perNightPrice: null,
        currency: "ZAR",
        checkIn: "2026-06-04",
        checkOut: "2026-06-07",
        unit: unit({
          pricing_mode: "per_room_plus_extra",
          base_occupancy: 2,
          extra_guest_price: 999, // would matter if occupancy applied — it must NOT
          cleaning_fee: 300, // ignored for a flat package
          guests,
        }),
        totalGuests: guests,
      });
    const two = make(2);
    const eight = make(8);
    expect(two.total).toBe(4500);
    expect(eight.total).toBe(4500);
    expect(two.cleaningTotal).toBe(0); // flat = all-in, no separate cleaning
    expect(two.seasonalNights).toBe(0);
    expect(two.weekendNights).toBe(0);
  });

  it("adds compulsory add-ons on top of the flat total", () => {
    const addons: StayAddon[] = [
      {
        label: "Breakfast",
        pricingModel: "per_guest_per_night",
        unitPrice: 100,
        quantity: 3, // 3 nights
        addonId: "a1",
      },
    ];
    const r = priceSpecialStay({
      priceMode: "flat",
      flatTotal: 4500,
      perNightPrice: null,
      currency: "ZAR",
      checkIn: "2026-06-04",
      checkOut: "2026-06-07",
      unit: unit(),
      totalGuests: 2,
      addons,
    });
    // 100 × 3 nights × 2 guests = 600 add-on, + 4500 = 5100.
    expect(r.addonsTotal).toBe(600);
    expect(r.total).toBe(5100);
  });
});

describe("specialSavings", () => {
  it("computes amount + pct when there is a genuine saving", () => {
    const s = specialSavings(5000, 4000);
    expect(s.wasPrice).toBe(5000);
    expect(s.savingsAmount).toBe(1000);
    expect(s.savingsPct).toBe(20);
  });

  it("returns nulls when the special is not cheaper", () => {
    expect(specialSavings(4000, 4000)).toEqual({
      wasPrice: null,
      savingsAmount: null,
      savingsPct: null,
    });
    expect(specialSavings(3000, 4000)).toEqual({
      wasPrice: null,
      savingsAmount: null,
      savingsPct: null,
    });
  });

  it("returns nulls for a non-positive shadow price", () => {
    expect(specialSavings(0, 0).wasPrice).toBeNull();
  });
});

describe("priceSpecialWithSavings", () => {
  it("compares a per-night special against the real seasonal shadow", () => {
    // Real peak season R5000/night absolute over the stay → shadow is dear.
    // Special is R800/night → big saving, computed off the real seasonal total.
    const res = priceSpecialWithSavings({
      priceMode: "per_night",
      flatTotal: null,
      perNightPrice: 800,
      currency: "ZAR",
      checkIn: "2026-06-04",
      checkOut: "2026-06-07", // 3 nights
      unit: unit({ cleaning_fee: 0, weekend_price: null }),
      totalGuests: 2,
      seasonalRules: [
        {
          roomId: null,
          startDate: "2026-06-01",
          endDate: "2026-06-30",
          adjustmentType: "absolute",
          adjustmentValue: 5000,
          label: "Peak",
          priority: 10,
          minNights: null,
          isActive: true,
          createdAt: null,
        },
      ],
    });
    // Shadow: 3 × 5000 = 15000. Special: 3 × 800 = 2400. Saving 12600 (84%).
    expect(res.normal.total).toBe(15000);
    expect(res.special.total).toBe(2400);
    expect(res.savings.wasPrice).toBe(15000);
    expect(res.savings.savingsAmount).toBe(12600);
    expect(res.savings.savingsPct).toBe(84);
  });

  it("hides the badge when a flat special is dearer than normal", () => {
    const res = priceSpecialWithSavings({
      priceMode: "flat",
      flatTotal: 6000,
      perNightPrice: null,
      currency: "ZAR",
      checkIn: "2026-06-04",
      checkOut: "2026-06-06", // 2 nights
      unit: unit({ base_price: 1000, weekend_price: null, cleaning_fee: 0 }),
      totalGuests: 2,
      seasonalRules: [],
    });
    // Shadow: 2 × 1000 = 2000. Flat special 6000 > 2000 → no saving.
    expect(res.normal.total).toBe(2000);
    expect(res.savings.savingsAmount).toBeNull();
  });
});
