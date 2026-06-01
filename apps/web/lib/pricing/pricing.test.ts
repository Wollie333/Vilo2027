import { describe, expect, it } from "vitest";

import {
  priceStay,
  resolveNightlyRate,
  type PricingUnit,
  type PriceStayInput,
  type SeasonalRule,
} from "./engine";

// ─────────────────────────────────────────────────────────────────────────
// Use-case journeys — each test is a host/guest story with an exact, hand-
// computed total. If the engine ever drifts, a journey breaks. These double as
// the worked examples for the "How seasonal pricing works" help page.
//
// Calendar anchor (all UTC): 2026-06-04 is a THURSDAY, so within this file
//   06-04 Thu · 06-05 Fri · 06-06 Sat · 06-07 Sun · 06-08 Mon …
// Weekend nights are Friday + Saturday (the Vilo definition).
// ─────────────────────────────────────────────────────────────────────────

function unit(over: Partial<PricingUnit> = {}): PricingUnit {
  return {
    roomId: "r1",
    pricing_mode: "per_room",
    base_price: 1000,
    price_per_person: null,
    base_occupancy: null,
    extra_guest_price: null,
    weekend_price: null,
    cleaning_fee: 0,
    guests: 2,
    ...over,
  };
}

function rule(over: Partial<SeasonalRule> = {}): SeasonalRule {
  return {
    roomId: null,
    startDate: "2026-06-04",
    endDate: "2026-06-30",
    adjustmentType: "absolute",
    adjustmentValue: 2000,
    label: "Season",
    priority: 0,
    minNights: null,
    isActive: true,
    createdAt: null,
    ...over,
  };
}

function base(over: Partial<PriceStayInput> = {}): PriceStayInput {
  return {
    checkIn: "2026-06-04",
    checkOut: "2026-06-07",
    units: [unit()],
    seasonalRules: [],
    currency: "ZAR",
    totalGuests: 2,
    listingMinNights: 1,
    isWholeCombo: false,
    wholePct: null,
    weeklyPct: null,
    monthlyPct: null,
    addons: [],
    ...over,
  };
}

