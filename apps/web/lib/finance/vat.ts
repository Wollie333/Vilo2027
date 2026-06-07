// The one TS-side VAT formula (mirrors the SQL apply_booking_vat trigger that
// VATs new bookings). Used for post-booking add-ons, which are charged after
// the booking exists and so can't go through the insert trigger. Always gross
// UP an ex-VAT amount by a rate — never re-implement this elsewhere.

export function grossUpVat(
  exVatAmount: number,
  rate: number,
): { vat: number; total: number } {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  const vat = Math.round(exVatAmount * (safeRate / 100) * 100) / 100;
  const total = Math.round((exVatAmount + vat) * 100) / 100;
  return { vat, total };
}
