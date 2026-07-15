import { z } from "zod";

// A booking/quote line item. Two flavours share the shape:
//  - configured add-on  → addon_id set; server re-prices from the catalog
//    (unit_price/label/pricing_model the client sends are advisory only).
//  - custom fee/charge   → addon_id null; host-entered label + price are trusted
//    (it's the host's own listing — e.g. early check-in, pet deposit).
export const addonLineSchema = z.object({
  label: z.string().trim().min(1, "Label is required.").max(200),
  quantity: z.coerce.number().min(0.01, "Must be > 0").max(10000),
  unit_price: z.coerce.number().min(0, "Must be ≥ 0").max(1000000),
  addon_id: z.string().uuid().nullable().optional(),
  pricing_model: z.string().max(40).optional(),
  // 'age' = derived child/infant/pet charge (recomputed, not hand-edited).
  kind: z.enum(["custom", "catalog", "age"]).optional(),
});
export type AddonLineInput = z.infer<typeof addonLineSchema>;

// A picked room with the price captured at quote/booking time.
export const roomLineSchema = z.object({
  room_id: z.string().uuid(),
  base_amount: z.coerce.number().min(0).max(1000000),
  cleaning_fee: z.coerce.number().min(0).max(1000000).default(0),
});
export type RoomLineInput = z.infer<typeof roomLineSchema>;

// Shared base for the quote create/update forms. (Manual booking has its own
// schema below — this base is quote-only, so relaxing it is safe.)
//
// Quote types: 'accommodation' is today's calendar-integrated quote (listing +
// dates required); 'custom' is a line-item quote with NO listing/calendar; and
// 'upload' attaches a finished file. Listing + dates are therefore OPTIONAL at
// the field level and only ENFORCED for accommodation quotes (superRefine below).
export const quoteOrBookingBaseSchema = z
  .object({
    quote_type: z
      .enum(["accommodation", "custom", "upload"])
      .default("accommodation"),

    property_id: z.string().uuid().nullable().optional(),

    // Headline for custom/upload quotes (no listing name to fall back on).
    title: z.string().trim().max(200).optional().or(z.literal("")),

    // Uploaded-quote file (quote_type = 'upload') — path in the private
    // quote-uploads bucket + original filename.
    attachment_path: z.string().max(500).optional().or(z.literal("")),
    attachment_name: z.string().max(200).optional().or(z.literal("")),

    guest_name: z.string().trim().min(1, "Guest name is required.").max(200),
    guest_email: z.string().trim().email("Must be a valid email."),
    guest_phone: z.string().trim().max(40).optional().or(z.literal("")),

    check_in: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .nullable()
      .optional(),
    check_out: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .nullable()
      .optional(),

    headcount: z.coerce.number().int().min(1).max(100).default(1),
    scope: z.enum(["whole_listing", "rooms"]).nullable().optional(),

    base_amount: z.coerce.number().min(0).max(10000000),
    cleaning_fee: z.coerce.number().min(0).max(1000000).default(0),
    currency: z.string().min(3).max(3).default("ZAR"),

    // How the host priced it — itemised (line-by-line) or a single negotiated
    // total. Persisted so the editor reopens in the right mode.
    price_mode: z.enum(["itemised", "single"]).optional().default("itemised"),

    rooms: z.array(roomLineSchema).max(50).default([]),
    addons: z.array(addonLineSchema).max(50).default([]),

    // Optional quote-level discount (shown as its own line; the server computes
    // the rand value and subtracts it from the total).
    discount_type: z.enum(["percent", "fixed"]).nullable().optional(),
    discount_value: z.coerce.number().min(0).max(1000000).optional().default(0),
    discount_reason: z.string().trim().max(200).optional().or(z.literal("")),

    // Deposit terms — how the guest secures the quote.
    deposit_type: z
      .enum(["deposit", "full", "reserve"])
      .optional()
      .default("full"),
    deposit_pct: z.coerce.number().min(0).max(100).optional().default(50),
    balance_due_days: z.coerce
      .number()
      .int()
      .min(0)
      .max(365)
      .optional()
      .default(7),

    // Party split {adults, children, infants, pets} — drives age/pet pricing.
    guests_breakdown: z
      .object({
        adults: z.coerce.number().int().min(0).max(100).default(0),
        children: z.coerce.number().int().min(0).max(100).default(0),
        infants: z.coerce.number().int().min(0).max(100).default(0),
        pets: z.coerce.number().int().min(0).max(100).default(0),
      })
      .optional(),

    notes: z.string().trim().max(4000).optional().or(z.literal("")),
  })
  // Accommodation quotes need a listing + valid dates + (for per-room) rooms.
  // Custom/upload quotes don't — they're line-item / file offers with no calendar.
  .superRefine((v, ctx) => {
    if (v.quote_type === "upload" && !v.attachment_path) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Upload the quote file first.",
        path: ["attachment_path"],
      });
    }
    if (v.quote_type !== "accommodation") return;
    if (!v.property_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick a listing.",
        path: ["property_id"],
      });
    }
    if (!v.check_in || !v.check_out) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set check-in and check-out dates.",
        path: ["check_out"],
      });
    } else if (v.check_out <= v.check_in) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Check-out must be after check-in.",
        path: ["check_out"],
      });
    }
    if (v.scope === "rooms" && v.rooms.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick at least one room for a per-room quote.",
        path: ["rooms"],
      });
    }
  });

