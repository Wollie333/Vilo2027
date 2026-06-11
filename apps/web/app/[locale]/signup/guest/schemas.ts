import { z } from "zod";

import {
  COUNTRIES,
  LANGUAGE_OPTIONS,
  accountSchema as hostAccountSchema,
} from "@/app/[locale]/signup/host/schemas";

// SA cities surfaced as preferred-cities chips on Step 3. Extend freely —
// the column stores arbitrary text[].
export const SA_CITIES = [
  "Cape Town",
  "Johannesburg",
  "Durban",
  "Pretoria",
  "Port Elizabeth",
  "Stellenbosch",
  "Hermanus",
  "Knysna",
  "George",
  "East London",
  "Bloemfontein",
  "Plettenberg Bay",
] as const;

export { COUNTRIES, LANGUAGE_OPTIONS };

// Re-export the host accountSchema verbatim — same shape works for guests.
export const accountSchema = hostAccountSchema;
export type AccountInput = z.infer<typeof accountSchema>;

export const guestProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[\d\s+]{6,}$/.test(v), {
      message: "Use digits and spaces only.",
    }),
  country: z.string().trim().max(60).optional().or(z.literal("")),
  bio: z.string().trim().max(240, "Keep it under 240 characters.").optional(),
  languages: z.array(z.string().min(1).max(40)).max(20).default([]),
  avatar_url: z.string().url().optional().or(z.literal("")),
});
export type GuestProfileInput = z.infer<typeof guestProfileSchema>;

export const guestPrefsSchema = z.object({
  preferred_cities: z.array(z.string().min(1).max(80)).max(20).default([]),
  marketing_opt_in: z.boolean().default(false),
});
export type GuestPrefsInput = z.infer<typeof guestPrefsSchema>;

// Full payload to finalizeGuestOnboardingAction — combines steps 2 + 3.
export const finalizeGuestOnboardingSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
  bio: z.string().trim().max(240).optional().or(z.literal("")),
  languages: z.array(z.string().min(1).max(40)).max(20).default([]),
  avatar_url: z.string().url().optional().or(z.literal("")),
  preferred_cities: z.array(z.string().min(1).max(80)).max(20).default([]),
  marketing_opt_in: z.boolean().default(false),
});
export type FinalizeGuestOnboardingInput = z.infer<
  typeof finalizeGuestOnboardingSchema
>;
