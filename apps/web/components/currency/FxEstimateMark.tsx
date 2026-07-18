"use client";

import { Info } from "lucide-react";

import {
  formatCurrency,
  isDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/currency";

import { useCurrency } from "./CurrencyProvider";

// A small superscript info marker placed next to a CONVERTED display total (used
// on the final checkout step). Explains, on hover/focus, that the shown price is
// an estimate in the viewer's display currency and states the EXACT amount that
// will be charged in the host's settlement currency.
//
// Renders nothing when there's nothing to clarify — i.e. the viewer is already
// displaying the host's settlement currency (shown == charged), or the source
// currency isn't one we convert. Safe to drop in unconditionally.
export function FxEstimateMark({
  amount,
  settlementCurrency,
  align = "right",
  className,
}: {
  /** The total in the host's settlement currency (the exact charge amount). */
  amount: number;
  /** The host's settlement currency (currency of record for this booking). */
  settlementCurrency: string;
  /** Which edge the tooltip anchors to (so it stays on-screen). Default "right". */
  align?: "left" | "right";
  className?: string;
}) {
  const { currency: display } = useCurrency();
  if (
    !isDisplayCurrency(settlementCurrency) ||
    display === settlementCurrency
  ) {
    return null;
  }
  const exact = formatCurrency(amount, settlementCurrency as DisplayCurrency);
  return (
    <span
      className={`group/fx relative inline-flex align-super ${className ?? ""}`}
    >
      <button
        type="button"
        aria-label="Why is this price an estimate?"
        className="inline-flex cursor-help text-current opacity-70 transition hover:opacity-100 focus:opacity-100 focus:outline-none"
      >
        <Info className="h-3 w-3" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full z-30 mb-1.5 w-60 rounded-lg bg-white px-3 py-2 text-left text-[11.5px] font-normal leading-snug text-brand-ink opacity-0 shadow-card ring-1 ring-brand-line transition-opacity group-focus-within/fx:opacity-100 group-hover/fx:opacity-100 ${
          align === "left" ? "left-0" : "right-0"
        }`}
      >
        Shown in {display} as an estimate. You&rsquo;ll be charged{" "}
        <span className="font-semibold">{exact}</span> in {settlementCurrency}{" "}
        (the host&rsquo;s currency) — the exact amount can vary slightly with
        the exchange rate.
      </span>
    </span>
  );
}
