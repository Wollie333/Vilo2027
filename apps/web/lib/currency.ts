// Multi-currency helpers. Under "Model 2" each HOST/business has a SETTLEMENT
// currency (its currency of record) — a listing's prices, bookings, invoices and
// payouts all denominate in it. A guest can switch the DISPLAY currency in the
// header to see a converted ESTIMATE; the actual charge always happens in the
// host's settlement currency (see lib/fx.ts + the checkout).
//
// Conversion is CROSS-RATE and USD-pivoted: rates are held as "units of X per 1
// USD" so ANY currency can convert to ANY other (rate A→B = perUsd[B]/perUsd[A]).
// The old model only converted a ZAR base; Model 2 needs host-base → guest-base.
//
// No "server-only" — imported by both the client switcher/provider and server
// loaders. Rate fetching lives in lib/fx.ts (server-only, DB + FX API).

import { formatMoney, round2 } from "@/lib/format";

// The curated set a host may settle in AND a guest may display in. Every entry
// must be settleable by at least one payment rail (see CURRENCY_META.rails).
export const DISPLAY_CURRENCIES = ["ZAR", "USD", "EUR", "GBP"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Alias — the same curated set, named for the host/settlement context. */
export const SETTLEMENT_CURRENCIES = DISPLAY_CURRENCIES;

/** The pivot every stored rate is expressed against (units of X per 1 PIVOT). */
export const PIVOT_CURRENCY: DisplayCurrency = "USD";

export type PaymentRail = "paystack" | "paypal" | "eft";

export const CURRENCY_META: Record<
  DisplayCurrency,
  {
    symbol: string;
    label: string;
    /** Fraction digits for display (ZAR shows whole rand; others 2dp). */
    decimals: number;
    /** Rails that can actually SETTLE this currency to a host. */
    rails: PaymentRail[];
  }
> = {
  ZAR: {
    symbol: "R",
    label: "South African Rand",
    decimals: 0,
    rails: ["paystack", "eft"],
  },
  USD: {
    symbol: "$",
    label: "US Dollar",
    decimals: 2,
    rails: ["paystack", "paypal", "eft"],
  },
  EUR: {
    symbol: "€",
    label: "Euro",
    decimals: 2,
    rails: ["paypal", "eft"],
  },
  GBP: {
    symbol: "£",
    label: "British Pound",
    decimals: 2,
    rails: ["paypal", "eft"],
  },
};

/** Currencies we fetch a USD→X rate for (the pivot itself is always 1.0). */
export const QUOTE_CURRENCIES = SETTLEMENT_CURRENCIES.filter(
  (c) => c !== PIVOT_CURRENCY,
) as ReadonlyArray<DisplayCurrency>;

/**
 * A rate map in "units of currency per 1 USD" (USD-pivot). USD is implicitly 1.
 * e.g. { ZAR: 18.5, EUR: 0.92, GBP: 0.79 }.
 */
export type RateMap = Partial<Record<DisplayCurrency, number>>;

export function isDisplayCurrency(
  v: string | null | undefined,
): v is DisplayCurrency {
  return !!v && (DISPLAY_CURRENCIES as readonly string[]).includes(v);
}

/** Whether a payment rail can settle a given currency. */
export function railSupportsCurrency(
  rail: PaymentRail,
  currency: string,
): boolean {
  return (
    isDisplayCurrency(currency) && CURRENCY_META[currency].rails.includes(rail)
  );
}

/** Per-1-USD rate for a currency (USD itself is 1). Null when unknown. */
function perUsd(currency: DisplayCurrency, rates: RateMap): number | null {
  if (currency === PIVOT_CURRENCY) return 1;
  const r = rates[currency];
  return typeof r === "number" && r > 0 ? r : null;
}

/**
 * Convert `amount` from one currency to another via the USD pivot. Returns the
 * amount unchanged when the pair is identical or a rate is missing (never a
 * false cross-conversion). Rounded to cents.
 */
export function convertAmount(
  amount: number,
  from: DisplayCurrency,
  to: DisplayCurrency,
  rates: RateMap,
): number {
  if (from === to) return round2(amount);
  const rf = perUsd(from, rates);
  const rt = perUsd(to, rates);
  if (rf == null || rt == null) return round2(amount);
  return round2((amount * rt) / rf);
}

/** Back-compat convenience: convert a ZAR-base amount into `currency`. */
export function convertFromZar(
  amountZar: number,
  currency: DisplayCurrency,
  rates: RateMap,
): number {
  return convertAmount(amountZar, "ZAR", currency, rates);
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
  const { symbol, decimals } = CURRENCY_META[currency];
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Display an `amount` held in `sourceCurrency` in the viewer's `display`
 * currency, cross-converting via the USD pivot. A source outside the curated set
 * renders natively (via formatMoney) — never a false conversion. `converted` is
 * true only when a real cross-currency conversion happened, so callers can add
 * an "≈" estimate marker. This is the single place the source→display rule lives
 * (used by <Money>, formatFrom and the server formatter).
 */
export function displayAmount(
  amount: number,
  sourceCurrency: string,
  display: DisplayCurrency,
  rates: RateMap,
): { text: string; converted: boolean } {
  if (!isDisplayCurrency(sourceCurrency)) {
    return { text: formatMoney(amount, sourceCurrency), converted: false };
  }
  if (sourceCurrency === display) {
    return { text: formatCurrency(amount, display), converted: false };
  }
  return {
    text: formatCurrency(
      convertAmount(amount, sourceCurrency, display, rates),
      display,
    ),
    converted: true,
  };
}
