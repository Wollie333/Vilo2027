// Canonical display formatters. Wielo stores amounts in full Rand units, and the
// app is ZAR-first, so money renders as "R 1 500" (space-grouped, no decimals).
// A non-ZAR amount keeps its ISO code as a prefix ("USD 1 500").
//
// This replaces the many ad-hoc copies of the same `currency === "ZAR" ? …`
// snippet scattered across pages. Migrate call sites to it in small, verified
// batches — see SIMPLIFICATION_PLAN.md.

export function formatMoney(
  amount: number | null | undefined,
  currency = "ZAR",
): string {
  if (amount == null) return "—";
  const grouped = Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ");
  return currency === "ZAR" ? `R ${grouped}` : `${currency} ${grouped}`;
}

/**
 * Money to the cent — for INVOICES, RECEIPTS and any tax document, where the
 * exact amount and its VAT split must be shown (a rounded "R 114" on a tax
 * invoice for a R 113,85 charge is wrong, and 99 + 15 ≠ 113,85 reads as broken).
 * `formatMoney` (whole rand) stays the default for dashboards / cards / summaries.
 * en-ZA renders "R 1 234,56" — space thousands, comma decimal.
 */
export function formatMoneyExact(
  amount: number | null | undefined,
  currency = "ZAR",
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  // Built manually rather than via Intl currency so the output is identical in
  // Node (RSC) and the browser — ICU's en-ZA currency separators differ between
  // runtimes. SA convention: space thousands, comma decimal → "R 1 234,56".
  const neg = amount < 0;
  const cents = Math.round(Math.abs(amount) * 100);
  const rand = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  const grouped = rand.toLocaleString("en-ZA").replace(/,/g, " ");
  const prefix = currency === "ZAR" ? "R " : `${currency} `;
  return `${neg ? "-" : ""}${prefix}${grouped},${frac}`;
}

/**
 * Round to 2 decimals (cents), the single rounding helper for all money maths.
 * The `Number.EPSILON` nudge avoids float artefacts like `1.005 → 1.00`.
 * Import this everywhere instead of re-deriving `Math.round(n * 100) / 100`.
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
