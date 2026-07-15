// Shared decline-reason vocabulary — one source for the guest's decline dropdown
// and the host-facing label (email · timeline · thread card · quote view).

export const DECLINE_REASONS = [
  { value: "price_too_high", label: "Price too high" },
  { value: "dates_changed", label: "Dates changed / no longer needed" },
  { value: "chose_another", label: "Chose another host" },
  { value: "location", label: "Location not suitable" },
  { value: "booked_elsewhere", label: "Booked elsewhere" },
  { value: "not_what_i_wanted", label: "Not what I was looking for" },
  { value: "other", label: "Other" },
] as const;

export type DeclineReasonValue = (typeof DECLINE_REASONS)[number]["value"];

const LABELS: Record<string, string> = Object.fromEntries(
  DECLINE_REASONS.map((r) => [r.value, r.label]),
);

/** Human label for a stored decline_reason value (falls back to the raw value). */
export function declineReasonLabel(value: string | null | undefined): string {
  if (!value) return "No reason given";
  return LABELS[value] ?? value;
}
