import "server-only";

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
