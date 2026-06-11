// Client-safe currency helpers for the multi-currency DISPLAY layer. Prices are
// stored in the host's settlement currency (ZAR baseline); guests can switch the
// DISPLAY currency in the header and see converted estimates. The actual charge
// always happens in the host's settlement currency (see lib/fx.ts + checkout).
//
// No "server-only" — imported by both the client switcher/provider and server
// loaders. Rate fetching lives in lib/fx.ts (server-only, DB + FX API).

import { formatMoney } from "@/lib/format";

export const DISPLAY_CURRENCIES = ["ZAR", "USD", "EUR", "GBP"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const CURRENCY_META: Record<
  DisplayCurrency,
  { symbol: string; label: string }
> = {
  ZAR: { symbol: "R", label: "South African Rand" },
  USD: { symbol: "$", label: "US Dollar" },
  EUR: { symbol: "€", label: "Euro" },
  GBP: { symbol: "£", label: "British Pound" },
};

/** Quote currencies we fetch ZAR→X rates for (ZAR itself is the 1.0 base). */
export const QUOTE_CURRENCIES = ["USD", "EUR", "GBP"] as const;

/** A ZAR→quote rate map, e.g. { USD: 0.053, EUR: 0.049, GBP: 0.042 }. ZAR is 1. */
export type RateMap = Partial<Record<DisplayCurrency, number>>;

export function isDisplayCurrency(
  v: string | null | undefined,
): v is DisplayCurrency {
  return !!v && (DISPLAY_CURRENCIES as readonly string[]).includes(v);
}

/** Convert a base-ZAR amount into the display currency using the rate map. */
export function convertFromZar(
  amountZar: number,
  currency: DisplayCurrency,
  rates: RateMap,
): number {
  const rate = currency === "ZAR" ? 1 : (rates[currency] ?? 1);
  return Math.round(amountZar * rate * 100) / 100;
}

/** Format an amount that is ALREADY in `currency`. ZAR mirrors formatMoney
 *  (space-grouped, no decimals); other currencies use their symbol + 2 dp. */
export function formatCurrency(
  amount: number,
  currency: DisplayCurrency,
): string {
  if (currency === "ZAR") {
    return `R ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
  }
  const { symbol } = CURRENCY_META[currency];
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Display an `amount` held in `sourceCurrency` in the viewer's `display`
 * currency. We only hold ZAR-base rates, so ONLY ZAR sources convert; any other
 * source renders natively (via formatMoney) — never a false cross-conversion.
 * `converted` is true only when a ZAR amount was actually converted to a
 * different currency, so callers can add an "≈" estimate marker. This is the
 * single place the source→display rule lives (used by <Money> and formatFrom).
 */
export function displayAmount(
  amount: number,
  sourceCurrency: string,
  display: DisplayCurrency,
  rates: RateMap,
): { text: string; converted: boolean } {
  if (sourceCurrency !== "ZAR") {
    return { text: formatMoney(amount, sourceCurrency), converted: false };
  }
  return {
    text: formatCurrency(convertFromZar(amount, display, rates), display),
    converted: display !== "ZAR",
  };
}
