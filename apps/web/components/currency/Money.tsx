"use client";

import { displayAmount } from "@/lib/currency";

import { useCurrency } from "./CurrencyProvider";

// Renders an `amount` (held in `currency`, default the host settlement currency)
// in the viewer's selected DISPLAY currency. Conversion is a browsing ESTIMATE
// only — the guest is always charged in the host's settlement currency, which is
// shown exactly at the payment step. Cross-converts via the USD pivot; a source
// outside the curated set renders natively, never a false cross-conversion.
//
// For factual/transactional amounts (invoices, receipts, ledger, payments, what
// is actually owed or charged) use formatMoney() from lib/format.ts instead —
// never this component. Converting those would change financial meaning.
//
//   <Money amount={1500} />                  → "R 1 500"  (ZAR display)
//   <Money amount={1500} />                  → "$80.00"   (USD display, converted)
//   <Money amount={99} currency="USD" />     → "USD 99"   (native, not converted)
export function Money({
  amount,
  currency = "ZAR",
  className,
}: {
  amount: number | null | undefined;
  /** The currency `amount` is held in (the host settlement currency). Default "ZAR". */
  currency?: string;
  className?: string;
}) {
  const { currency: display, rates } = useCurrency();
  if (amount == null) return <span className={className}>—</span>;
  const { text } = displayAmount(amount, currency, display, rates);
  return <span className={className}>{text}</span>;
}
