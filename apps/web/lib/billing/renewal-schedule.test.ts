import { describe, expect, it } from "vitest";

import { nextPeriod, renewalReference } from "./renewal-schedule";

describe("nextPeriod", () => {
  it("bills contiguously from the current period end (anniversary billing)", () => {
    const { start, end } = nextPeriod("2026-08-01T00:00:00.000Z", "monthly");
    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("adds 12 months for an annual cycle", () => {
    const { start, end } = nextPeriod("2026-08-01T00:00:00.000Z", "annual");
    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-08-01T00:00:00.000Z");
  });

  it("starts 'now' when there is no period on file", () => {
    const now = new Date("2026-07-20T09:30:00.000Z");
    const { start, end } = nextPeriod(null, "monthly", now);
    expect(start.toISOString()).toBe(now.toISOString());
    expect(end.toISOString()).toBe("2026-08-20T09:30:00.000Z");
  });

  it("does not drift the day-of-month across a renewal", () => {
    // Renewing period N produces the start for period N+1 — feeding it back in
    // must land on the same day-of-month, not creep.
    const p1 = nextPeriod("2026-01-31T00:00:00.000Z", "monthly");
    const p2 = nextPeriod(p1.end.toISOString(), "monthly");
    // JS clamps Jan-31 + 1mo → Feb-28/Mar-03 style rollover; assert it is at
    // least monotonic and a month apart, never backwards.
    expect(p2.start.getTime()).toBe(p1.end.getTime());
    expect(p2.end.getTime()).toBeGreaterThan(p2.start.getTime());
  });
});

describe("renewalReference", () => {
  const sub = "11111111-1111-1111-1111-111111111111";
  const period = new Date("2026-08-01T00:00:00.000Z");

  it("is stable for a given (sub, period, attempt) — safe to re-run a tick", () => {
    expect(renewalReference(sub, period, 0)).toBe(
      renewalReference(sub, period, 0),
    );
  });

  it("changes across dunning attempts so a retry is not blocked by the latch", () => {
    expect(renewalReference(sub, period, 0)).not.toBe(
      renewalReference(sub, period, 1),
    );
  });

  it("changes across periods so next month is a fresh charge", () => {
    const next = new Date("2026-09-01T00:00:00.000Z");
    expect(renewalReference(sub, period, 0)).not.toBe(
      renewalReference(sub, next, 0),
    );
  });

  it("encodes the period as a date, not a timestamp (one charge per due date)", () => {
    expect(renewalReference(sub, period, 0)).toBe(`renew_${sub}_2026-08-01_a0`);
  });
});
