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

// Richer copy for the add-on editor's "How is it charged?" picker.
export const PRICING_MODEL_META: Record<
  PricingModel,
  { label: string; suffix: string; hint: string }
> = {
  per_guest_per_night: {
    label: "Per person",
    suffix: "per person",
    hint: "× guests × nights",
  },
  per_stay: { label: "Per booking", suffix: "per booking", hint: "flat, once" },
  per_night: { label: "Per night", suffix: "per night", hint: "× nights" },
  per_guest: { label: "Per guest", suffix: "per guest", hint: "× guests" },
  per_couple: { label: "Per couple", suffix: "per couple", hint: "× couples" },
};

// Add-on categories — group extras in the guest list + archive filters.
export const ADDON_CATEGORIES = [
  { value: "food_drink", label: "Food & drink" },
  { value: "comfort", label: "Comfort" },
  { value: "experiences", label: "Experiences" },
  { value: "transport", label: "Transport" },
  { value: "romance", label: "Romance" },
  { value: "flexibility", label: "Flexibility" },
] as const;
export type AddonCategory = (typeof ADDON_CATEGORIES)[number]["value"];
export const addonCategorySchema = z.enum([
  "food_drink",
  "comfort",
  "experiences",
  "transport",
  "romance",
  "flexibility",
]);
export const ADDON_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  ADDON_CATEGORIES.map((c) => [c.value, c.label]),
);

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
  category: addonCategorySchema.nullable().optional(),
  vat_included: z.boolean().default(false),
  daily_capacity: z.number().int().min(0).max(9999).nullable().optional(),
});
export type AddonInput = z.infer<typeof addonInputSchema>;

export const listingAddonInputSchema = z.object({
  room_id: z.string().uuid().nullable(),
  unit_price_override: z.number().min(0).max(1_000_000).nullable(),
});
export type ListingAddonInput = z.infer<typeof listingAddonInputSchema>;
