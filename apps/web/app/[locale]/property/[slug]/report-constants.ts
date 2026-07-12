// Shared constants for the "Report this listing" flow. Kept OUT of the
// "use server" action file — a "use server" module may only export async
// functions, so plain data lives here (imported by both the client modal and
// the server action).

export const REPORT_REASONS = [
  { value: "scam", label: "Scam or fraud" },
  { value: "not_real", label: "Not a real listing" },
  { value: "inappropriate", label: "Inappropriate or offensive content" },
  { value: "safety", label: "Safety concern" },
  { value: "spam", label: "Spam or duplicate" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
