import { describe, expect, it } from "vitest";

import {
  daysRemaining,
  membershipSwitchAmount,
  proratedAmount,
  round2,
  unusedFraction,
} from "./proration";

// A clean 10-day period so fractions are exact.
const START = "2026-07-10T00:00:00.000Z";
const END = "2026-07-20T00:00:00.000Z";
const MID = new Date("2026-07-15T00:00:00.000Z"); // exactly half unused

describe("unusedFraction", () => {
  it("is 0 when there is no period on file (free / never-billed)", () => {
    expect(unusedFraction(null, null, MID)).toBe(0);
    expect(unusedFraction(START, null, MID)).toBe(0);
  });

  it("is 1 before/at the period start and 0 after the end", () => {
    expect(unusedFraction(START, END, new Date(START))).toBe(1);
    expect(unusedFraction(START, END, new Date("2026-07-05T00:00:00Z"))).toBe(
      1,
    );
    expect(unusedFraction(START, END, new Date(END))).toBe(0);
    expect(unusedFraction(START, END, new Date("2026-07-25T00:00:00Z"))).toBe(
      0,
    );
  });

  it("is the linear remaining fraction mid-period", () => {
    expect(unusedFraction(START, END, MID)).toBeCloseTo(0.5, 10);
  });

  it("is 0 for an inverted/zero-length period", () => {
    expect(unusedFraction(END, START, MID)).toBe(0);
  });
});

describe("membershipSwitchAmount", () => {
  it("charges only the prorated delta on a mid-cycle upgrade", () => {
    // (300 - 100) * 0.5 = 100
    expect(membershipSwitchAmount(300, 100, START, END, MID)).toBe(100);
  });

  it("never charges below zero (a 'downgrade' delta clamps to 0)", () => {
    expect(membershipSwitchAmount(100, 300, START, END, MID)).toBe(0);
  });

  it("charges the FULL new price when there is no unused period to credit", () => {
    // free grant (no period end) → nothing to offset → full price.
    expect(membershipSwitchAmount(300, 100, null, null, MID)).toBe(300);
    // period already consumed → full price + fresh cycle.
    expect(membershipSwitchAmount(300, 100, START, END, new Date(END))).toBe(
      300,
    );
  });

  it("rounds to cents", () => {
    // (100 - 0) * 0.5 with an odd split still lands on 2dp.
    expect(membershipSwitchAmount(99.99, 0, START, END, MID)).toBe(
      round2(99.99 * 0.5),
    );
  });
});

describe("proratedAmount", () => {
  it("credits the unused portion of a price, never negative", () => {
    expect(proratedAmount(200, START, END, MID)).toBe(100);
    expect(proratedAmount(-50, START, END, MID)).toBe(0);
  });
});

describe("daysRemaining", () => {
  it("counts whole days left, clamped at 0", () => {
    expect(daysRemaining(END, MID)).toBe(5);
    expect(daysRemaining(END, new Date(END))).toBe(0);
    expect(daysRemaining(null, MID)).toBe(0);
  });
});
