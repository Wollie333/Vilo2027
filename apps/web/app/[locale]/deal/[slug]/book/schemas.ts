import { z } from "zod";

// Validated input for the special checkout. A special is a pre-packaged deal, so
// the property + room + price + (for fixed deals) the dates are all fixed by the
// special — the guest only supplies their stay window (flexible deals), party
// size, any optional add-ons, contact details and payment method. Everything is
// re-resolved + re-priced server-side; the client total is advisory only.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.");

export const createSpecialBookingSchema = z.object({
  special_id: z.string().uuid(),
  // Entry surface — recorded on the booking for reporting (S6).
  booked_via: z.enum(["platform", "website"]).default("platform"),

  // Flexible deals: the guest's chosen stay inside the window. Ignored (and
  // forced to the special's dates) for fixed deals.
  check_in: isoDate.optional(),
  check_out: isoDate.optional(),

  guests: z.coerce.number().int().min(1).max(100),

  payment_method: z.enum(["paystack", "eft", "paypal"]),

  // Contact snapshot so the host's booking card is complete even for a brand-new
  // guest account (created inline at checkout).
  guest_name: z.string().trim().min(1).max(120).optional(),
  guest_email: z.string().trim().email().max(160).optional(),
  guest_phone: z.string().trim().max(40).optional(),
  special_requests: z.string().trim().max(1000).optional(),

  // Optional upsell add-ons the guest chose (by addon id). Compulsory add-ons are
  // always bundled server-side regardless of this list.
  selected_addons: z.array(z.string().uuid()).max(20).optional().default([]),

  // Optional party manifest — mirrors the main checkout so a deal booked through
  // the unified BookingForm keeps its named guests. Each row needs a name; an
  // email (if given) must be valid, and a named+emailed row becomes its own
  // contactable guest record (materialised by _materialize_booking_party, which
  // skips emailless rows). Fully-empty rows are dropped client-side.
  additional_guests: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Each guest needs a name.").max(120),
        email: z
          .string()
          .trim()
          .email("Enter a valid email or leave it blank.")
          .max(160)
          .optional()
          .or(z.literal("")),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
      }),
    )
    .max(50)
    .optional(),

  policy_acknowledged: z.boolean().refine((v) => v === true, {
    message: "You must accept the policies to book.",
  }),
});

export type CreateSpecialBookingInput = z.infer<
  typeof createSpecialBookingSchema
>;
