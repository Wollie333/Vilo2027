import { z } from "zod";

// Free-form addon line item: label + qty * unit_price.
export const addonLineSchema = z.object({
  label: z.string().trim().min(1, "Label is required.").max(200),
  quantity: z.coerce.number().min(0.01, "Must be > 0").max(10000),
  unit_price: z.coerce.number().min(0, "Must be ≥ 0").max(1000000),
});
export type AddonLineInput = z.infer<typeof addonLineSchema>;

// A picked room with the price captured at quote/booking time.
export const roomLineSchema = z.object({
  room_id: z.string().uuid(),
  base_amount: z.coerce.number().min(0).max(1000000),
  cleaning_fee: z.coerce.number().min(0).max(1000000).default(0),
});
export type RoomLineInput = z.infer<typeof roomLineSchema>;

// Shared base for quote create + manual booking create.
export const quoteOrBookingBaseSchema = z
  .object({
    listing_id: z.string().uuid(),

    guest_name: z.string().trim().min(1, "Guest name is required.").max(200),
    guest_email: z.string().trim().email("Must be a valid email."),
    guest_phone: z.string().trim().max(40).optional().or(z.literal("")),

    check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),

    headcount: z.coerce.number().int().min(1).max(100),
    scope: z.enum(["whole_listing", "rooms"]),

    base_amount: z.coerce.number().min(0).max(10000000),
    cleaning_fee: z.coerce.number().min(0).max(1000000).default(0),
    currency: z.string().min(3).max(3).default("ZAR"),

    rooms: z.array(roomLineSchema).max(50).default([]),
    addons: z.array(addonLineSchema).max(50).default([]),

    notes: z.string().trim().max(4000).optional().or(z.literal("")),
  })
  .refine((v) => v.check_out > v.check_in, {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  })
  .refine((v) => v.scope !== "rooms" || v.rooms.length > 0, {
    message: "Pick at least one room for a per-room quote.",
    path: ["rooms"],
  });

export const createQuoteSchema = quoteOrBookingBaseSchema;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const updateQuoteSchema = quoteOrBookingBaseSchema;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

// Manual booking adds a payment hint.
export const manualBookingSchema = z
  .object({
    listing_id: z.string().uuid(),

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
