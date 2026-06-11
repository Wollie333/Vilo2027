"use client";

import { useCurrency } from "./CurrencyProvider";

// Renders a base-ZAR amount in the viewer's selected DISPLAY currency. Conversion
// is a browsing ESTIMATE only — the guest is always charged in the host's
// settlement currency, so non-ZAR amounts are prefixed "≈" to signal that.
//
// For factual/transactional amounts (invoices, receipts, ledger, payments, what
// is actually owed or charged) use formatMoney() from lib/format.ts instead —
// never this component. Converting those would change financial meaning.
//
//   <Money amountZar={1500} />            → "R 1 500"  (ZAR selected)
//   <Money amountZar={1500} />            → "≈ $80.00" (USD selected)
//   <Money amountZar={1500} approx={false} /> → "$80.00" (no estimate marker)
export function Money({
  amountZar,
  approx = true,
  className,
}: {
  amountZar: number | null | undefined;
  /** Show the "≈" estimate marker for non-ZAR display currencies. Default true. */
  approx?: boolean;
  className?: string;
}) {
  const { currency, format } = useCurrency();
  if (amountZar == null) return <span className={className}>—</span>;
  const formatted = format(amountZar);
  const showApprox = approx && currency !== "ZAR";
  return (
    <span className={className}>
      {showApprox ? `≈ ${formatted}` : formatted}
    </span>
  );
}
