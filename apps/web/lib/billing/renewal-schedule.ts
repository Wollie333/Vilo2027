// Pure renewal-scheduling math (no server-only imports, so it is unit-testable).
// Used by the Paystack renewal engine (lib/billing/subscription-renewal.ts).

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The period a renewal PAYS FOR — contiguous with the current one (anniversary
 * billing) so periods never drift and the idempotency key stays stable. A sub
 * with no period on file (shouldn't happen for a paid renewal) starts "now".
 */
export function nextPeriod(
  currentPeriodEnd: string | null,
  cycle: "monthly" | "annual",
  now: Date = new Date(),
): { start: Date; end: Date } {
  const start = currentPeriodEnd ? new Date(currentPeriodEnd) : now;
  return { start, end: addMonths(start, cycle === "annual" ? 12 : 1) };
}

/**
 * Per-(subscription, period, attempt) idempotency reference. platform_ledger.
 * provider_reference is UNIQUE, so this string is the latch that stops a double
 * tick — or the backstop webhook — from double-charging. It is STABLE for a given
 * attempt (safe re-run) and CHANGES when the attempt increments (dunning retry).
 */
export function renewalReference(
  subId: string,
  periodStart: Date,
  attempt: number,
): string {
  return `renew_${subId}_${ymd(periodStart)}_a${attempt}`;
}
