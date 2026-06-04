// Canonical display formatters. Vilo stores amounts in full Rand units, and the
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
