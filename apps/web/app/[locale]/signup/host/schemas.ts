import { z } from "zod";

import { nameFields } from "@/lib/profile/name";

// ─── Display data ─────────────────────────────────────────────

export const ACCOMMODATION_TYPES = [
  { value: "guesthouse", label: "Guesthouse" },
  { value: "bb", label: "B&B" },
  { value: "self_catering", label: "Self-catering" },
  { value: "lodge", label: "Lodge" },
  { value: "hotel", label: "Hotel" },
  { value: "cottage", label: "Cottage" },
  { value: "villa", label: "Villa" },
] as const;

export const SA_REGIONS = [
  "Western Cape",
  "Eastern Cape",
  "Northern Cape",
  "KwaZulu-Natal",
  "Gauteng",
  "Mpumalanga",
  "Limpopo",
  "Free State",
  "North West",
] as const;

export const COUNTRIES = [
  "South Africa",
  "Namibia",
  "Botswana",
  "Zimbabwe",
  "Mozambique",
  "eSwatini",
  "Lesotho",
] as const;

export const LANGUAGE_OPTIONS = [
  "English",
  "Afrikaans",
  "isiZulu",
  "isiXhosa",
  "Sesotho",
  "Setswana",
  "Portuguese",
  "French",
] as const;

export const PLANS = [
  {
    value: "free" as const,
    name: "Free",
    monthly: 0,
    annual: 0,
    tag: null,
    blurb: "Get listed — enquiries only.",
    features: [
      "Public profile + 1 listing",
      "Inbox (10 active threads)",
      "Listed in Vilo Directory",
      "No direct payments",
    ],
  },
  {
    value: "basic" as const,
    name: "Basic",
    monthly: 299,
    annual: 2990,
    tag: "14-day free trial",
    blurb: "Accept direct payments.",
    features: [
      "Up to 3 listings",
      "Paystack, PayPal & EFT",
      "Instant booking",
      "Full inbox + read receipts",
    ],
  },
  {
    value: "pro" as const,
    name: "Pro",
    monthly: 599,
    annual: 5990,
    tag: "Most popular",
    blurb: "Run a real booking business.",
    features: [
      "Unlimited listings",
      "Canned replies & templates",
      "Reviews & response manager",
      "iCal sync (Airbnb, Booking.com)",
    ],
  },
  {
    // NOTE: display-only mirror of the DB plan catalog (see lib/plans/getPlans).
    // Kept in sync manually until signup is fully DB-wired in P1.7. Prices must
    // match the `plans`/`plan_prices` seed.
    value: "business" as const,
    name: "Business",
    monthly: 1199,
    annual: 11990,
    tag: null,
    blurb: "Teams, multi-property, exports.",
    features: [
      "Everything in Pro",
      "Staff accounts",
      "CSV exports + reporting",
      "Priority placement in directory",
    ],
  },
];

// ─── Step schemas ─────────────────────────────────────────────

// Account schema — name captured as two fields (single source of truth:
// lib/profile/name), combined into full_name on save. Shared by host AND guest
// signup so the profile structure is identical across the whole app.
export const accountSchema = z.object({
  ...nameFields,
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z
    .string()
    .min(8, "Min 8 characters.")
    .max(72, "Password is too long."),
  terms: z.boolean().refine((v) => v === true, {
    message: "Please accept the terms to continue.",
  }),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const aboutSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(6, "Phone is required.")
    .max(40, "Phone is too long.")
    .refine((v) => /^[\d\s+]{6,}$/.test(v), {
      message: "Use digits, spaces and an optional + prefix.",
    }),
  country: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(240, "Keep it under 240 characters.").optional(),
  languages: z.array(z.string().min(1).max(40)).max(20).default([]),
  avatar_url: z.string().url().optional().or(z.literal("")),
});
export type AboutInput = z.infer<typeof aboutSchema>;

// Signup wizard listing fields. Kept intentionally lean — capacity,
// pricing, photos and amenities all live in the listing editor once
// onboarding completes. We collect: name, the property type, and the
// full address. MVP is accommodation only.
export const listingSchema = z
  .object({
    listing_name: z
      .string()
      .trim()
      .min(2, "Listing needs a name.")
      .max(200, "Listing name is too long."),
    listing_kind: z.literal("accommodation"),
    category_id: z.string().uuid().nullable().optional(),
    // Legacy text column — mirrored from the chosen category slug.
    accommodation_type: z.string().optional(),
    // The host's first business (seeds the auto-created default business). Blank
    // falls back to the host's display name.
    business_name: z.string().trim().max(160).optional().or(z.literal("")),
    address_line1: z
      .string()
      .trim()
      .min(3, "Street address is required.")
      .max(200),
    address_line2: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().min(2, "Which city?").max(120),
    region: z.string().trim().min(2).max(80),
    postal_code: z.string().trim().min(3, "Postal code is required.").max(20),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((d) => !!d.category_id, {
    path: ["category_id"],
    message: "Pick a category.",
  });
export type ListingInput = z.infer<typeof listingSchema>;

export const planSchema = z.object({
  plan: z.enum(["free", "basic", "pro", "business"]),
  billing_cycle: z.enum(["monthly", "annual"]),
});
export type PlanInput = z.infer<typeof planSchema>;

// Full payload sent to finalizeOnboardingAction. The Account step is its
// own action (creates auth user); finalize collects everything else and
// creates the host profile + first listing + free subscription.
//
// No `offering` field — that step was removed; we go straight from About
// to the Listing step where the host seeds their FIRST accommodation
// listing. More listings can be added from the dashboard.
export const finalizeOnboardingSchema = z
  .object({
    // Profile (from Account + About steps) — all persisted on user_profiles
    full_name: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .trim()
      .min(6, "Phone is required.")
      .max(40, "Phone is too long."),
    country: z.string().trim().min(2).max(60),
    bio: z.string().trim().max(240).optional(),
    languages: z.array(z.string().min(1).max(40)).max(20).default([]),
    avatar_url: z.string().url().optional().or(z.literal("")),

    // Listing — only the bare minimum to seed a draft. Capacity, pricing,
    // duration, photos etc. live in the listing editor post-onboarding.
    listing_name: z.string().trim().min(2).max(200),
    listing_kind: z.literal("accommodation"),
    category_id: z.string().uuid().nullable().optional(),
    accommodation_type: z.string().optional(),
    business_name: z.string().trim().max(160).optional().or(z.literal("")),
    address_line1: z.string().trim().min(3).max(200),
    address_line2: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().min(2).max(120),
    region: z.string().trim().min(2).max(80),
    postal_code: z.string().trim().min(3).max(20),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),

    // Plan — accepted but always forced to "free" server-side for now
    // (payment wiring lands later). Surfaced for visibility only.
    plan: z.enum(["free", "basic", "pro", "business"]),
    billing_cycle: z.enum(["monthly", "annual"]),
  })
  .refine((d) => !!d.category_id, {
    path: ["category_id"],
    message: "Pick a category.",
  });

export type FinalizeOnboardingInput = z.infer<typeof finalizeOnboardingSchema>;
