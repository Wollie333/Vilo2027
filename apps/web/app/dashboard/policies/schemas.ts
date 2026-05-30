import { z } from "zod";

// The host-managed, separately-assignable policy kinds.
export const POLICY_TYPES = [
  { value: "cancellation" as const, label: "Refund terms" },
  { value: "check_in_out" as const, label: "Check-in / Check-out" },
  { value: "house_rules" as const, label: "House rules" },
  { value: "booking_terms" as const, label: "Booking terms" },
  { value: "privacy" as const, label: "Privacy (POPIA)" },
];

export const policyTypeSchema = z.enum([
  "cancellation",
  "check_in_out",
  "house_rules",
  "booking_terms",
  "privacy",
]);
export type PolicyType = z.infer<typeof policyTypeSchema>;

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  cancellation: "Refund terms",
  check_in_out: "Check-in / Check-out",
  house_rules: "House rules",
  booking_terms: "Booking terms",
  privacy: "Privacy (POPIA)",
};

// UI filter buckets shown as chips in the library. booking_terms + privacy
// collapse into one "Terms & privacy" bucket on the page.
export const CHECK_IN_METHODS = ["self", "host", "reception"] as const;
export type CheckInMethod = (typeof CHECK_IN_METHODS)[number];
export const CHECK_IN_METHOD_LABEL: Record<CheckInMethod, string> = {
  self: "Self check-in",
  host: "Host greets you",
  reception: "Reception check-in",
};

// Presets are the locked, un-editable refund options. `custom` = host-authored.
export const PRESETS = [
  "flexible",
  "moderate",
  "strict",
  "non_refundable",
  "custom",
] as const;
export type Preset = (typeof PRESETS)[number];

/** A preset policy is locked (read-only, view/duplicate only) unless it's custom. */
export function isLockedPreset(preset: string | null | undefined): boolean {
  return !!preset && preset !== "custom";
}

const TIME_RE = /^\d{2}:\d{2}$/;

// ─── Refund terms (type: cancellation) ───────────────────────────
export const cancellationRuleSchema = z.object({
  days_before: z.number().int().min(0).max(3650),
  refund_percent: z.number().int().min(0).max(100),
  label: z.string().trim().min(1, "Add a label.").max(60),
});
export type CancellationRule = z.infer<typeof cancellationRuleSchema>;

export const refundPolicyInputSchema = z
  .object({
    name: z.string().trim().min(1, "Add a name.").max(120),
    summary: z.string().trim().max(280).nullable().optional(),
    is_non_refundable: z.boolean().default(false),
    rules: z.array(cancellationRuleSchema).max(12),
    body_html: z.string().max(50_000).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.is_non_refundable && val.rules.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one refund rule, or mark it non-refundable.",
        path: ["rules"],
      });
    }
    // Mirror the DB UNIQUE(policy_id, days_before) constraint.
    const seen = new Set<number>();
    val.rules.forEach((r, i) => {
      if (seen.has(r.days_before)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each rule needs a different days-before value.",
          path: ["rules", i, "days_before"],
        });
      }
      seen.add(r.days_before);
    });
  });
export type RefundPolicyInput = z.infer<typeof refundPolicyInputSchema>;

// ─── Check-in / Check-out (type: check_in_out) ───────────────────
export const checkInOutInputSchema = z.object({
  name: z.string().trim().min(1, "Add a name.").max(120),
  summary: z.string().trim().max(280).nullable().optional(),
  check_in_time: z.string().regex(TIME_RE, "Use HH:MM."),
  check_out_time: z.string().regex(TIME_RE, "Use HH:MM."),
  check_in_method: z.enum(CHECK_IN_METHODS).nullable().optional(),
  body_html: z.string().max(50_000).nullable().optional(),
});
export type CheckInOutInput = z.infer<typeof checkInOutInputSchema>;

// ─── House rules (type: house_rules) ─────────────────────────────
// The boolean flags drive the chips on the card. null = unspecified (no chip).
const triBool = z.boolean().nullable().optional();
export const houseRulesInputSchema = z.object({
  name: z.string().trim().min(1, "Add a name.").max(120),
  summary: z.string().trim().max(280).nullable().optional(),
  pets_allowed: triBool,
  smoking_allowed: triBool,
  parties_allowed: triBool,
  children_welcome: triBool,
  quiet_hours_start: z
    .string()
    .regex(TIME_RE, "Use HH:MM.")
    .nullable()
    .optional(),
  quiet_hours_end: z
    .string()
    .regex(TIME_RE, "Use HH:MM.")
    .nullable()
    .optional(),
  body_html: z.string().trim().min(1, "Write your house rules.").max(50_000),
});
export type HouseRulesInput = z.infer<typeof houseRulesInputSchema>;

// ─── Legal documents (type: booking_terms | privacy) ─────────────
export const legalDocInputSchema = z.object({
  name: z.string().trim().min(1, "Add a name.").max(120),
  summary: z.string().trim().max(280).nullable().optional(),
  body_html: z.string().trim().min(1, "Write the document text.").max(50_000),
});
export type LegalDocInput = z.infer<typeof legalDocInputSchema>;

// Discriminated input passed to createPolicyAction / updatePolicyAction.
export type PolicyInput =
  | { type: "cancellation"; data: RefundPolicyInput }
  | { type: "check_in_out"; data: CheckInOutInput }
  | { type: "house_rules"; data: HouseRulesInput }
  | { type: "booking_terms"; data: LegalDocInput }
  | { type: "privacy"; data: LegalDocInput };

// ─── Assignment ──────────────────────────────────────────────────
export const listingPolicyInputSchema = z.object({
  policy_id: z.string().uuid(),
  room_id: z.string().uuid().nullable(),
});
export type ListingPolicyInput = z.infer<typeof listingPolicyInputSchema>;

/**
 * Mirror of calculate_policy_refund_amount's rule walk, for the editor preview.
 * Rules are sorted by days_before DESC; the first whose threshold is met wins.
 */
export function computeRefundForDays(
  rules: CancellationRule[],
  daysBefore: number,
): { refund_percent: number; label: string | null } {
  const sorted = [...rules].sort((a, b) => b.days_before - a.days_before);
  for (const rule of sorted) {
    if (daysBefore >= rule.days_before) {
      return { refund_percent: rule.refund_percent, label: rule.label };
    }
  }
  return { refund_percent: 0, label: null };
}
