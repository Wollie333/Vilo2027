"use client";

import { displayAmount } from "@/lib/currency";

import { useCurrency } from "./CurrencyProvider";

// Renders an `amount` (held in `currency`, default ZAR) in the viewer's selected
// DISPLAY currency. Conversion is a browsing ESTIMATE only — the guest is always
// charged in the host's settlement currency (spelled out where it matters, e.g.
// the checkout total line). Only ZAR amounts convert (we hold ZAR-base rates); a
// non-ZAR settlement amount renders natively, never a false cross-conversion.
//
// For factual/transactional amounts (invoices, receipts, ledger, payments, what
// is actually owed or charged) use formatMoney() from lib/format.ts instead —
// never this component. Converting those would change financial meaning.
//
//   <Money amount={1500} />                  → "R 1 500"  (ZAR display)
//   <Money amount={1500} />                  → "$80.00"   (USD display)
//   <Money amount={99} currency="USD" />     → "USD 99"   (non-ZAR source, native)
export function Money({
  amount,
  currency,
  className,
}: {
  amount: number | null | undefined;
  /** The currency `amount` is held in (null/undefined → ZAR). Only "ZAR" converts. */
  currency?: string | null;
  className?: string;
}) {
  const { currency: display, rates } = useCurrency();
  if (amount == null) return <span className={className}>—</span>;
  const { text } = displayAmount(amount, currency ?? "ZAR", display, rates);
  return <span className={className}>{text}</span>;
}
