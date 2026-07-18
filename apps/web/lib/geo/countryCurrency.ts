// Maps a host's country (ISO-3166 alpha-2) to a sensible DEFAULT settlement
// currency from the curated set. This only PRE-FILLS the host's choice at signup
// — the host can always override (founder decision). Any country not explicitly
// mapped falls back to USD, the safest internationally-settleable default.

import type { DisplayCurrency } from "@/lib/currency";

// Eurozone members (+ microstates/territories that use the euro officially).
const EUROZONE = new Set([
  "AT",
  "BE",
  "HR",
  "CY",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PT",
  "SK",
  "SI",
  "ES",
  "AD",
  "MC",
  "SM",
  "VA",
  "ME",
  "XK",
]);

/** Best-guess default settlement currency for a country (overridable). */
export function countryToSettlementCurrency(
  iso2: string | null | undefined,
): DisplayCurrency {
  const c = (iso2 ?? "").toUpperCase();
  if (c === "ZA") return "ZAR";
  if (c === "GB") return "GBP";
  if (c === "US") return "USD";
  if (EUROZONE.has(c)) return "EUR";
  return "USD";
}
