import { z } from "zod";

// Shared schema for the host Tracking hub (Insights → Tracking). Mirrors the
// per-field validation used by the website settings/analytics forms so the same
// ids are accepted everywhere. All ids are optional (blank clears them). The
// Meta Conversions API token is write-only (blank keeps the stored one).

export const trackingSchema = z.object({
  websiteId: z.string().uuid(),
  metaPixel: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d{6,20}$/, "Enter a numeric Meta Pixel ID.")
    .or(z.literal("")),
  ga4: z
    .string()
    .trim()
    .max(20)
    .regex(/^G-[A-Z0-9]{4,}$/i, "GA4 ids look like G-XXXXXXX.")
    .or(z.literal("")),
  gtm: z
    .string()
    .trim()
    .max(20)
    .regex(/^GTM-[A-Z0-9]{4,}$/i, "GTM ids look like GTM-XXXXXX.")
    .or(z.literal("")),
  tiktok: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Z0-9]{10,}$/i, "Enter a valid TikTok Pixel ID.")
    .or(z.literal("")),
  googleAds: z
    .string()
    .trim()
    .max(20)
    .regex(/^AW-[0-9]{6,}$/i, "Google Ads ids look like AW-123456789.")
    .or(z.literal("")),
  cookieConsentEnabled: z.boolean(),
  cookieConsentMessage: z.string().trim().max(300),
  privacyHref: z.string().trim().max(300),
  // Meta Conversions API (server-side). Token is a secret, encrypted at rest,
  // write-only from the form — blank means "keep the current token".
  metaCapiEnabled: z.boolean(),
  metaCapiToken: z.string().trim().max(400),
});

export type TrackingInput = z.infer<typeof trackingSchema>;
