import type { CheckInMethod, PolicyType } from "./schemas";

// Shared, minimal policy shape consumed by the editor sheet, the policy picker
// and the onboarding wizard. The richer card used by the Policies Library grid
// (PolicyLibrary.PolicyCard) is structurally a superset of this.
//
// The fields beyond the original eleven are OPTIONAL so older callers (the
// setup wizard) that don't load them still satisfy the type; the library and
// editor populate them when present.
export type PolicyCard = {
  id: string;
  type: PolicyType;
  name: string;
  summary: string | null;
  preset: string | null;
  locked: boolean;
  isNonRefundable: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  rules: { days_before: number; refund_percent: number; label: string }[];
  bodyHtml: string | null;

  // Editor-relevant extras (added with the Policies Library rework).
  checkInMethod?: CheckInMethod | null;
  petsAllowed?: boolean | null;
  smokingAllowed?: boolean | null;
  partiesAllowed?: boolean | null;
  childrenWelcome?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};
