import { z } from "zod";

export const ACCOMMODATION_TYPES = [
  { value: "self_catering", label: "Self-catering cottage" },
  { value: "bb", label: "B&B" },
  { value: "guesthouse", label: "Guesthouse" },
  { value: "lodge", label: "Lodge" },
  { value: "hotel", label: "Hotel" },
  { value: "other", label: "Other" },
] as const;

export const EXPERIENCE_TYPES = [
  { value: "tour", label: "Tour" },
  { value: "activity", label: "Activity" },
  { value: "workshop", label: "Workshop" },
  { value: "transfer", label: "Transfer" },
  { value: "other", label: "Other" },
] as const;

export const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;

export const AMENITY_OPTIONS: { key: string; label: string }[] = [
  { key: "wifi", label: "WiFi" },
  { key: "kitchen", label: "Kitchen" },
  { key: "parking", label: "Free parking" },
  { key: "pool", label: "Pool" },
  { key: "hot_tub", label: "Hot tub" },
  { key: "aircon", label: "Air conditioning" },
  { key: "heating", label: "Heating" },
  { key: "fireplace", label: "Fireplace" },
  { key: "tv", label: "TV" },
  { key: "washer", label: "Washing machine" },
  { key: "dryer", label: "Tumble dryer" },
  { key: "workspace", label: "Workspace" },
  { key: "braai", label: "Braai / BBQ" },
  { key: "pet_friendly", label: "Pet friendly" },
  { key: "family_friendly", label: "Family friendly" },
  { key: "wheelchair", label: "Wheelchair accessible" },
  { key: "smoke_alarm", label: "Smoke alarm" },
  { key: "first_aid", label: "First-aid kit" },
  { key: "self_checkin", label: "Self check-in" },
  { key: "host_onsite", label: "Host on-site" },
];

// ── Tab schemas ──────────────────────────────────────────────

export const basicSchema = z.object({
  name: z.string().trim().min(3, "Name is too short.").max(200),
  accommodation_type: z
    .enum(["hotel", "guesthouse", "bb", "self_catering", "lodge", "other"])
    .nullable()
    .optional(),
  experience_type: z
    .enum(["tour", "activity", "workshop", "transfer", "other"])
    .nullable()
    .optional(),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
});
export type BasicInput = z.infer<typeof basicSchema>;

// Numeric fields are kept as strings in the form (HTML inputs return strings)
// and converted to number|null in the submit handler. Loose form schema,
// strict patch action.
const numericString = (msg = "Must be a number.") =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || Number.isFinite(Number(v)), { message: msg });

export const locationSchema = z.object({
  address_line1: z.string().trim().max(200),
  address_line2: z.string().trim().max(200),
  city: z.string().trim().max(120),
  province: z.string().trim().max(120),
  postal_code: z.string().trim().max(20),
  latitude: numericString("Latitude must be a number."),
  longitude: numericString("Longitude must be a number."),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const roomsSchema = z.object({
  bedrooms: numericString(),
  bathrooms: numericString(),
  max_guests: numericString(),
  min_nights: numericString(),
  max_nights: numericString(),
});
export type RoomsInput = z.infer<typeof roomsSchema>;

export const amenitiesSchema = z.object({
  amenities: z.array(z.string()).max(50),
});
export type AmenitiesInput = z.infer<typeof amenitiesSchema>;

export const pricingSchema = z.object({
  base_price: numericString(),
  weekend_price: numericString(),
  cleaning_fee: numericString(),
  currency: z.string().trim().min(3, "Use a 3-letter code.").max(3),
});
export type PricingInput = z.infer<typeof pricingSchema>;

export const policiesSchema = z.object({
  check_in_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM")
    .optional()
    .or(z.literal("")),
  check_out_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM")
    .optional()
    .or(z.literal("")),
  cancellation_policy: z.enum(["flexible", "moderate", "strict"]),
  house_rules: z.string().trim().max(4000).optional().or(z.literal("")),
});
export type PoliciesInput = z.infer<typeof policiesSchema>;

export const settingsSchema = z.object({
  instant_booking: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

// ── Per-room schemas ──────────────────────────────────────────

export const BOOKING_MODES = [
  {
    value: "whole_listing" as const,
    label: "Whole place",
    body: "One booking takes the entire listing for the chosen dates.",
  },
  {
    value: "rooms_only" as const,
    label: "Rooms only",
    body: "Guests must pick a specific room — never the whole place.",
  },
  {
    value: "flexible" as const,
    label: "Both",
    body: "Guests can book a single room or buy out the whole place.",
  },
];

export const bookingModeSchema = z.object({
  booking_mode: z.enum(["whole_listing", "rooms_only", "flexible"]),
});
export type BookingModeInput = z.infer<typeof bookingModeSchema>;

export const roomSchema = z.object({
  name: z.string().trim().min(1, "Room needs a name.").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  bedrooms: numericString(),
  bathrooms: numericString(),
  max_guests: numericString(),
  base_price: numericString(),
  weekend_price: numericString(),
  cleaning_fee: numericString(),
  is_active: z.boolean().default(true),
});
export type RoomInput = z.infer<typeof roomSchema>;

// What the create/update Server Actions accept for a room — strict numerics
// after the form converts strings, no nullable wrappers.
export const roomPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  bathrooms: z.number().int().nullable().optional(),
  max_guests: z.number().int().min(1).max(50).optional(),
  base_price: z.number().min(0).max(1000000).optional(),
  weekend_price: z.number().nullable().optional(),
  cleaning_fee: z.number().min(0).max(1000000).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  // ── Drill-in editor fields ──────────────────────────────────
  room_size_sqm: z.number().min(0).max(10000).nullable().optional(),
  bed_type: z.string().max(40).nullable().optional(),
  view_type: z.string().max(40).nullable().optional(),
  experiences: z.array(z.string().max(60)).max(20).optional(),
});
export type RoomPatch = z.infer<typeof roomPatchSchema>;

// What the saveListingPatch action accepts — a subset of listings columns.
export const patchSchema = z.object({
  name: z.string().trim().min(3).max(200).optional(),
  accommodation_type: z.string().nullable().optional(),
  experience_type: z.string().nullable().optional(),
  description: z.string().nullable().optional(),

  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),

  bedrooms: z.number().int().nullable().optional(),
  bathrooms: z.number().int().nullable().optional(),
  max_guests: z.number().int().nullable().optional(),
  min_nights: z.number().int().nullable().optional(),
  max_nights: z.number().int().nullable().optional(),

  base_price: z.number().nullable().optional(),
  weekend_price: z.number().nullable().optional(),
  cleaning_fee: z.number().nullable().optional(),
  currency: z.string().optional(),

  check_in_time: z.string().nullable().optional(),
  check_out_time: z.string().nullable().optional(),
  cancellation_policy: z.enum(["flexible", "moderate", "strict"]).optional(),
  house_rules: z.string().nullable().optional(),

  instant_booking: z.boolean().optional(),
});
export type PatchInput = z.infer<typeof patchSchema>;
