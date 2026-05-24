import { z } from "zod";

export const createBookingSchema = z
  .object({
    listing_id: z.string().uuid(),
    scope: z.enum(["whole_listing", "rooms"]).default("whole_listing"),
    room_ids: z.array(z.string().uuid()).optional(),
    check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date."),
    check_out: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date."),
    guests: z.coerce.number().int().min(1).max(50),
    payment_method: z.enum(["paystack"]),
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
      (Array.isArray(d.room_ids) && d.room_ids.length > 0),
    {
      message: "Select at least one room.",
      path: ["room_ids"],
    },
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
