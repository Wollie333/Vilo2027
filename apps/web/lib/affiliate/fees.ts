// Payout-fee maths — the single source of truth for what an affiliate receives.
// The fee is DEDUCTED from the affiliate: they earn gross, receive net. Mirrors
// the SQL kept in the migrations; keep the two in lock-step.

/** Round to 2 decimal places (full Rand units, no float drift). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type PayoutMethod = "eft" | "paystack" | "paypal";

export type PayoutFeeConfig = {
  fixed_fee: number;
  percent_fee: number; // e.g. 2.9 = 2.9%
  cap_fee: number | null;
};

export type PayoutBreakdown = {
  gross: number;
  fee: number;
  net: number;
};

/** fee = min(cap, fixed + gross*percent/100); net = gross - fee. */
export function computePayoutFee(
  gross: number,
  cfg: PayoutFeeConfig,
): PayoutBreakdown {
  const g = round2(Math.max(0, gross));
  const raw = cfg.fixed_fee + (g * cfg.percent_fee) / 100;
  const capped = cfg.cap_fee != null ? Math.min(cfg.cap_fee, raw) : raw;
  const fee = round2(Math.max(0, Math.min(capped, g)));
  return { gross: g, fee, net: round2(g - fee) };
}
