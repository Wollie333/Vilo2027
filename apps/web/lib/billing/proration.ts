// Pro-ration for mid-cycle subscription changes (Wielo commerce model, phase 4).
// A change made part-way through a billing period only bills / credits the UNUSED
// portion of that period. All money maths is server-authoritative — the UI may
// preview the same numbers, but the action recomputes before writing the ledger.

/**
 * Fraction (0..1) of the current billing period still UNUSED at `now`.
 *  - No period on file (free / never-billed sub) → 0 (nothing to prorate).
 *  - `now` past period end → 0 (fully consumed).
 *  - `now` before/at period start → 1 (entirely unused).
 */
export function unusedFraction(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!periodStart || !periodEnd) return 0;
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const t = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return 0;
  if (t >= end) return 0;
  if (t <= start) return 1;
  return (end - t) / (end - start);
}

/** Round to 2 decimals (Rand units are stored whole; we keep cents precision). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * The pro-rated amount to credit/charge for `price` over the unused portion of
 * the period. Never negative.
 */
export function proratedAmount(
  price: number,
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
  now: Date = new Date(),
): number {
  const frac = unusedFraction(periodStart, periodEnd, now);
  return round2(Math.max(0, price) * frac);
}

/** Whole days remaining in the period (for human-readable ledger reasons). */
export function daysRemaining(
  periodEnd: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!periodEnd) return 0;
  const end = new Date(periodEnd).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}
