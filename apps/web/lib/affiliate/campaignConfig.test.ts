import { describe, expect, it } from "vitest";

import { ladderRateForBook } from "./campaigns";
import {
  campaignInputSchema,
  commissionStructureSchema,
  describeLadder,
  pctToRate,
  rateToPct,
  sortBandsForDisplay,
} from "./campaignConfig";

// WS-1i — the campaign builder writes config the ACCRUAL RESOLVER reads, so a
// malformed ladder silently mis-pays partners. These pin the shapes the schema
// must refuse to save.

const FOUNDING_LADDER = {
  model: "ladder" as const,
  scope: "subscription",
  duration: "lifetime" as const,
  bands: [
    { max: 10_000, rate: 0.1 },
    { max: 25_000, rate: 0.15 },
    { max: 50_000, rate: 0.2 },
    { max: null, rate: 0.25 },
  ],
  conversion_bonus: { monthly: 250, annual: 400 },
};

const BASE_CAMPAIGN = {
  name: "Founding Race",
  slug: "founding-race",
  status: "draft" as const,
  starts_at: null,
  ends_at: null,
  eligible_partners: "all" as const,
  eligible_referrals: "activated_in_window" as const,
  rules_doc_slug: "founding-race-rules",
  commission_structure: FOUNDING_LADDER,
  competition: { leaderboard_visibility: "public" as const, prizes: [] },
};

describe("commissionStructureSchema", () => {
  it("accepts the live Founding Race ladder", () => {
    expect(commissionStructureSchema.safeParse(FOUNDING_LADDER).success).toBe(
      true,
    );
  });

  it("REFUSES a ladder with no open-ended top band", () => {
    const res = commissionStructureSchema.safeParse({
      ...FOUNDING_LADDER,
      bands: [
        { max: 10_000, rate: 0.1 },
        { max: 25_000, rate: 0.15 },
      ],
    });
    expect(res.success).toBe(false);
    // Without a top band, a partner above the highest ceiling resolves to the
    // last rung by luck of ordering — exactly the silent mis-pay to prevent.
    expect(JSON.stringify(res)).toContain("one top band");
  });

  it("REFUSES two open-ended bands", () => {
    const res = commissionStructureSchema.safeParse({
      ...FOUNDING_LADDER,
      bands: [
        { max: null, rate: 0.1 },
        { max: null, rate: 0.25 },
      ],
    });
    expect(res.success).toBe(false);
  });

  it("REFUSES duplicate ceilings", () => {
    const res = commissionStructureSchema.safeParse({
      ...FOUNDING_LADDER,
      bands: [
        { max: 10_000, rate: 0.1 },
        { max: 10_000, rate: 0.2 },
        { max: null, rate: 0.25 },
      ],
    });
    expect(res.success).toBe(false);
  });

  it("REFUSES a rate above 100% or below zero", () => {
    expect(
      commissionStructureSchema.safeParse({
        ...FOUNDING_LADDER,
        bands: [{ max: null, rate: 1.5 }],
      }).success,
    ).toBe(false);
    expect(
      commissionStructureSchema.safeParse({
        ...FOUNDING_LADDER,
        bands: [{ max: null, rate: -0.1 }],
      }).success,
    ).toBe(false);
  });

  it("REFUSES an empty ladder and a flat structure with no rate", () => {
    expect(
      commissionStructureSchema.safeParse({ model: "ladder", bands: [] })
        .success,
    ).toBe(false);
    expect(commissionStructureSchema.safeParse({ model: "flat" }).success).toBe(
      false,
    );
  });

  it("REFUSES recurring commission with no number of payments", () => {
    expect(
      commissionStructureSchema.safeParse({
        model: "flat",
        flat_rate: 0.2,
        duration: "recurring",
      }).success,
    ).toBe(false);
  });
});

describe("campaignInputSchema", () => {
  it("accepts the seeded campaign", () => {
    expect(campaignInputSchema.safeParse(BASE_CAMPAIGN).success).toBe(true);
  });

  it("REFUSES an end date on or before the start", () => {
    const res = campaignInputSchema.safeParse({
      ...BASE_CAMPAIGN,
      starts_at: "2026-08-01T00:00:00.000Z",
      ends_at: "2026-07-01T00:00:00.000Z",
    });
    expect(res.success).toBe(false);
  });

  it("REFUSES going live on a ladder where every rung pays 0%", () => {
    const res = campaignInputSchema.safeParse({
      ...BASE_CAMPAIGN,
      status: "active",
      commission_structure: {
        ...FOUNDING_LADDER,
        bands: [
          { max: 10_000, rate: 0 },
          { max: null, rate: 0 },
        ],
      },
    });
    expect(res.success).toBe(false);
  });

  it("REFUSES a slug that would break the public leaderboard URL", () => {
    for (const slug of ["Founding Race", "founding_race", "-race-", ""]) {
      expect(
        campaignInputSchema.safeParse({ ...BASE_CAMPAIGN, slug }).success,
      ).toBe(false);
    }
  });
});

describe("percent ⇄ rate conversion", () => {
  it("round-trips the ladder rates the founder types", () => {
    for (const pct of [10, 12.5, 15, 20, 25]) {
      expect(rateToPct(pctToRate(pct))).toBe(pct);
    }
  });

  it("clamps nonsense instead of storing it", () => {
    expect(pctToRate(500)).toBe(1);
    expect(pctToRate(-20)).toBe(0);
    expect(pctToRate(Number.NaN)).toBe(0);
  });
});

describe("sortBandsForDisplay + the resolver agree", () => {
  it("puts the open-ended band last and resolves the same rate", () => {
    const shuffled = [
      { max: null, rate: 0.25 },
      { max: 25_000, rate: 0.15 },
      { max: 10_000, rate: 0.1 },
      { max: 50_000, rate: 0.2 },
    ];
    const sorted = sortBandsForDisplay(shuffled);
    expect(sorted.map((b) => b.max)).toEqual([10_000, 25_000, 50_000, null]);
    // The display order must not change what a partner is actually paid.
    expect(ladderRateForBook(shuffled, 9_000)).toBe(0.1);
    expect(ladderRateForBook(sorted, 9_000)).toBe(0.1);
    expect(ladderRateForBook(shuffled, 80_000)).toBe(0.25);
    expect(ladderRateForBook(sorted, 80_000)).toBe(0.25);
  });
});

describe("describeLadder", () => {
  it("summarises the rungs for the list view", () => {
    expect(describeLadder(FOUNDING_LADDER)).toBe("10% → 25% across 4 rungs");
    expect(describeLadder({ model: "flat", flat_rate: 0.2 })).toBe("Flat rate");
    expect(describeLadder(null)).toBe("—");
  });
});
