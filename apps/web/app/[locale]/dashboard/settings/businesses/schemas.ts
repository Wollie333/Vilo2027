import { z } from "zod";

import { DISPLAY_CURRENCIES } from "@/lib/currency";

// Locales a business can default to for its guest-facing documents/emails.
// Keep in sync with apps/web/i18n/routing.ts (next-intl locale list).
export const BUSINESS_LOCALES = ["en", "af", "fr", "de", "pt"] as const;
export type BusinessLocale = (typeof BUSINESS_LOCALES)[number];

export const BUSINESS_LOCALE_LABELS: Record<BusinessLocale, string> = {
  en: "English",
  af: "Afrikaans",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
};

// The social accounts a business can list. Single source of truth for the
// settings form, the persisted `social_links` keys, and the guest-facing card.
export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/you" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/you" },
  { key: "x", label: "X (Twitter)", placeholder: "x.com/you" },
  { key: "tiktok", label: "TikTok", placeholder: "tiktok.com/@you" },
  { key: "youtube", label: "YouTube", placeholder: "youtube.com/@you" },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "linkedin.com/company/you",
  },
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["key"];

const socialValue = z.string().trim().max(200).optional().or(z.literal(""));
export const socialLinksSchema = z.object({
  instagram: socialValue,
  facebook: socialValue,
  x: socialValue,
  tiktok: socialValue,
  youtube: socialValue,
  linkedin: socialValue,
});
export type SocialLinksInput = z.infer<typeof socialLinksSchema>;

// Each business is a legal entity. Its details print on every quote/invoice/
// credit note for the listings assigned to it. Address is named the listing
// way so the LocationPicker output maps 1:1; lat/lng come straight from the
// picker as numbers.
export const businessProfileSchema = z.object({
  trading_name: z
    .string()
    .trim()
    .min(1, "Give the business a name.")
    .max(160, "Name is too long."),
  legal_name: z.string().trim().max(160).optional().or(z.literal("")),
  vat_number: z.string().trim().max(20).optional().or(z.literal("")),
  company_registration_number: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("")),
  address_line1: z.string().trim().max(200).optional().or(z.literal("")),
  address_line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  municipality: z.string().trim().max(160).optional().or(z.literal("")),
  province: z.string().trim().max(120).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().length(2, "Use a 2-letter country code, e.g. ZA."),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  default_currency: z.enum(DISPLAY_CURRENCIES),
  default_language: z.enum(BUSINESS_LOCALES),
  // Guest-facing web presence — belongs to the business, like its banking.
  website_url: z
    .string()
    .trim()
    .max(300, "URL is too long.")
    .optional()
    .or(z.literal("")),
  social_links: socialLinksSchema.optional(),
});
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

// The account holder's private physical address. Internal use only — never
// shown to guests or printed on documents.
export const personalAddressSchema = z.object({
  address_line1: z.string().trim().max(200).optional().or(z.literal("")),
  address_line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  municipality: z.string().trim().max(160).optional().or(z.literal("")),
  province: z.string().trim().max(120).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().length(2, "Use a 2-letter country code, e.g. ZA."),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});
export type PersonalAddressInput = z.infer<typeof personalAddressSchema>;
