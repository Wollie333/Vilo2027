import { describe, expect, it } from "vitest";

import {
  isLiveMembershipStatus,
  pickCurrentMembershipIndex,
  type MembershipCandidate,
} from "./currentMembership";

// Rows are shaped like the callers': productType comes from a joined products row
// (`product?.product_type ?? null`), so null means "no catalog product" — the
// product-less signup baseline, which IS the guest-tier membership.
const pick = (rows: MembershipCandidate[]) =>
  pickCurrentMembershipIndex(rows, (r) => r);

const row = (
  productType: string | null,
  status: string | null,
  createdAt: string,
): MembershipCandidate => ({ productType, status, createdAt });

describe("pickCurrentMembershipIndex", () => {
  it("returns -1 when there are no rows", () => {
    expect(pick([])).toBe(-1);
  });

  it("ignores non-membership subs", () => {
    expect(
      pick([
        row("service", "active", "2026-01-01"),
        row("wielo_credits", "active", "2026-01-02"),
        row("product", "active", "2026-01-03"),
      ]),
    ).toBe(-1);
  });

  it("prefers a live membership over an older cancelled one", () => {
    const rows = [
      row("membership", "cancelled", "2026-01-01"),
      row("membership", "active", "2026-01-02"),
    ];
    expect(pick(rows)).toBe(1);
  });

  it("prefers the NEWEST live membership", () => {
    const rows = [
      row("membership", "active", "2026-01-01"),
      row("membership", "trialing", "2026-03-01"),
    ];
    expect(pick(rows)).toBe(1);
  });

  it("falls back to the most recent membership when none is live", () => {
    const rows = [
      row("membership", "cancelled", "2026-01-01"),
      row("membership", "expired", "2026-02-01"),
    ];
    expect(pick(rows)).toBe(1);
  });

  // ─── The regression this file exists for ────────────────────────────────
  // Signup inserts a baseline sub with product_id = NULL (the free guest tier).
  // The selector used to require productType === "membership", so the baseline
  // was invisible — the same `s.product_id && …` mistake that let a stale
  // baseline survive every upgrade and out-vote the paid plan (39e17078).
  describe("the product-less signup baseline (guest tier)", () => {
    it("counts a product-less active sub as the current membership", () => {
      expect(pick([row(null, "active", "2026-01-01")])).toBe(0);
    });

    it("is still found when a service sub sits alongside it", () => {
      const rows = [
        row(null, "active", "2026-01-01"),
        row("service", "active", "2026-02-01"),
      ];
      expect(pick(rows)).toBe(0);
    });

    it("does not let a CANCELLED membership out-rank the LIVE baseline", () => {
      // The exact shape that would have broken the one-membership guard: the
      // selector returned the cancelled product-backed row, so switchPlan would
      // update that and leave the baseline active — two active memberships.
      const rows = [
        row("membership", "cancelled", "2026-02-01"),
        row(null, "active", "2026-01-01"),
      ];
      expect(pick(rows)).toBe(1);
    });

    it("loses to a live product-backed membership (the real upgrade case)", () => {
      const rows = [
        row(null, "active", "2026-01-01"),
        row("membership", "active", "2026-02-01"),
      ];
      expect(pick(rows)).toBe(1);
    });
  });
});

describe("isLiveMembershipStatus", () => {
  it.each(["active", "trialing", "past_due"])("%s is live", (s) => {
    expect(isLiveMembershipStatus(s)).toBe(true);
  });

  // Paused frees the membership slot (founder call), so it is NOT live: a paused
  // host may buy a new membership. The DB guard counts the same three statuses.
  it.each(["paused", "cancelled", "expired", "restricted"])(
    "%s is not live",
    (s) => {
      expect(isLiveMembershipStatus(s)).toBe(false);
    },
  );

  it("treats null as not live", () => {
    expect(isLiveMembershipStatus(null)).toBe(false);
  });
});
