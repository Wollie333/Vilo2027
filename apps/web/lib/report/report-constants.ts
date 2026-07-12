// Shared constants for the report/flag flow (listings, deals, users). Kept OUT of
// the "use server" action module (which may only export async functions) so the
// client modal and the server action can both import this plain data.

export const REPORT_REASONS = [
  { value: "scam", label: "Scam or fraud" },
  { value: "not_real", label: "Fake or misleading" },
  { value: "inappropriate", label: "Inappropriate or offensive content" },
  { value: "safety", label: "Safety concern" },
  { value: "spam", label: "Spam or duplicate" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const REPORT_TARGET_TYPES = ["listing", "deal", "user"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** Per-target wording so ONE modal reads correctly wherever it's placed. */
export const REPORT_TARGET_META: Record<
  ReportTargetType,
  { noun: string; triggerLabel: string; adminLabel: string }
> = {
  listing: {
    noun: "listing",
    triggerLabel: "Report this listing",
    adminLabel: "Listing",
  },
  deal: { noun: "deal", triggerLabel: "Report this deal", adminLabel: "Deal" },
  user: { noun: "user", triggerLabel: "Report this user", adminLabel: "User" },
};
