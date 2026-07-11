// VAT display helpers.
//
// Model (founder-confirmed): host-entered prices (nightly rate, cleaning fee,
// special flat total, add-ons) are EX-VAT/net. The apply_booking_vat trigger
// grosses the booking total up by the listing's VAT rate, so the guest is
// charged the VAT-INCLUSIVE amount. Every guest-facing price MUST therefore be
// displayed VAT-inclusive (SA consumer prices include VAT) so shown == charged.
//
// The booking INSERT still uses the ex-VAT figures (the trigger grosses them);
// these helpers are for DISPLAY only.

/** Effective VAT rate for a listing — 0 unless it's VAT-registered (has a VAT number). */
export function effectiveVatRate(listing: {
  vat_number?: string | null;
  vat_rate?: number | string | null;
}): number {
  if (!listing.vat_number) return 0;
  const rate = Number(listing.vat_rate ?? 0);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** Gross an ex-VAT amount up to VAT-inclusive (unchanged when rate is 0). */
export function grossVat(exVat: number, vatRate: number): number {
  if (!vatRate || vatRate <= 0) return exVat;
  return Math.round(exVat * (100 + vatRate)) / 100;
}

/** The VAT portion added on top of an ex-VAT amount. */
export function vatOf(exVat: number, vatRate: number): number {
  if (!vatRate || vatRate <= 0) return 0;
  return Math.round(exVat * vatRate) / 100;
}
