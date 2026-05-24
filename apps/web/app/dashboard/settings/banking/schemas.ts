import { z } from "zod";

// South African banks. "Other" lets a host type the name themselves —
// covers building societies, foreign banks held in ZA, etc.
export const SA_BANKS = [
  "ABSA",
  "African Bank",
  "Bidvest Bank",
  "Capitec",
  "Discovery Bank",
  "FNB",
  "Investec",
  "Nedbank",
  "Sasfin",
  "Standard Bank",
  "TymeBank",
  "Other",
] as const;

export const ACCOUNT_TYPES = [
  "cheque",
  "savings",
  "transmission",
  "business",
] as const;

export const ACCOUNT_TYPE_LABELS: Record<
  (typeof ACCOUNT_TYPES)[number],
  string
> = {
  cheque: "Cheque / Current",
  savings: "Savings",
  transmission: "Transmission",
  business: "Business",
};

export const bankAccountSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Give this account a label.")
      .max(60, "Label is too long."),
    bank_select: z.enum(SA_BANKS),
    bank_name_other: z
      .string()
      .trim()
      .max(80, "Bank name is too long.")
      .optional()
      .or(z.literal("")),
    account_holder: z
      .string()
      .trim()
      .min(2, "Enter the account holder name.")
      .max(120, "Account holder name is too long."),
    // Empty on edit means "keep the existing encrypted value". The action
    // validates that the field is present on create.
    account_number: z
      .string()
      .trim()
      .max(34, "Account number is too long.")
      .optional()
      .or(z.literal("")),
    account_type: z.enum(ACCOUNT_TYPES),
    branch_code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Branch code is 6 digits."),
    swift_code: z
      .string()
      .trim()
      .max(11, "SWIFT/BIC is at most 11 characters.")
      .optional()
      .or(z.literal("")),
    reference_format: z
      .string()
      .trim()
      .min(1, "Reference format is required.")
      .max(60, "Reference format is too long."),
    is_default: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (val.bank_select === "Other" && !val.bank_name_other) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bank_name_other"],
        message: "Enter the bank name.",
      });
    }
    if (val.account_number && !/^\d{6,16}$/.test(val.account_number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["account_number"],
        message: "Account number must be 6 to 16 digits.",
      });
    }
  });
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const businessDetailsSchema = z.object({
  legal_name: z.string().trim().max(160).optional().or(z.literal("")),
  trading_name: z.string().trim().max(160).optional().or(z.literal("")),
  vat_number: z.string().trim().max(20).optional().or(z.literal("")),
  company_registration_number: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("")),
  billing_address_line1: z
    .string()
    .trim()
    .max(160)
    .optional()
    .or(z.literal("")),
  billing_address_line2: z
    .string()
    .trim()
    .max(160)
    .optional()
    .or(z.literal("")),
  billing_city: z.string().trim().max(80).optional().or(z.literal("")),
  billing_postcode: z.string().trim().max(20).optional().or(z.literal("")),
  billing_country: z
    .string()
    .trim()
    .length(2, "Use a 2-letter country code, e.g. ZA."),
});
export type BusinessDetailsInput = z.infer<typeof businessDetailsSchema>;

export function resolveBankName(input: BankAccountInput): string {
  return input.bank_select === "Other"
    ? (input.bank_name_other ?? "").trim()
    : input.bank_select;
}
