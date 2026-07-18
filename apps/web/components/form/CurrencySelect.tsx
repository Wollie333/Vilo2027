"use client";

import {
  CURRENCY_META,
  SETTLEMENT_CURRENCIES,
  type DisplayCurrency,
} from "@/lib/currency";

// Settlement-currency picker (the curated set a host can be paid in). Used in
// host signup + business settings. A plain native <select> — the list is short
// and this is a settings field, not a search.
export function CurrencySelect({
  value,
  onChange,
  id,
  disabled = false,
  ariaLabel = "Settlement currency",
}: {
  value: DisplayCurrency;
  onChange: (c: DisplayCurrency) => void;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as DisplayCurrency)}
      className="w-full rounded border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink transition focus:outline-none focus:ring-4 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {SETTLEMENT_CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {CURRENCY_META[c].symbol} {c} — {CURRENCY_META[c].label}
        </option>
      ))}
    </select>
  );
}
