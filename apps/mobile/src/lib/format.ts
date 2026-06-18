// Currency is stored in full units (Rand, not cents) per platform convention.
export function formatMoney(
  amount: number | null | undefined,
  currency = "ZAR",
): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatDateRange(
  checkIn?: string | null,
  checkOut?: string | null,
): string {
  if (!checkIn || !checkOut) return "Dates to confirm";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const a = new Date(checkIn).toLocaleDateString("en-ZA", opts);
  const b = new Date(checkOut).toLocaleDateString("en-ZA", opts);
  return `${a} – ${b}`;
}
