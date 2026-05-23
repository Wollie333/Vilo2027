import { z } from "zod";

export const createBookingSchema = z.object({
  listing_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date."),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date."),
  guests: z.coerce.number().int().min(1).max(50),
  payment_method: z.enum(["paystack"]),
  policy_acknowledged: z.boolean().refine((v) => v === true, {
    message: "You must accept the policies to book.",
  }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
