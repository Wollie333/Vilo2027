"use client";

import {
  CURRENCY_META,
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
} from "@/lib/currency";
import { CURRENCY_SWITCHER_ENABLED } from "@/lib/frontendFlags";

import { useCurrency } from "./CurrencyProvider";

// Compact display-currency picker. Changing it re-renders every <Money>
// instantly (client-side conversion) and persists the choice. `variant="dark"`
// suits the dark utility bar; "light" (default) suits a white surface.
export function CurrencySwitcher({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  // Temporarily locked to ZAR (see lib/frontendFlags).
  if (!CURRENCY_SWITCHER_ENABLED) return null;
  return <CurrencySwitcherInner className={className} variant={variant} />;
}

function CurrencySwitcherInner({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const { currency, setCurrency } = useCurrency();
  const dark = variant === "dark";
  return (
    <label className={`relative inline-flex items-center ${className ?? ""}`}>
      <span className="sr-only">Display currency</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
        aria-label="Display currency"
        title="Show prices in"
        className={
          dark
            ? "h-7 cursor-pointer appearance-none rounded bg-transparent pl-1 pr-5 text-[12px] font-medium text-brand-accent/90 outline-none transition hover:text-white focus:text-white"
            : "h-9 cursor-pointer appearance-none rounded-pill border border-brand-line bg-white pl-3 pr-7 text-[12.5px] font-semibold text-brand-ink outline-none transition hover:bg-brand-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        }
      >
        {DISPLAY_CURRENCIES.map((c) => (
          <option key={c} value={c} className="text-brand-ink">
            {CURRENCY_META[c].symbol} {c}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={`pointer-events-none absolute h-3.5 w-3.5 ${
          dark ? "right-0.5 text-brand-accent/70" : "right-2 text-brand-mute"
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M7 9l5 5 5-5" />
      </svg>
    </label>
  );
}
