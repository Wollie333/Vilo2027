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

// ─── Payment gateways (host's own Paystack / PayPal) ──────────────
export const PAYMENT_GATEWAYS = ["paystack", "paypal"] as const;
export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

export const PAYMENT_GATEWAY_LABELS: Record<PaymentGateway, string> = {
  paystack: "Paystack",
  paypal: "PayPal",
};

export const CURRENCIES = ["ZAR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Card-network statement descriptors are short (≈22 chars) and alphanumeric.
const DESCRIPTOR_RE = /^[A-Za-z0-9 .,&'-]*$/;

export const paymentGatewaySchema = z
  .object({
    // The business this gateway belongs to (gateways are per-business).
    business_id: z.string().uuid("Pick a business."),
    gateway: z.enum(PAYMENT_GATEWAYS),
    environment: z.enum(["test", "live"]),
    // Paystack public key (pk_…) / PayPal client id. Not secret.
    public_identifier: z
      .string()
      .trim()
      .min(8, "Enter the public key / client id.")
      .max(300, "That value is too long."),
    // Empty on edit means "keep the stored secret". Required on create
    // (enforced in the action).
    secret: z.string().trim().max(400).optional().or(z.literal("")),
    // Paystack only: word shown on the guest's bank statement.
    statement_descriptor: z
      .string()
      .trim()
      .max(22, "Keep it under 22 characters — banks truncate longer.")
      .regex(DESCRIPTOR_RE, "Letters, numbers and spaces only.")
      .optional()
      .or(z.literal("")),
    is_enabled: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (
      val.gateway === "paystack" &&
      val.public_identifier &&
      !val.public_identifier.startsWith("pk_")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["public_identifier"],
        message: "Paystack public keys start with pk_.",
      });
    }
    if (
      val.secret &&
      val.gateway === "paystack" &&
      !val.secret.startsWith("sk_")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secret"],
        message: "Paystack secret keys start with sk_.",
      });
    }
  });
export type PaymentGatewayInput = z.infer<typeof paymentGatewaySchema>;

// Paystack with BOTH test + live keys stored + an active `mode`. Secrets blank on
// edit = "keep stored". Prefix checks ensure each slot gets the right key.
const optStr = z.string().trim().max(400).optional().or(z.literal(""));
export const paystackGatewaySchema = z
  .object({
    business_id: z.string().uuid("Pick a business."),
    mode: z.enum(["test", "live"]),
    test_public_identifier: optStr,
    test_secret: optStr,
    live_public_identifier: optStr,
    live_secret: optStr,
    statement_descriptor: z
      .string()
      .trim()
      .max(22, "Keep it under 22 characters — banks truncate longer.")
      .regex(DESCRIPTOR_RE, "Letters, numbers and spaces only.")
      .optional()
      .or(z.literal("")),
    is_enabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const check = (
      val: string | undefined,
      path: string,
      prefix: string,
      label: string,
    ) => {
      if (val && !val.startsWith(prefix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: `${label} must start with ${prefix}`,
        });
      }
    };
    check(
      v.test_public_identifier,
      "test_public_identifier",
      "pk_test_",
      "Test public key",
    );
    check(v.test_secret, "test_secret", "sk_test_", "Test secret key");
    check(
      v.live_public_identifier,
      "live_public_identifier",
      "pk_live_",
      "Live public key",
    );
    check(v.live_secret, "live_secret", "sk_live_", "Live secret key");
  });
export type PaystackGatewayInput = z.infer<typeof paystackGatewaySchema>;

export const defaultCurrencySchema = z.object({
  default_currency: z.enum(CURRENCIES),
});
export type DefaultCurrencyInput = z.infer<typeof defaultCurrencySchema>;

export const paymentLinkSchema = z.object({
  amount: z.coerce
    .number({ error: "Enter an amount." })
    .positive("Enter an amount above 0.")
    .max(1_000_000, "That amount is too large."),
  email: z.string().trim().email("Enter the customer's email."),
  description: z.string().trim().max(120).optional().or(z.literal("")),
});
export type PaymentLinkInput = z.infer<typeof paymentLinkSchema>;