describe("priceStay — use-case journeys", () => {
  it("J1: whole-listing weekend stay — weekend rate hits Fri+Sat only, base on Thu", () => {
    // Host: R1000 base, R1500 weekend, R500 cleaning. Guest books Thu→Sun (3 nights).
    const r = priceStay(
      base({
        units: [
          unit({
            roomId: null,
            base_price: 1000,
            weekend_price: 1500,
            cleaning_fee: 500,
          }),
        ],
      }),
    );
    expect(r.nights).toBe(3);
    expect(r.weekendNights).toBe(2); // Fri + Sat
    expect(r.seasonalNights).toBe(0);
    expect(r.units[0].nights.map((n) => n.source)).toEqual([
      "base",
      "weekend",
      "weekend",
    ]);
    expect(r.baseSubtotal).toBe(1000 + 1500 + 1500); // 4000
    expect(r.total).toBe(4500); // + R500 cleaning
  });

  it("J2: festive peak (absolute) — every night is the peak rate, not base", () => {
    // The bug this whole change fixes: host sets a festive rate, guest pays it.
    const r = priceStay(
      base({
        units: [unit({ roomId: null, base_price: 1000, weekend_price: 1500 })],
        seasonalRules: [
          rule({
            adjustmentType: "absolute",
            adjustmentValue: 5000,
            label: "Festive season",
          }),
        ],
      }),
    );
    expect(r.seasonalNights).toBe(3);
    expect(r.weekendNights).toBe(0); // seasonal replaces the weekend rate
    expect(r.units[0].nights.every((n) => n.label === "Festive season")).toBe(
      true,
    );
    expect(r.baseSubtotal).toBe(15000);
    expect(r.total).toBe(15000);
  });

  it("J3: festive peak (percentage) — each room scales off its own base", () => {
    const r = priceStay(
      base({
        units: [
          unit({ roomId: "r1", base_price: 1000 }),
          unit({ roomId: "r2", base_price: 2000 }),
        ],
        seasonalRules: [
          rule({
            adjustmentType: "percent",
            adjustmentValue: 50,
            label: "Festive season",
          }),
        ],
        totalGuests: 4,
      }),
    );
    // r1: 1000×1.5×3 = 4500 ; r2: 2000×1.5×3 = 9000
    expect(r.units[0].baseSubtotal).toBe(4500);
    expect(r.units[1].baseSubtotal).toBe(9000);
    expect(r.baseSubtotal).toBe(13500);
    expect(r.seasonalNights).toBe(6); // 3 nights × 2 rooms
    expect(r.units[0].nights[0].label).toBe("Festive season");
  });

  it("J4: partial-overlap season — only the covered nights move", () => {
    // Mon→Sat (5 nights), no weekend price; a 2-night peak inside the stay.
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-13",
        units: [unit({ roomId: null, base_price: 1000 })],
        seasonalRules: [
          rule({
            startDate: "2026-06-08",
            endDate: "2026-06-09",
            adjustmentType: "absolute",
            adjustmentValue: 2000,
            label: "Mini peak",
          }),
        ],
      }),
    );
    expect(r.nights).toBe(5);
    expect(r.seasonalNights).toBe(2);
    expect(r.baseSubtotal).toBe(2 * 2000 + 3 * 1000); // 7000
    expect(r.units[0].nights.map((n) => n.source)).toEqual([
      "seasonal",
      "seasonal",
      "base",
      "base",
      "base",
    ]);
  });

  it("J5: precedence — room+high-priority rule beats listing rule; 1-day override", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-11", // Mon, Tue, Wed
        units: [unit({ roomId: "r1", base_price: 1000 })],
        seasonalRules: [
          rule({
            roomId: null,
            startDate: "2026-06-08",
            endDate: "2026-06-10",
            adjustmentType: "absolute",
            adjustmentValue: 1500,
            priority: 1,
            label: "Long season",
          }),
          rule({
            roomId: "r1",
            startDate: "2026-06-09",
            endDate: "2026-06-09", // single-date override
            adjustmentType: "absolute",
            adjustmentValue: 3000,
            priority: 10,
            label: "NYE",
          }),
        ],
      }),
    );
    expect(r.units[0].nights.map((n) => n.rate)).toEqual([1500, 3000, 1500]);
    expect(r.units[0].nights[1].label).toBe("NYE");
    expect(r.baseSubtotal).toBe(6000);
  });

  it("J6: per-person + extra-guest rooms, 8 nights, % season + weekly discount", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-16", // 8 nights
        units: [
          unit({
            roomId: "r1",
            pricing_mode: "per_person",
            base_price: 0,
            price_per_person: 300,
            guests: 3, // 900/night base
          }),
          unit({
            roomId: "r2",
            pricing_mode: "per_room_plus_extra",
            base_price: 1000,
            base_occupancy: 2,
            extra_guest_price: 200,
            guests: 4, // 1000 + 2×200 = 1400/night base
          }),
        ],
        seasonalRules: [
          rule({
            adjustmentType: "percent",
            adjustmentValue: 50,
            label: "Peak",
          }),
        ],
        totalGuests: 7,
        weeklyPct: 10,
      }),
    );
    // r1: 900×1.5×8 = 10800 ; r2: 1400×1.5×8 = 16800
    expect(r.baseSubtotal).toBe(27600);
    expect(r.discount.losKind).toBe("weekly");
    expect(r.discount.losSaving).toBe(2760); // 10% of 27600
    expect(r.discount.discountTotal).toBe(2760);
    expect(r.total).toBe(24840);
  });

  it("J7: whole-place combo THEN monthly discount, on the seasonally-raised base", () => {
    // 30 nights, first 10 at a R2000 peak; whole-combo 10% then monthly 20%.
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-07-08", // 30 nights
        units: [unit({ roomId: null, base_price: 1000 })],
        seasonalRules: [
          rule({
            startDate: "2026-06-08",
            endDate: "2026-06-17", // first 10 nights
            adjustmentType: "absolute",
            adjustmentValue: 2000,
            label: "Peak",
          }),
        ],
        isWholeCombo: true,
        wholePct: 10,
        monthlyPct: 20,
      }),
    );
    expect(r.baseSubtotal).toBe(10 * 2000 + 20 * 1000); // 40000
    expect(r.discount.wholeSaving).toBe(4000); // 10% of 40000
    expect(r.discount.losKind).toBe("monthly");
    expect(r.discount.losSaving).toBe(7200); // 20% of (40000-4000)
    expect(r.discount.discountTotal).toBe(11200);
    expect(r.total).toBe(28800);
  });

  it("J8: add-ons of every pricing model sit on top, never discounted", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-10", // 2 nights, no weekend
        units: [unit({ roomId: null, base_price: 1000 })],
        totalGuests: 3,
        addons: [
          {
            label: "Welcome basket",
            pricingModel: "per_stay",
            unitPrice: 500,
            quantity: 1,
          },
          {
            label: "Breakfast",
            pricingModel: "per_night",
            unitPrice: 100,
            quantity: 2,
          },
          {
            label: "Spa entry",
            pricingModel: "per_guest",
            unitPrice: 50,
            quantity: 1,
          },
          {
            label: "Dinner",
            pricingModel: "per_guest_per_night",
            unitPrice: 20,
            quantity: 2,
          },
          {
            label: "Couples massage",
            pricingModel: "per_couple",
            unitPrice: 80,
            quantity: 1,
          },
        ],
      }),
    );
    expect(r.baseSubtotal).toBe(2000);
    // 500 + (100×2) + (50×3) + (20×2×3) + (80×ceil(3/2)=2) = 500+200+150+120+160
    expect(r.addonsTotal).toBe(1130);
    expect(r.total).toBe(3130);
  });

  it("J9: seasonal min-nights raises the effective minimum", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-04",
        checkOut: "2026-06-07", // 3 nights
        seasonalRules: [rule({ minNights: 5, label: "Festive" })],
        listingMinNights: 1,
      }),
    );
    expect(r.nights).toBe(3);
    expect(r.effectiveMinNights).toBe(5); // booking action rejects 3 < 5
  });

  it("J11: order coupon (percent) discounts accommodation + add-ons, not cleaning", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-10", // 2 nights base
        units: [unit({ roomId: null, base_price: 1000, cleaning_fee: 300 })],
        totalGuests: 2,
        addons: [
          {
            label: "Breakfast",
            pricingModel: "per_night",
            unitPrice: 100,
            quantity: 2,
          },
        ],
        coupon: {
          code: "SAVE10",
          discountType: "percent",
          discountValue: 10,
          scope: "order",
        },
      }),
    );
    // base 2000 + addons 200 = 2200 eligible; 10% = 220. cleaning 300 untouched.
    expect(r.couponDiscount).toBe(220);
    expect(r.couponCode).toBe("SAVE10");
    expect(r.total).toBe(2000 + 200 + 300 - 220); // 2280
  });

  it("J12: accommodation-only coupon leaves add-ons alone", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-10",
        units: [unit({ roomId: null, base_price: 1000 })],
        addons: [
          {
            label: "Spa",
            pricingModel: "per_stay",
            unitPrice: 500,
            quantity: 1,
          },
        ],
        coupon: {
          code: "ROOMS20",
          discountType: "percent",
          discountValue: 20,
          scope: "accommodation",
        },
      }),
    );
    // base 2000 × 20% = 400 ; add-ons 500 untouched.
    expect(r.couponDiscount).toBe(400);
    expect(r.total).toBe(2000 + 500 - 400); // 2100
  });

  it("J13: add-ons-only coupon discounts only the extras", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-10",
        units: [unit({ roomId: null, base_price: 1000 })],
        addons: [
          {
            label: "Dinner",
            pricingModel: "per_stay",
            unitPrice: 800,
            quantity: 1,
          },
        ],
        coupon: {
          code: "EXTRAS25",
          discountType: "percent",
          discountValue: 25,
          scope: "addons",
        },
      }),
    );
    expect(r.couponDiscount).toBe(200); // 25% of 800
    expect(r.total).toBe(2000 + 800 - 200);
  });

  it("J14: fixed coupon is capped at the eligible amount", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-09", // 1 night → base 1000
        units: [unit({ roomId: null, base_price: 1000 })],
        coupon: {
          code: "MINUS5000",
          discountType: "fixed",
          discountValue: 5000,
          scope: "accommodation",
        },
      }),
    );
    expect(r.couponDiscount).toBe(1000); // capped at the 1000 base
    expect(r.total).toBe(0);
  });

  it("J15: room-targeted coupon only discounts that room", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-09", // 1 night
        units: [
          unit({ roomId: "r1", base_price: 1000 }),
          unit({ roomId: "r2", base_price: 2000 }),
        ],
        coupon: {
          code: "R2ONLY",
          discountType: "percent",
          discountValue: 50,
          scope: "accommodation",
          roomId: "r2",
        },
      }),
    );
    // only r2 (2000) is eligible → 50% = 1000.
    expect(r.couponDiscount).toBe(1000);
    expect(r.total).toBe(3000 - 1000);
  });

  it("J16: add-on-targeted coupon only discounts that add-on", () => {
    const r = priceStay(
      base({
        checkIn: "2026-06-08",
        checkOut: "2026-06-10",
        units: [unit({ roomId: null, base_price: 1000 })],
        addons: [
          {
            label: "Breakfast",
            pricingModel: "per_stay",
            unitPrice: 400,
            quantity: 1,
            addonId: "a-breakfast",
          },
          {
            label: "Spa",
            pricingModel: "per_stay",
            unitPrice: 600,
            quantity: 1,
            addonId: "a-spa",
          },
        ],
        coupon: {
          code: "SPA25",
          discountType: "percent",
          discountValue: 25,
          scope: "addons",
          addonId: "a-spa",
        },
      }),
    );
    // only Spa (600) is eligible → 25% = 150; breakfast untouched.
    expect(r.couponDiscount).toBe(150);
    expect(r.total).toBe(2000 + 400 + 600 - 150);
  });

  it("J10: a percentage that would go negative is clamped at zero", () => {
    const r = priceStay(
      base({
        units: [unit({ roomId: null, base_price: 1000 })],
        seasonalRules: [
          rule({ adjustmentType: "percent", adjustmentValue: -150 }),
        ],
      }),
    );
    expect(r.baseSubtotal).toBe(0);
    expect(r.units[0].nights.every((n) => n.rate === 0)).toBe(true);
  });
});

