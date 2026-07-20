// Affiliate CAMPAIGN helpers (WS-1.4). Pure display/projection maths for the
// Competitions tab — NO money is written here. The ladder rate a partner will
// actually be paid is resolved server-side at accrual (WS-1.5); these helpers
// power the plain-language structure summary + the CPA-safe "potential earnings"
// calculator only.

export type LadderBand = { max: number | null; rate: number };

export type CommissionStructure = {
  model: "ladder" | "flat" | "inherit";
  scope?: string;
  duration?: "once" | "recurring" | "lifetime";
  recurring_periods?: number;
  bands?: LadderBand[];
  flat_rate?: number;
  flat_type?: "percent" | "amount";
};

export type Competition = {
  events?: Record<string, number>;
  scoring_mode?: "total" | "net_change";
  count_active_only?: boolean;
  each_listing_counts?: boolean;
  tie_breaker?: string;
  leaderboard_visibility?: "public" | "partners" | "hidden";
  prizes?: {
    placing?: number;
    cash?: number;
    floor?: number;
    milestone?: string;
    monthly_top_net_change?: number;
  }[];
};

// Bands sorted ascending by ceiling (null ceiling = the top, open-ended band).
function sortBands(bands: LadderBand[]): LadderBand[] {
  return [...bands].sort(
    (a, b) =>
      (a.max ?? Number.POSITIVE_INFINITY) - (b.max ?? Number.POSITIVE_INFINITY),
  );
}

// The ladder rate (fraction 0..1) for a given trailing-month subscription book.
// Whole-book: crossing a ceiling moves the ENTIRE book to the higher rate.
export function ladderRateForBook(bands: LadderBand[], book: number): number {
  const sorted = sortBands(bands);
  for (const b of sorted) {
    if (b.max === null || book <= b.max) return b.rate;
  }
  return sorted.length ? sorted[sorted.length - 1].rate : 0;
}

// Distance to the next rung + the rate it unlocks, or null if already at the top.
export function nextLadderRung(
  bands: LadderBand[],
  book: number,
): { toNext: number; nextRate: number } | null {
  const sorted = sortBands(bands);
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (b.max !== null && book <= b.max) {
      const next = sorted[i + 1];
      return next
        ? { toNext: Math.max(0, b.max - book), nextRate: next.rate }
        : null;
    }
  }
  return null; // top band already
}

// Plain-language one-liner for the structure card.
export function describeCommissionStructure(cs: CommissionStructure): string {
  const forever =
    cs.duration === "lifetime"
      ? " for as long as each host keeps paying"
      : cs.duration === "recurring" && cs.recurring_periods
        ? ` for their first ${cs.recurring_periods} payments`
        : "";
  if (cs.model === "ladder") {
    return `A revenue-banded commission ladder — the more monthly subscription revenue your hosts generate, the higher your rate on your whole book${forever}.`;
  }
  if (cs.model === "flat") {
    const rate =
      cs.flat_type === "amount"
        ? `R${Number(cs.flat_rate ?? 0).toLocaleString("en-ZA")}`
        : `${Math.round((cs.flat_rate ?? 0) * 100)}%`;
    return `A flat ${rate} commission on every referred subscription${forever}.`;
  }
  return "Standard per-product commission — the same rates as your default link.";
}
