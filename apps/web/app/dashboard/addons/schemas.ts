import { z } from "zod";

export const PRICING_MODELS = [
  { value: "per_stay" as const, label: "Per stay (flat)" },
  { value: "per_night" as const, label: "Per night" },
  { value: "per_guest" as const, label: "Per guest" },
  { value: "per_guest_per_night" as const, label: "Per guest / night" },
  { value: "per_couple" as const, label: "Per couple" },
];

export const pricingModelSchema = z.enum([
  "per_stay",
  "per_night",
  "per_guest",
  "per_guest_per_night",
  "per_couple",
]);
export type PricingModel = z.infer<typeof pricingModelSchema>;

export const PRICING_LABEL: Record<PricingModel, string> = {
  per_stay: "per stay",
  per_night: "per night",
  per_guest: "per guest",
  per_guest_per_night: "per guest / night",
  per_couple: "per couple",
};

// Compute the same line subtotal the SQL helper does. Server is authoritative;
// this mirror is only for the cart UI breakdown.
export function computeAddonSubtotal(
  model: PricingModel,
  unitPrice: number,
  quantity: number,
  nights: number,
  guests: number,
): number {
  const multiplier =
    model === "per_stay"
      ? 1
      : model === "per_night"
        ? nights
        : model === "per_guest"
          ? guests
          : model === "per_guest_per_night"
            ? nights * guests
            : Math.ceil(guests / 2);
  return unitPrice * quantity * multiplier;
}

export const addonInputSchema = z.object({
  name: z.string().trim().min(1, "Add a name.").max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  pricing_model: pricingModelSchema,
  unit_price: z.number().min(0).max(1_000_000),
  currency: z.string().trim().min(3).max(3).default("ZAR"),
  min_quantity: z.number().int().min(0).max(99).default(1),
  max_quantity: z.number().int().min(0).max(99).nullable().optional(),
  is_required: z.boolean().default(false),
  is_active: z.boolean().default(true),
  lead_time_days: z.number().int().min(0).max(365).default(0),
});
export type AddonInput = z.infer<typeof addonInputSchema>;

export const listingAddonInputSchema = z.object({
  room_id: z.string().uuid().nullable(),
  unit_price_override: z.number().min(0).max(1_000_000).nullable(),
});
export type ListingAddonInput = z.infer<typeof listingAddonInputSchema>;