describe("priceStay — grand combination journeys (everything at once)", () => {
  it("G1: 2-room guesthouse · % season · combo + weekly discount · add-ons · order coupon", () => {
    // HOST sets up a 2-room guesthouse, a +25% festive season covering the
    // whole stay, a 10% whole-place combo + 10% weekly discount, two add-ons,
    // and a SAVE10 order coupon. GUEST books both rooms, 8 nights, 6 guests.
    const r = priceStay({
      checkIn: "2026-06-08",
      checkOut: "2026-06-16", // 8 nights
      currency: "ZAR",
      totalGuests: 6,
      listingMinNights: 1,
      units: [
        unit({
          roomId: "A",
          pricing_mode: "per_room",
          base_price: 1000,
          cleaning_fee: 200,
          guests: 2,
        }),
        unit({
          roomId: "B",
          pricing_mode: "per_room_plus_extra",
          base_price: 1500,
          base_occupancy: 2,
          extra_guest_price: 250,
          cleaning_fee: 300,
          guests: 4, // 1500 + 2×250 = 2000/night base
        }),
      ],
      seasonalRules: [
        rule({
          startDate: "2026-06-08",
          endDate: "2026-06-15",
          adjustmentType: "percent",
          adjustmentValue: 25,
          label: "Festive",
        }),
      ],
      isWholeCombo: true,
      wholePct: 10,
      weeklyPct: 10,
      monthlyPct: null,
      addons: [
        {
          label: "Breakfast",
          pricingModel: "per_guest_per_night",
          unitPrice: 50,
          quantity: 8, // nights
          addonId: "x-bfast",
        },
        {
          label: "Welcome basket",
          pricingModel: "per_stay",
          unitPrice: 500,
          quantity: 1,
          addonId: "x-welcome",
        },
      ],
      coupon: {
        code: "SAVE10",
        discountType: "percent",
        discountValue: 10,
        scope: "order",
      },
    });

    // Nightly: A 1000×1.25=1250 ×8 = 10000 ; B 2000×1.25=2500 ×8 = 20000.
    expect(r.baseSubtotal).toBe(30000);
    expect(r.cleaningTotal).toBe(500);
    // Discounts: whole 10% (3000) then weekly 10% of 27000 (2700).
    expect(r.discount.wholeSaving).toBe(3000);
    expect(r.discount.losKind).toBe("weekly");
    expect(r.discount.losSaving).toBe(2700);
    expect(r.discount.discountTotal).toBe(5700);
    // Add-ons: 50×8×6 = 2400 + 500 = 2900 (never discounted by stay discounts).
    expect(r.addonsTotal).toBe(2900);
    // Coupon: 10% of (accommodation-after-discount 24300 + add-ons 2900 = 27200).
    expect(r.couponDiscount).toBe(2720);
    // Total: 24300 + 500 + 2900 − 2720.
    expect(r.total).toBe(24980);
    expect(r.seasonalNights).toBe(16); // 8 nights × 2 rooms
  });

  it("G2: per-person + per-room rooms · weekend nights · room-targeted fixed coupon", () => {
    // GUEST books a per-person room and a per-room room, Thu→Sun (3 nights, incl.
    // Fri+Sat weekend), with a R500 coupon targeted at room B only.
    const r = priceStay({
      checkIn: "2026-06-04", // Thu
      checkOut: "2026-06-07", // 3 nights: Thu, Fri, Sat
      currency: "ZAR",
      totalGuests: 5,
      listingMinNights: 1,
      units: [
        unit({
          roomId: "A",
          pricing_mode: "per_person",
          base_price: 0,
          price_per_person: 400,
          weekend_price: 9999, // ignored: per_person doesn't use weekend
          cleaning_fee: 0,
          guests: 3, // 1200/night flat
        }),
        unit({
          roomId: "B",
          pricing_mode: "per_room",
          base_price: 800,
          weekend_price: 1200,
          cleaning_fee: 150,
          guests: 2,
        }),
      ],
      seasonalRules: [],
      isWholeCombo: false,
      wholePct: null,
      weeklyPct: null,
      monthlyPct: null,
      coupon: {
        code: "ROOMB500",
        discountType: "fixed",
        discountValue: 500,
        scope: "accommodation",
        roomId: "B",
      },
    });

    // A: per_person 400×3 = 3600/over 3 nights, weekend ignored.
    expect(r.units[0].baseSubtotal).toBe(3600);
    // B: Thu 800 + Fri 1200 + Sat 1200 = 3200 (weekend on Fri+Sat).
    expect(r.units[1].baseSubtotal).toBe(3200);
    expect(r.weekendNights).toBe(2);
    expect(r.baseSubtotal).toBe(6800);
    // Coupon targets room B only → R500 off (eligible 3200).
    expect(r.couponDiscount).toBe(500);
    // Total: 6800 + 150 cleaning − 500.
    expect(r.total).toBe(6450);
  });
});

