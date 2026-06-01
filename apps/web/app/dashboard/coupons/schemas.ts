import { z } from "zod";

export const COUPON_SCOPES = [
  { value: "order" as const, label: "Whole order" },
  { value: "accommodation" as const, label: "Accommodation only" },
  { value: "addons" as const, label: "Add-ons only" },
];
export type CouponScope = (typeof COUPON_SCOPES)[number]["value"];

const isoDateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .nullable();

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "At least 2 characters.")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only."),
    description: z.string().trim().max(200).nullable().optional(),
    discount_type: z.enum(["percent", "fixed"]),
    discount_value: z
      .number()
      .positive("Must be greater than 0.")
      .max(1_000_000),
    scope: z.enum(["order", "accommodation", "addons"]),
    listing_id: z.string().uuid().nullable(),
    room_id: z.string().uuid().nullable(),
    min_nights: z.number().int().min(1).max(365).nullable(),
    min_spend: z.number().min(0).max(10_000_000).nullable(),
    starts_at: isoDateOrNull,
    ends_at: isoDateOrNull,
    max_redemptions: z.number().int().min(1).max(1_000_000).nullable(),
    per_guest_limit: z.number().int().min(1).max(1000).nullable(),
    is_active: z.boolean().default(true),
  })
  .refine((v) => v.discount_type !== "percent" || v.discount_value <= 100, {
    path: ["discount_value"],
    message: "A percentage can't exceed 100.",
  })
  .refine((v) => v.room_id == null || v.listing_id != null, {
    path: ["room_id"],
    message: "Pick a listing before a room.",
  })
  .refine((v) => v.room_id == null || v.scope === "accommodation", {
    path: ["room_id"],
    message: "Room targeting only applies to accommodation scope.",
  })
  .refine((v) => !v.starts_at || !v.ends_at || v.ends_at >= v.starts_at, {
    path: ["ends_at"],
    message: "End date must be on or after start date.",
  });

export type CouponInput = z.infer<typeof couponInputSchema>;
