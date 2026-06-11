import "server-only";

import { QUOTE_CURRENCIES, type RateMap } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * FX rates for checkout currency conversion. Prices live in a ZAR base; when a
 * guest pays in USD (via PayPal) the amount is converted with the cached rate.
 *
 * Rates are cached in the `fx_rates` table and refreshed at most once a day
 * from a free, no-key FX API (open.er-api.com). An admin can pin a rate by
 * setting `is_manual_override = true`, which is never auto-overwritten.
 *
 * Writes use the service-role client because fx_rates has no authenticated
 * write policy (it's public-read reference data).
 */

const FX_API = "https://open.er-api.com/v6/latest/ZAR";
const STALE_MS = 24 * 60 * 60 * 1000; // refresh at most daily
// Conservative fallback (~0.053 USD per ZAR) used only if there is no cached
// row AND the API is unreachable — keeps checkout functional.
const FALLBACK_ZAR_USD = 0.053;

async function fetchLiveZarUsd(): Promise<number | null> {
  try {
    const res = await fetch(FX_API, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    const rate = json.rates?.USD;
    return json.result === "success" && typeof rate === "number" && rate > 0
      ? rate
      : null;
  } catch {
    return null;
  }
}

/**
 * Current ZAR -> USD rate (USD per 1 ZAR), reading the daily cache and
 * refreshing it when stale. Never throws — falls back to the cached or seed
 * value so checkout always has a number.
 */
export async function getZarToUsdRate(): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("fx_rates")
    .select("rate, is_manual_override, fetched_at")
    .eq("base_currency", "ZAR")
    .eq("quote_currency", "USD")
    .maybeSingle();

  // Admin-pinned rate: trust it, never auto-refresh.
  if (data?.is_manual_override) return Number(data.rate);

  const fresh =
    data?.fetched_at &&
    Date.now() - new Date(data.fetched_at).getTime() < STALE_MS;
  if (data && fresh) return Number(data.rate);

  const live = await fetchLiveZarUsd();
  if (live == null) return data ? Number(data.rate) : FALLBACK_ZAR_USD;

  await supabase.from("fx_rates").upsert(
    {
      base_currency: "ZAR",
      quote_currency: "USD",
      rate: live,
      source: "open.er-api.com",
      is_manual_override: false,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "base_currency,quote_currency" },
  );
  return live;
}

/** Convert a ZAR amount to USD using the current cached rate, rounded to cents. */
export async function convertZarToUsd(amountZar: number): Promise<number> {
  const rate = await getZarToUsdRate();
  return Math.round(amountZar * rate * 100) / 100;
}

// ── Multi-currency DISPLAY rates (ZAR → USD/EUR/GBP) ──────────────────────
// Conservative seeds used only when there's no cached row AND the API is
// unreachable — keeps the display switcher functional.
const FALLBACK_RATES: Record<string, number> = {
  USD: 0.053,
  EUR: 0.049,
  GBP: 0.042,
};

/** Fetch ZAR→{USD,EUR,GBP} in one call from the free FX API. */
async function fetchLiveZarRates(): Promise<Record<string, number> | null> {
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
 * ZAR→quote rate map for the display switcher (ZAR is the 1.0 base). Reads the
 * daily fx_rates cache, refreshes any stale/missing pair from the API in one
 * call, honours admin-pinned overrides, and never throws — falls back to the
 * cached or seed value so the UI always has a number.
 */
export async function getDisplayRates(): Promise<RateMap> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("fx_rates")
    .select("quote_currency, rate, is_manual_override, fetched_at")
    .eq("base_currency", "ZAR")
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
    live = await fetchLiveZarRates();
    if (live) {
      const now = new Date().toISOString();
      const upserts = QUOTE_CURRENCIES.filter(
        (q) => !byQuote.get(q)?.is_manual_override && live![q] != null,
      ).map((q) => ({
        base_currency: "ZAR",
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

  const map: RateMap = { ZAR: 1 };
  for (const q of QUOTE_CURRENCIES) {
    const row = byQuote.get(q);
    map[q] = row?.is_manual_override
      ? Number(row.rate)
      : (live?.[q] ?? (row ? Number(row.rate) : FALLBACK_RATES[q]));
  }
  return map;
}
