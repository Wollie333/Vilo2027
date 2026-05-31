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
    suffix: "per person / night",
    hint: "× guests · pick nights",
  },
  per_stay: { label: "Per booking", suffix: "per booking", hint: "flat, once" },
  per_night: { label: "Per night", suffix: "per night", hint: "pick nights" },
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

/** Per-night add-ons: the guest-chosen quantity IS the number of nights. */
export function isPerNightModel(model: PricingModel): boolean {
  return model === "per_night" || model === "per_guest_per_night";
}

// Line subtotal. The quantity already carries the night count for per-night
// models, so there is NO separate nights multiplier — only the per-guest /
// per-couple scaling is automatic. Server is authoritative; this mirror drives
// the cart UI breakdown. Keep in sync with the SQL compute_addon_subtotal.
export function computeAddonSubtotal(
  model: PricingModel,
  unitPrice: number,
  quantity: number,
  guests: number,
): number {
  const guestFactor =
    model === "per_guest" || model === "per_guest_per_night"
      ? guests
      : model === "per_couple"
        ? Math.ceil(guests / 2)
        : 1;
  return unitPrice * quantity * guestFactor;
}

/**
 * The quantity an add-on starts at when selected. Per-night add-ons default to
 * the whole stay (every night); everything else defaults to the host minimum.
 */
export function defaultAddonQuantity(
  model: PricingModel,
  minQuantity: number,
  nights: number,
): number {
  const min = Math.max(minQuantity, 1);
  if (isPerNightModel(model)) return Math.max(min, nights || 1);
  return min;
}

/**
 * Constrain a desired quantity to what the add-on + stay actually allow.
 * Fixed (allowCustom = false) add-ons are pinned to the default. Otherwise the
 * quantity is floored at the host minimum and capped by the stay length (for
 * per-night add-ons), the host maximum, and remaining stock.
 */
export function clampAddonQuantity(
  model: PricingModel,
  desired: number,
  opts: {
    minQuantity: number;
    maxQuantity?: number | null;
    nights: number;
    stock?: number | null;
    allowCustom: boolean;
  },
): number {
  if (!opts.allowCustom) {
    return defaultAddonQuantity(model, opts.minQuantity, opts.nights);
  }
  const min = Math.max(opts.minQuantity, 1);
  let max = Infinity;
  if (isPerNightModel(model)) max = Math.min(max, Math.max(opts.nights, 1));
  if (opts.maxQuantity != null) max = Math.min(max, opts.maxQuantity);
  if (opts.stock != null) max = Math.min(max, opts.stock);
  // A min above the cap (e.g. min 3 but only 2 in stock) collapses to the cap.
  const lo = Math.min(min, max);
  return Math.max(lo, Math.min(desired, max));
}

export const addonInputSchema = z.object({
  name: z.string().trim().min(1, "Add a name.").max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  pricing_model: pricingModelSchema,
  unit_price: z.number().min(0).max(1_000_000),
  currency: z.string().trim().min(3).max(3).default("ZAR"),
  min_quantity: z.number().int().min(0).max(99).default(1),
  max_quantity: z.number().int().min(0).max(99).nullable().optional(),
  allow_custom_quantity: z.boolean().default(true),
  stock_quantity: z.number().int().min(0).max(99999).nullable().optional(),
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
