"use client";

import { createContext, useCallback, useContext, useState } from "react";

import {
  convertFromZar,
  formatCurrency,
  isDisplayCurrency,
  type DisplayCurrency,
  type RateMap,
} from "@/lib/currency";

// Viewer-selected DISPLAY currency, available to all client components. The
// rate map is resolved server-side (lib/fx.ts) and injected once at the root
// layout; the selection persists in a cookie. Conversion is purely a display
// concern — the actual charge is always in the host's settlement currency.
//   const { currency, setCurrency, format } = useCurrency();
//   <Money amountZar={1500} />

type CurrencyCtx = {
  currency: DisplayCurrency;
  rates: RateMap;
  setCurrency: (c: DisplayCurrency) => void;
  /** Convert a base-ZAR amount into the selected display currency. */
  convert: (amountZar: number) => number;
  /** Convert + format a base-ZAR amount in the selected display currency. */
  format: (amountZar: number) => string;
};

const COOKIE = "vilo_display_ccy";
const CurrencyContext = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({
  initialCurrency,
  rates,
  children,
}: {
  initialCurrency: string | null | undefined;
  rates: RateMap;
  children: React.ReactNode;
}) {
  const [currency, setState] = useState<DisplayCurrency>(
    isDisplayCurrency(initialCurrency) ? initialCurrency : "ZAR",
  );

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setState(c);
    // Persist for a year so the choice follows the guest across visits.
    document.cookie = `${COOKIE}=${c}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, []);

  const convert = useCallback(
    (amountZar: number) => convertFromZar(amountZar, currency, rates),
    [currency, rates],
  );
  const format = useCallback(
    (amountZar: number) =>
      formatCurrency(convertFromZar(amountZar, currency, rates), currency),
    [currency, rates],
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, rates, setCurrency, convert, format }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

// Safe outside a provider (shouldn't happen — root layout wraps everything):
// falls back to a ZAR identity so nothing crashes.
export function useCurrency(): CurrencyCtx {
  const ctx = useContext(CurrencyContext);
  if (ctx) return ctx;
  return {
    currency: "ZAR",
    rates: { ZAR: 1 },
    setCurrency: () => {},
    convert: (z) => z,
    format: (z) => formatCurrency(z, "ZAR"),
  };
}

export const DISPLAY_CCY_COOKIE = COOKIE;
