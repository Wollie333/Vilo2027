import { z } from "zod";

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

export const EXPERIENCE_TYPES = [
  { value: "tour", label: "Tour" },
  { value: "activity", label: "Activity" },
  { value: "workshop", label: "Class" },
  { value: "transfer", label: "Transfer" },
  { value: "other", label: "Other" },
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
    value: "business" as const,
    name: "Business",
    monthly: 999,
    annual: 9990,
    tag: null,
    blurb: "Teams, experiences, exports.",
    features: [
      "Everything in Pro",
      "Staff accounts",
      "CSV exports + reporting",
      "Priority placement in directory",
    ],
  },
];

// ─── Step schemas ─────────────────────────────────────────────

export const accountSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(120, "Name is too long."),
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
    .max(40)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[\d\s+]{6,}$/.test(v), {
      message: "Use digits and spaces only.",
    }),
  country: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(240, "Keep it under 240 characters.").optional(),
  languages: z.array(z.string().min(1).max(40)).max(20).default([]),
});
export type AboutInput = z.infer<typeof aboutSchema>;

export const offerSchema = z.object({
  offering: z.enum(["accommodation", "experiences", "both"]),
});
export type OfferInput = z.infer<typeof offerSchema>;

export const listingSchema = z
  .object({
    listing_name: z
      .string()
      .trim()
      .min(2, "Listing needs a name.")
      .max(200, "Listing name is too long."),
    listing_kind: z.enum(["accommodation", "experience"]),
    accommodation_type: z
      .enum([
        "guesthouse",
        "bb",
        "self_catering",
        "lodge",
        "hotel",
        "cottage",
        "villa",
      ])
      .optional(),
    experience_type: z
      .enum(["tour", "activity", "workshop", "transfer", "other"])
      .optional(),
    city: z.string().trim().min(2, "Which city?").max(120),
    region: z.string().trim().min(2).max(80),
    max_guests: z.number().int().min(1).max(50).optional(),
    duration_hours: z.number().min(0).max(48).optional(),
    rate: z.number().min(1, "Enter a starting rate.").max(1_000_000),
  })
  .refine((d) => d.listing_kind !== "accommodation" || !!d.accommodation_type, {
    path: ["accommodation_type"],
    message: "Pick an accommodation type.",
  })
  .refine((d) => d.listing_kind !== "experience" || !!d.experience_type, {
    path: ["experience_type"],
    message: "Pick an experience type.",
  });
export type ListingInput = z.infer<typeof listingSchema>;

export const planSchema = z.object({
  plan: z.enum(["free", "basic", "pro", "business"]),
  billing_cycle: z.enum(["monthly", "annual"]),
});
export type PlanInput = z.infer<typeof planSchema>;

// Full payload sent to finalizeOnboardingAction. The Account step is its own
// action (creates auth user); finalize collects everything else and creates
// the host profile + first listing + free subscription.
export const finalizeOnboardingSchema = z
  .object({
    // Profile (from Account + About steps)
    full_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(40).optional(),
    country: z.string().trim().min(2).max(60),
    bio: z.string().trim().max(240).optional(),
    languages: z.array(z.string().min(1).max(40)).max(20).default([]),

    // Offer
    offering: z.enum(["accommodation", "experiences", "both"]),

    // Listing
    listing_name: z.string().trim().min(2).max(200),
    listing_kind: z.enum(["accommodation", "experience"]),
    accommodation_type: z
      .enum([
        "guesthouse",
        "bb",
        "self_catering",
        "lodge",
        "hotel",
        "cottage",
        "villa",
      ])
      .optional(),
    experience_type: z
      .enum(["tour", "activity", "workshop", "transfer", "other"])
      .optional(),
    city: z.string().trim().min(2).max(120),
    region: z.string().trim().min(2).max(80),
    max_guests: z.number().int().min(1).max(50).optional(),
    duration_hours: z.number().min(0).max(48).optional(),
    rate: z.number().min(1).max(1_000_000),

    // Plan — accepted but always forced to "free" server-side for now (payment
    // wiring lands later).
    plan: z.enum(["free", "basic", "pro", "business"]),
    billing_cycle: z.enum(["monthly", "annual"]),
  })
  .refine((d) => d.listing_kind !== "accommodation" || !!d.accommodation_type, {
    path: ["accommodation_type"],
    message: "Pick an accommodation type.",
  })
  .refine((d) => d.listing_kind !== "experience" || !!d.experience_type, {
    path: ["experience_type"],
    message: "Pick an experience type.",
  });

export type FinalizeOnboardingInput = z.infer<typeof finalizeOnboardingSchema>;
