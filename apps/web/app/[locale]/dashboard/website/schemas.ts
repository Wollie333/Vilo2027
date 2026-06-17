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

// --- Rooms tab (W9) ---

// One room's channel state. Empty display_* strings mean "inherit the live room
// value" and are stored as NULL. `display_price` is cosmetic only — the Book CTA
// always re-prices server-side via the booking engine (ledger invariant intact).
export const websiteRoomSchema = z.object({
  roomId: z.string().uuid(),
  isVisible: z.boolean(),
  displayName: z.string().trim().max(120).default(""),
  displayPrice: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "invalid_price")
    .or(z.literal(""))
    .default(""),
  displayCurrency: z.string().trim().max(3).default(""),
  displayDesc: z.string().trim().max(600).default(""),
});

export const saveWebsiteRoomsSchema = z.object({
  websiteId: z.string().uuid(),
  // Rooms in their final display order — sort_order is derived from the index.
  rooms: z.array(websiteRoomSchema).max(500),
});

export type SaveWebsiteRoomsInput = z.infer<typeof saveWebsiteRoomsSchema>;
