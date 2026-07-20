import { z } from "zod";

import { passwordSchema } from "@/lib/auth/password";
import { nameFields } from "@/lib/profile/name";
import {
  COUNTRIES,
  LANGUAGE_OPTIONS,
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

// Guest account schema. Unlike the host flow, guest signup is PASSWORDLESS by
// default (magic-link) — so `password` is optional. When the user opts to set a
// password, a non-empty value must satisfy the shared password policy; the
// superRefine surfaces the exact policy message on the password field.
export const accountSchema = z.object({
  ...nameFields,
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z
    .string()
    .optional()
    .superRefine((v, ctx) => {
      if (!v) return; // passwordless — nothing to validate
      const r = passwordSchema.safeParse(v);
      if (!r.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: r.error.issues[0]?.message ?? "That password is too weak.",
        });
      }
    }),
  terms: z.boolean().refine((v) => v === true, {
    message: "Please accept the terms to continue.",
  }),
});
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
  // WS-4 host-lead capture: null = not answered, true/false = answered.
  owns_accommodation: z.boolean().nullable().default(null),
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
  owns_accommodation: z.boolean().nullable().default(null),
});
export type FinalizeGuestOnboardingInput = z.infer<
  typeof finalizeGuestOnboardingSchema
>;
