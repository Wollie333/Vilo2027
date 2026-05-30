import { z } from "zod";

export const createBookingSchema = z
  .object({
    listing_id: z.string().uuid(),
    // Accommodation: "whole_listing" | "rooms". Experience: "experience".
    scope: z
      .enum(["whole_listing", "rooms", "experience"])
      .default("whole_listing"),
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
    // Accommodation path — required when scope ≠ "experience".
    check_in: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date.")
      .optional(),
    check_out: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date.")
      .optional(),
    // Experience path — required when scope = "experience".
    session_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid session date/time.")
      .optional(),
    guests: z.coerce.number().int().min(1).max(50),
    payment_method: z.enum(["paystack", "eft"]),
    // Guest contact details — snapshotted onto the booking so the host's
    // booking card shows complete info even for a brand-new guest account.
    guest_name: z.string().trim().min(1).max(120).optional(),
    guest_email: z.string().trim().email().max(160).optional(),
    guest_phone: z.string().trim().max(40).optional(),
    special_requests: z.string().trim().max(1000).optional(),
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
  })
  .refine(
    (d) =>
      d.scope === "whole_listing" ||
      d.scope === "experience" ||
      (Array.isArray(d.room_ids) && d.room_ids.length > 0),
    {
      message: "Select at least one room.",
      path: ["room_ids"],
    },
  )
  .refine(
    (d) =>
      d.scope === "experience"
        ? typeof d.session_date === "string"
        : typeof d.check_in === "string" && typeof d.check_out === "string",
    {
      message: "Missing dates for this booking.",
      path: ["session_date"],
    },
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
