import "server-only";

import { cookies } from "next/headers";

import {
  displayAmount,
  isDisplayCurrency,
  PIVOT_CURRENCY,
  QUOTE_CURRENCIES,
  type DisplayCurrency,
  type RateMap,
} from "@/lib/currency";
import { round2 } from "@/lib/format";
import { CURRENCY_SWITCHER_ENABLED } from "@/lib/frontendFlags";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * FX rates for currency conversion. Under Model 2 each host settles in its own
 * currency, so display conversion must handle ANY base → ANY quote. Rates are
 * therefore held USD-PIVOTED — "units of X per 1 USD" — and any cross-rate is
 * perUsd[to] / perUsd[from] (see lib/currency.ts convertAmount).
 *
 * Rates are cached in the `fx_rates` table (base_currency = 'USD') and refreshed
 * at most hourly from a free, no-key FX API (open.er-api.com). An admin can pin a
 * rate by setting `is_manual_override = true`, which is never auto-overwritten.
 *
 * Writes use the service-role client because fx_rates has no authenticated write
 * policy (it's public-read reference data).
 */

const FX_API = `https://open.er-api.com/v6/latest/${PIVOT_CURRENCY}`;
const STALE_MS = 60 * 60 * 1000; // refresh at most hourly (display estimates)

// Conservative seeds (units per 1 USD) used only when there is no cached row AND
// the API is unreachable — keeps conversion/checkout functional.
const FALLBACK_PER_USD: Record<DisplayCurrency, number> = {
  USD: 1,
  ZAR: 18.5,
  EUR: 0.92,
  GBP: 0.79,
};

/** Fetch USD→{quote} rates in one call from the free FX API. */
async function fetchLivePivotRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(FX_API, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (json.result !== "success" || !json.rates) return null;
    const out: Record<string, number> = {};
    for (const q of QUOTE_CURRENCIES) {
      const r = json.rates[q];
      if (typeof r === "number" && r > 0) out[q] = r;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * USD-pivot rate map ("units per 1 USD") for every settlement currency. Reads the
 * cache, refreshes any stale/missing pair from the API in one call, honours
 * admin-pinned overrides, and never throws — falls back to the cached or seed
 * value so the UI always has a number. USD is always 1.
 */
export async function getDisplayRates(): Promise<RateMap> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("fx_rates")
    .select("quote_currency, rate, is_manual_override, fetched_at")
    .eq("base_currency", PIVOT_CURRENCY)
    .in("quote_currency", QUOTE_CURRENCIES as unknown as string[]);

  const byQuote = new Map(
    (rows ?? []).map((r) => [r.quote_currency as string, r]),
  );
  const stale = QUOTE_CURRENCIES.some((q) => {
    const row = byQuote.get(q);
    if (!row) return true;
    if (row.is_manual_override) return false;
    return (
      !row.fetched_at ||
      Date.now() - new Date(row.fetched_at).getTime() >= STALE_MS
    );
  });

  let live: Record<string, number> | null = null;
  if (stale) {
    live = await fetchLivePivotRates();
    if (live) {
      const now = new Date().toISOString();
      const upserts = QUOTE_CURRENCIES.filter(
        (q) => !byQuote.get(q)?.is_manual_override && live![q] != null,
      ).map((q) => ({
        base_currency: PIVOT_CURRENCY,
        quote_currency: q,
        rate: live![q],
        source: "open.er-api.com",
        is_manual_override: false,
        fetched_at: now,
      }));
      if (upserts.length > 0) {
        await supabase
          .from("fx_rates")
          .upsert(upserts, { onConflict: "base_currency,quote_currency" });
      }
    }
  }

  const map: RateMap = { [PIVOT_CURRENCY]: 1 };
  for (const q of QUOTE_CURRENCIES) {
    const row = byQuote.get(q);
    map[q] = row?.is_manual_override
      ? Number(row.rate)
      : (live?.[q] ?? (row ? Number(row.rate) : FALLBACK_PER_USD[q]));
  }
  return map;
}

/**
 * Current ZAR→USD rate (USD per 1 ZAR), derived from the USD-pivot map. Never
 * throws. Used by the PayPal charge path for ZAR hosts (PayPal-SA can't hold ZAR)
 * and Wielo's own product/credits checkout (Flow B, ZAR of record).
 */
export async function getZarToUsdRate(): Promise<number> {
  const rates = await getDisplayRates();
  const zarPerUsd = rates.ZAR ?? FALLBACK_PER_USD.ZAR;
  return zarPerUsd > 0 ? 1 / zarPerUsd : 1 / FALLBACK_PER_USD.ZAR;
}

/** Convert a ZAR amount to USD using the current cached rate, rounded to cents. */
export async function convertZarToUsd(amountZar: number): Promise<number> {
  const rate = await getZarToUsdRate();
  return round2(amountZar * rate);
}

/**
 * Convert an amount held in `from` into `to` using the live USD-pivot rates,
 * rounded to cents. For the CHARGE path (host currency → gateway currency).
 */
export async function convertCurrency(
  amount: number,
  from: DisplayCurrency,
  to: DisplayCurrency,
): Promise<number> {
  if (from === to) return round2(amount);
  const rates = await getDisplayRates();
  const rf = from === PIVOT_CURRENCY ? 1 : (rates[from] ?? null);
  const rt = to === PIVOT_CURRENCY ? 1 : (rates[to] ?? null);
  if (!rf || !rt) return round2(amount);
  return round2((amount * rt) / rf);
}

// ── Server-side display formatter (mirror of client formatFrom) ───────────
// Cookie name mirrors CurrencyProvider's COOKIE.
const DISPLAY_CCY_COOKIE = "vilo_display_ccy";

/** A synchronous source-aware money formatter, resolved from the current cookie. */
export type ServerMoneyFormatter = (
  amount: number | null | undefined,
  sourceCurrency?: string,
) => string;

/**
 * Server-side equivalent of the client `formatFrom` (CurrencyProvider), for
 * SERVER components that build STRING values (where a <Money> JSX node can't
 * go). Reads the guest's display-currency cookie + the cached rate map ONCE,
 * then returns a synchronous formatter. Non-reactive: the value updates on the
 * next page load after the guest switches currency.
 *
 * Mirrors <Money>: cross-converts the amount into the display currency. For
 * transactional/legal amounts that must NEVER convert (the exact charge,
 * invoices, receipts, real balance due/paid), keep using formatMoney() instead.
 */
export async function getServerMoneyFormatter(): Promise<ServerMoneyFormatter> {
  const raw = cookies().get(DISPLAY_CCY_COOKIE)?.value;
  const display: DisplayCurrency =
    CURRENCY_SWITCHER_ENABLED && isDisplayCurrency(raw) ? raw : "ZAR";

  const rates = await getDisplayRates();
  return (amount, sourceCurrency = "ZAR") => {
    if (amount == null) return "—";
    const { text } = displayAmount(amount, sourceCurrency, display, rates);
    return text;
  };
}
