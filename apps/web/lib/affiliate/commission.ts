import { round2 } from "./fees";

// TS twin of the commission maths in accrue_affiliate_commission (SQL). Used for
// display ("you'd earn …" on the affiliate products page) and by the verifier to
// recompute parity against stored rows. Keep in lock-step with the migration.

export type CommissionRateType = "amount" | "percent";

/**
 * Commission on a NET base. `percent` applies the rate; `amount` is a fixed
 * payout capped at the net (a fixed commission never exceeds what was paid).
 */
export function computeCommission(
  net: number,
  rateType: CommissionRateType,
  rateValue: number,
): number {
  if (!net || net <= 0 || !rateValue || rateValue <= 0) return 0;
  return rateType === "percent"
    ? round2((net * rateValue) / 100)
    : round2(Math.min(rateValue, net));
}

/** Human label for a product's commission config (products.affiliate_*). */
export function commissionLabel(
  rateType: "none" | CommissionRateType,
  rateValue: number,
  currency = "ZAR",
): string {
  if (rateType === "none" || !rateValue) return "No commission";
  return rateType === "percent"
    ? `${rateValue}% commission`
    : `${currency} ${round2(rateValue).toFixed(2)} commission`;
}
