import { describe, expect, it } from "vitest";

import { computeFoundingTrialEnd, isCampaignWindowOpen } from "./trialRule";

// The Founding Programme trial rule (doc §5.2–5.3): free access ends on a fixed
// cohort date (31 Dec 2026) regardless of join date, with a rolling 30-day floor
// for December-onward joiners. These pin the exact table in the doc.

const CFG = { cohort_end: "2026-12-31", floor_days: 30 };
// End of 31 Dec 2026 in SA time (UTC+2) = 21:59:59Z.
const COHORT_END_ISO = "2026-12-31T21:59:59.000Z";

const at = (iso: string) => Date.parse(iso);

describe("computeFoundingTrialEnd", () => {
  it("October joiner → fixed cohort end (≈3 months)", () => {
    expect(computeFoundingTrialEnd(at("2026-10-01T09:00:00Z"), CFG)).toBe(
      COHORT_END_ISO,
    );
  });

  it("November joiner → same fixed cohort end (≈2 months)", () => {
    expect(computeFoundingTrialEnd(at("2026-11-15T09:00:00Z"), CFG)).toBe(
      COHORT_END_ISO,
    );
  });

  it("1 Dec joiner → cohort floor (activation+30d == 31 Dec)", () => {
    // 1 Dec + 30d = 31 Dec, equal to the cohort date → still the cohort end.
    expect(computeFoundingTrialEnd(at("2026-12-01T21:59:59Z"), CFG)).toBe(
      COHORT_END_ISO,
    );
  });

  it("15 Dec joiner → rolling 30-day floor beyond the cohort date", () => {
    const out = computeFoundingTrialEnd(at("2026-12-15T10:00:00Z"), CFG);
    expect(out).toBe(
      new Date(at("2026-12-15T10:00:00Z") + 30 * 86_400_000).toISOString(),
    );
    expect(at(out!)).toBeGreaterThan(at(COHORT_END_ISO));
  });

  it("January joiner → pure rolling 30-day floor", () => {
    const join = at("2027-01-20T08:00:00Z");
    expect(computeFoundingTrialEnd(join, CFG)).toBe(
      new Date(join + 30 * 86_400_000).toISOString(),
    );
  });

  it("only a floor configured → activation + floor", () => {
    const join = at("2027-03-01T00:00:00Z");
    expect(
      computeFoundingTrialEnd(join, { cohort_end: null, floor_days: 14 }),
    ).toBe(new Date(join + 14 * 86_400_000).toISOString());
  });

  it("only a cohort date configured → that date", () => {
    expect(
      computeFoundingTrialEnd(at("2026-10-01T00:00:00Z"), {
        cohort_end: "2026-12-31",
        floor_days: null,
      }),
    ).toBe(COHORT_END_ISO);
  });

  it("nothing configured → null (no trial)", () => {
    expect(
      computeFoundingTrialEnd(Date.now(), {
        cohort_end: null,
        floor_days: null,
      }),
    ).toBeNull();
  });
});

describe("isCampaignWindowOpen", () => {
  const now = at("2026-11-01T00:00:00Z");
  it("active + within window → open", () => {
    expect(
      isCampaignWindowOpen(
        "active",
        "2026-09-30T22:00:00Z",
        "2027-02-28T21:59:00Z",
        now,
      ),
    ).toBe(true);
  });
  it("not active → closed", () => {
    expect(isCampaignWindowOpen("draft", null, null, now)).toBe(false);
  });
  it("before start → closed", () => {
    expect(
      isCampaignWindowOpen("active", "2026-12-01T00:00:00Z", null, now),
    ).toBe(false);
  });
  it("after end → closed", () => {
    expect(
      isCampaignWindowOpen("active", null, "2026-10-01T00:00:00Z", now),
    ).toBe(false);
  });
});
