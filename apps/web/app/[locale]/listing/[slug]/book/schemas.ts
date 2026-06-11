import { z } from "zod";

export const createBookingSchema = z
  .object({
    listing_id: z.string().uuid(),
    // Accommodation: "whole_listing" | "rooms".
    scope: z.enum(["whole_listing", "rooms"]).default("whole_listing"),
    room_ids: z.array(z.string().uuid()).optional(),
    // Per-room guest counts (rooms scope) — drives per-person / extra-guest
    // pricing and per-room capacity. Server re-validates against bed capacity.
    room_guests: z
      .array(
        z.object({
          room_id: z.string().uuid(),
          guests: z.number().int().min(1).max(50),
        }),
      )
      .optional(),
    // Accommodation path — check-in / check-out dates.
    check_in: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date.")
      .optional(),
    check_out: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date.")
      .optional(),
    guests: z.coerce.number().int().min(1).max(50),
    // Party split for age-based pricing. `guests` stays the headcount that
    // counts toward capacity (adults + children); these add the priced extras.
    children: z.coerce.number().int().min(0).max(50).optional().default(0),
    infants: z.coerce.number().int().min(0).max(50).optional().default(0),
    pets: z.coerce.number().int().min(0).max(50).optional().default(0),
    payment_method: z.enum(["paystack", "eft"]),
    // Guest contact details — snapshotted onto the booking so the host's
    // booking card shows complete info even for a brand-new guest account.
    guest_name: z.string().trim().min(1).max(120).optional(),
    guest_email: z.string().trim().email().max(160).optional(),
    guest_phone: z.string().trim().max(40).optional(),
    special_requests: z.string().trim().max(1000).optional(),
    // Optional party manifest — adding party members is optional, but each named
    // guest needs a name AND email so they become their own contactable guest
    // record (host_contacts is deduped by email). Phone stays optional. The
    // client drops fully-empty rows before submit; partial rows are rejected.
    additional_guests: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Each guest needs a name.").max(120),
          email: z
            .string()
            .trim()
            .email("Each guest needs a valid email.")
            .max(160),
          phone: z.string().trim().max(40).optional().or(z.literal("")),
        }),
      )
      .max(50)
      .optional(),
    policy_acknowledged: z.boolean().refine((v) => v === true, {
      message: "You must accept the policies to book.",
    }),
    selected_addons: z
      .array(
        z.object({
          addon_id: z.string().uuid(),
          quantity: z.number().int().min(0).max(99),
        }),
      )
      .optional()
      .default([]),
    // Optional coupon code — server re-validates + re-prices; never trusted.
    coupon_code: z.string().trim().max(40).optional(),
  })
  .refine(
    (d) =>
      d.scope === "whole_listing" ||
      (Array.isArray(d.room_ids) && d.room_ids.length > 0),
    {
      message: "Select at least one room.",
      path: ["room_ids"],
    },
  )
  .refine(
    (d) => typeof d.check_in === "string" && typeof d.check_out === "string",
    {
      message: "Missing dates for this booking.",
      path: ["check_in"],
    },
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
