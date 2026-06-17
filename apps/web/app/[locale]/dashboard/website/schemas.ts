import { z } from "zod";

import { sectionsSchema } from "@/lib/website/sections.schema";

export const createWebsiteSchema = z.object({
  businessId: z.string().uuid(),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "too_short")
    .max(63, "too_long"),
});

export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;

// --- Brand & Theme (W7) ---

export const brandSchema = z.object({
  websiteId: z.string().uuid(),
  name: z.string().trim().max(120).default(""),
  tagline: z.string().trim().max(200).default(""),
});

export type BrandInput = z.infer<typeof brandSchema>;

export const SITE_FONTS = ["sans", "serif", "elegant"] as const;
export const SITE_RADII = ["none", "sm", "md", "lg", "xl"] as const;
export const SITE_PRESET_NAMES = [
  "classic",
  "modern",
  "coastal",
  "warm",
  "minimal",
] as const;

// Empty strings on accent/font/radius mean "inherit from the preset" — they are
// stripped to `undefined` before writing the theme jsonb so `buildSiteVars`
// falls back to the preset's own value.
export const themeSchema = z.object({
  websiteId: z.string().uuid(),
  preset: z.enum(SITE_PRESET_NAMES),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "invalid_accent")
    .or(z.literal(""))
    .default(""),
  font: z.enum(SITE_FONTS).or(z.literal("")).default(""),
  radius: z.enum(SITE_RADII).or(z.literal("")).default(""),
});

export type ThemeInput = z.infer<typeof themeSchema>;

// --- Section builder (W8) ---

export const saveDraftSectionsSchema = z.object({
  websiteId: z.string().uuid(),
  pageId: z.string().uuid(),
  sections: sectionsSchema,
});

export type SaveDraftSectionsInput = z.infer<typeof saveDraftSectionsSchema>;