describe("resolveNightlyRate — precedence rules", () => {
  const u = unit({ roomId: "r1", base_price: 1000, weekend_price: 1500 });

  it("a seasonal rule overrides the weekend rate on a weekend night", () => {
    const fri = resolveNightlyRate("2026-06-05", u, [
      rule({
        adjustmentType: "absolute",
        adjustmentValue: 9000,
        label: "Peak",
      }),
    ]);
    expect(fri.source).toBe("seasonal");
    expect(fri.rate).toBe(9000);
  });

  it("weekend rate applies on Fri/Sat when no seasonal rule covers the night", () => {
    expect(resolveNightlyRate("2026-06-05", u, []).source).toBe("weekend"); // Fri
    expect(resolveNightlyRate("2026-06-06", u, []).source).toBe("weekend"); // Sat
    expect(resolveNightlyRate("2026-06-04", u, []).source).toBe("base"); // Thu
  });

  it("room-scoped rule beats a listing-wide rule on the same night", () => {
    const line = resolveNightlyRate("2026-06-10", u, [
      rule({
        roomId: null,
        adjustmentValue: 1500,
        priority: 99,
        label: "Listing",
      }),
      rule({ roomId: "r1", adjustmentValue: 3000, priority: 0, label: "Room" }),
    ]);
    expect(line.label).toBe("Room");
    expect(line.rate).toBe(3000);
  });

  it("higher priority wins among same-scope rules; newest breaks a tie", () => {
    const byPriority = resolveNightlyRate("2026-06-10", u, [
      rule({ adjustmentValue: 1000, priority: 1, label: "Low" }),
      rule({ adjustmentValue: 2000, priority: 5, label: "High" }),
    ]);
    expect(byPriority.label).toBe("High");

    const byRecency = resolveNightlyRate("2026-06-10", u, [
      rule({
        adjustmentValue: 1000,
        priority: 5,
        label: "Older",
        createdAt: "2026-01-01T00:00:00Z",
      }),
      rule({
        adjustmentValue: 2000,
        priority: 5,
        label: "Newer",
        createdAt: "2026-05-01T00:00:00Z",
      }),
    ]);
    expect(byRecency.label).toBe("Newer");
  });
});
