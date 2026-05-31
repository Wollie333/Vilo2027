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
  // Coerce "" → null in the form (defaults + submit) before this runs — an
  // empty string fails .uuid() and would block the whole form.
  category_id: z.string().uuid().nullable().optional(),
  // Legacy text columns — written server-side from the chosen leaf slug,
  // not edited by the host. Kept in the schema so the patch payload is
  // accepted without a strict enum after the taxonomy cutover.
  accommodation_type: z.string().nullable().optional(),
  experience_type: z.string().nullable().optional(),
  // Rich-text HTML — sanitised server-side. Nullable + no length cap: a
  // previously saved long/null description would otherwise fail validation as
  // "Invalid input" and silently block the whole form (incl. name changes).
  description: z.string().nullable().optional(),
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
  private_group_price: numericString(),
  currency: z.string().trim().min(3, "Use a 3-letter code.").max(3),
});
export type PricingInput = z.infer<typeof pricingSchema>;

export const logisticsSchema = z.object({
  duration_minutes: numericString("Duration must be a number."),
  max_participants: numericString(),
  min_participants: numericString(),
  meeting_point: z.string().trim().max(500).optional().or(z.literal("")),
  what_to_bring: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type LogisticsInput = z.infer<typeof logisticsSchema>;

// Schedule jsonb shape. Either recurring weekly slots (day_of_week 0-6 = Sun-Sat
// + one or more HH:MM times per day) OR specific date+time entries.
const dayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

export const scheduleRecurringSchema = z.object({
  kind: z.literal("recurring"),
  days: z
    .array(
      z.object({
        day_of_week: dayOfWeekSchema,
        times: z.array(timeSchema).min(1, "Add at least one time.").max(24),
      }),
    )
    .max(7),
});

export const scheduleSpecificSchema = z.object({
  kind: z.literal("specific"),
  dates: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
        time: timeSchema,
      }),
    )
    .max(365),
});

export const scheduleSchema = z.union([
  scheduleRecurringSchema,
  scheduleSpecificSchema,
]);
export type ScheduleInput = z.infer<typeof scheduleSchema>;

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

// ── Bed kinds + capacities — single source of truth in roomBeds.ts ───
export {
  BED_KINDS,
  BED_CAPACITY,
  bedKindSchema,
  bedInputSchema,
  bedKindLabel,
  roomCapacityFromBeds,
  type BedKind,
  type BedInput,
} from "./roomBeds";

// What the create/update Server Actions accept for a room — strict numerics
// after the form converts strings, no nullable wrappers.
export const roomPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  bathrooms: z.number().int().nullable().optional(),
  max_guests: z.number().int().min(1).max(50).optional(),
  // Per-room minimums — guests required + nights required (default 1).
  min_guests: z.number().int().min(1).max(50).optional(),
  min_nights: z.number().int().min(1).max(365).optional(),
  base_price: z.number().min(0).max(1000000).optional(),
  weekend_price: z.number().nullable().optional(),
  cleaning_fee: z.number().min(0).max(1000000).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  // ── Pricing model (enterprise rooms) ────────────────────────
  pricing_mode: z
    .enum(["per_room", "per_person", "per_room_plus_extra"])
    .optional(),
  price_per_person: z.number().min(0).max(1000000).nullable().optional(),
  base_occupancy: z.number().int().min(1).max(50).nullable().optional(),
  extra_guest_price: z.number().min(0).max(1000000).nullable().optional(),
  // ── Drill-in editor fields ──────────────────────────────────
  room_size_sqm: z.number().min(0).max(10000).nullable().optional(),
  bed_type: z.string().max(40).nullable().optional(),
  view_type: z.string().max(40).nullable().optional(),
  experiences: z.array(z.string().max(60)).max(20).optional(),
  // ── Enterprise fields (migration 20260524000007) ────────────
  has_ensuite_bathroom: z.boolean().optional(),
  smoking_allowed: z.boolean().optional(),
  pets_allowed: z.boolean().optional(),
  wheelchair_accessible: z.boolean().optional(),
  private_entrance: z.boolean().optional(),
  floor_number: z.number().int().min(-5).max(200).nullable().optional(),
  inventory_count: z.number().int().min(1).max(99).optional(),
});
export type RoomPatch = z.infer<typeof roomPatchSchema>;

// What the saveListingPatch action accepts — a subset of listings columns.
export const patchSchema = z.object({
  name: z.string().trim().min(3).max(200).optional(),
  category_id: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().uuid().nullable().optional(),
  ),
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
  private_group_price: z.number().nullable().optional(),
  currency: z.string().optional(),

  check_in_time: z.string().nullable().optional(),
  check_out_time: z.string().nullable().optional(),
  cancellation_policy: z.enum(["flexible", "moderate", "strict"]).optional(),
  house_rules: z.string().nullable().optional(),

  instant_booking: z.boolean().optional(),

  // Experience-only — accommodation listings keep these null.
  duration_minutes: z.number().int().nullable().optional(),
  max_participants: z.number().int().nullable().optional(),
  min_participants: z.number().int().nullable().optional(),
  meeting_point: z.string().nullable().optional(),
  what_to_bring: z.string().nullable().optional(),
  schedule: z.union([scheduleSchema, z.null()]).optional(),
});
export type PatchInput = z.infer<typeof patchSchema>;
