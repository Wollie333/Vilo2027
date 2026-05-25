/**
 * Formatting helpers shared by every email resolver. Keeps currency, dates,
 * and name handling consistent across all 24 templates.
 *
 * All dates default to en-ZA. Currency defaults to ZAR.
 */

export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}

export function lastInitialOf(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return "";
  const last = parts[parts.length - 1] ?? "";
  return last.charAt(0).toUpperCase();
}

export function guestDisplayName(fullName: string | null | undefined): string {
  if (!fullName) return "Your guest";
  const first = firstName(fullName);
  const initial = lastInitialOf(fullName);
  return initial ? `${first} ${initial}.` : first;
}

const ZAR_FORMATTER = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(
  amount: number | string | null | undefined,
  currency = "ZAR",
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  if (!Number.isFinite(num)) return "—";

  if (currency === "ZAR") {
    return ZAR_FORMATTER.format(num).replace(/ /g, " ");
  }
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(num)
    .replace(/ /g, " ");
}

export function formatDateLong(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTimeLong(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function maskAccountNumber(raw: string | null | undefined): string {
  if (!raw) return "•••• ••••";
  const trimmed = raw.replace(/\s+/g, "");
  if (trimmed.length <= 4) return `•••• ${trimmed}`;
  return `•••• ${trimmed.slice(-4)}`;
}

export function planLabel(plan: string | null | undefined): string {
  if (!plan) return "Free";
  switch (plan) {
    case "free":
      return "Free";
    case "basic":
      return "Basic";
    case "pro":
      return "Pro";
    case "business":
      return "Business";
    default:
      return plan.charAt(0).toUpperCase() + plan.slice(1);
  }
}
