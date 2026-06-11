"use client";

import {
  CURRENCY_META,
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
} from "@/lib/currency";

import { useCurrency } from "./CurrencyProvider";

// Compact display-currency picker for the header. Changing it re-renders every
// <Money> instantly (client-side conversion) and persists the choice.
export function CurrencySwitcher({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <label className={`relative inline-flex items-center ${className ?? ""}`}>
      <span className="sr-only">Display currency</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
        aria-label="Display currency"
        title="Show prices in"
        className="h-9 cursor-pointer appearance-none rounded-pill border border-brand-line bg-white pl-3 pr-7 text-[12.5px] font-semibold text-brand-ink outline-none transition hover:bg-brand-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      >
        {DISPLAY_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {CURRENCY_META[c].symbol} {c}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-brand-mute"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M7 9l5 5 5-5" />
      </svg>
    </label>
  );
}