export const createQuoteSchema = quoteOrBookingBaseSchema.and(
  z.object({
    /** Looking For post ID to link this quote to a guest request */
    looking_for_post_id: z.string().uuid().optional(),
  }),
);
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const updateQuoteSchema = quoteOrBookingBaseSchema;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

// Manual booking adds a payment hint.
export const manualBookingSchema = z
  .object({
    property_id: z.string().uuid(),

    guest_name: z.string().trim().min(1).max(200),
    guest_email: z.string().trim().email(),
    guest_phone: z.string().trim().max(40).optional().or(z.literal("")),

    check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

    headcount: z.coerce.number().int().min(1).max(100),
    scope: z.enum(["whole_listing", "rooms"]),

    base_amount: z.coerce.number().min(0).max(10000000),
    cleaning_fee: z.coerce.number().min(0).max(1000000).default(0),
    currency: z.string().min(3).max(3).default("ZAR"),

    rooms: z.array(roomLineSchema).max(50).default([]),
    addons: z.array(addonLineSchema).max(50).default([]),

    notes: z.string().trim().max(4000).optional().or(z.literal("")),

    payment_state: z.enum(["paid", "unpaid", "send_paystack_link"]),
    payment_note: z.string().trim().max(400).optional().or(z.literal("")),

    // Notes & extras. special_requests → guest-facing; internal_note →
    // booking_notes (host/staff only).
    internal_note: z.string().trim().max(4000).optional().or(z.literal("")),
  })
  .refine((v) => v.check_out > v.check_in, {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  })
  .refine((v) => v.scope !== "rooms" || v.rooms.length > 0, {
    message: "Pick at least one room.",
    path: ["rooms"],
  });

export type ManualBookingInput = z.infer<typeof manualBookingSchema>;

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "converted";

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Converted",
};

export const INVOICE_STATUS_LABEL = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  cancelled: "Cancelled",
} as const;
export type InvoiceStatus = keyof typeof INVOICE_STATUS_LABEL;

// ─── Credit notes ─────────────────────────────────────────────
export const CREDIT_NOTE_STATUS_LABEL = {
  draft: "Draft",
  issued: "Issued",
  cancelled: "Cancelled",
} as const;
export type CreditNoteStatus = keyof typeof CREDIT_NOTE_STATUS_LABEL;

// Host creates a credit note against an invoice (manual flow).
export const createCreditNoteSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive("Must be > 0").max(10000000),
  reason: z.string().trim().min(1, "Reason is required.").max(300),
});
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
