import { z } from "zod";

import { passwordSchema } from "@/lib/auth/password";
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
      "Listed in Wielo Directory",
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
  password: passwordSchema,
  terms: z.boolean().refine((v) => v === true, {
    message: "Please accept the terms to continue.",
  }),
  // "Referred by" partner code (SoT §3.2 rule 6). Prefilled from the referral
  // cookie when present, manually enterable otherwise. Optional; an unknown code
  // simply binds nothing.
  referred_by: z.string().trim().max(60).optional(),
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
// creates the host profile + a Free/trialing subscription.
//
// The mobile wizard flow is Account(mint) → Contact → Profile → Toolkit →
// Welcome. There is NO listing step: the host creates their first listing —
// and captures their business address — later from /dashboard/setup. The
// address fields below are therefore optional; when omitted, the auto-created
// default business simply keeps a blank address until setup fills it in.
export const finalizeOnboardingSchema = z.object({
  // Profile (from Account + Contact + Profile steps) — persisted on user_profiles
  full_name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(6, "Phone is required.")
    .max(40, "Phone is too long."),
  country: z.string().trim().min(2).max(60),
  // ISO-3166 alpha-2 of the host's country + their chosen settlement currency
  // (Model 2 — the currency of record for this host's listings/bookings).
  country_iso: z.string().trim().length(2).toUpperCase().default("ZA"),
  settlement_currency: z.enum(["ZAR", "USD", "EUR", "GBP"]).default("ZAR"),
  bio: z.string().trim().max(240).optional(),
  languages: z.array(z.string().min(1).max(40)).max(20).default([]),
  avatar_url: z.string().url().optional().or(z.literal("")),

  // Business — all OPTIONAL. The mobile wizard drops the listing step, so a
  // host finishes signup with no address; /dashboard/setup captures it before
  // they publish. `businesses` address columns are nullable, so a blank default
  // business is valid. Kept in the schema so a future/partner-prefilled address
  // still flows through if present.
  business_name: z.string().trim().max(160).optional().or(z.literal("")),
  address_line1: z.string().trim().max(200).optional().or(z.literal("")),
  address_line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  region: z.string().trim().max(80).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),

  // Plan — the plan key of the selected product (display + FK fallback). The
  // authoritative product is `product_slug` below; the subscription's plan and
  // product_id are resolved server-side from it.
  plan: z.enum(["free", "basic", "pro", "business"]),
  billing_cycle: z.enum(["monthly", "annual"]),

  // The catalog product the host selected on the plan step. Finalize resolves it
  // server-side: a product with a trial period starts a TRIALING subscription (no
  // card, instant dashboard access); a no-trial product finalizes a Free baseline
  // that the wizard then sends to checkout to upgrade. Optional so the buy-first
  // (purchased_order_token) and competition-trial paths still validate.
  product_slug: z.string().trim().max(120).optional(),

  // When the user paid for a product first (/p/[slug] → pay → signup), the
  // paid order's pay_token is threaded here so finalize links the purchase to
  // the new account (and sets the plan if the product maps to one).
  purchased_order_token: z.string().trim().max(64).optional(),
});

export type FinalizeOnboardingInput = z.infer<typeof finalizeOnboardingSchema>;
