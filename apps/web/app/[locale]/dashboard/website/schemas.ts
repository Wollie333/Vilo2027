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

export const LOGO_STYLES = ["wordmark", "mark", "icon"] as const;

const socialUrl = z.string().trim().max(300).optional();

export const brandSchema = z.object({
  websiteId: z.string().uuid(),
  name: z.string().trim().max(120).default(""),
  tagline: z.string().trim().max(200).default(""),
  logoStyle: z.enum(LOGO_STYLES).default("mark"),
  contactEmail: z.string().trim().max(160).default(""),
  contactPhone: z.string().trim().max(60).default(""),
  socials: z
    .object({
      instagram: socialUrl,
      facebook: socialUrl,
      x: socialUrl,
      youtube: socialUrl,
      linkedin: socialUrl,
      website: socialUrl,
    })
    .default({}),
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

// --- Blog (W11) ---

export const BLOG_POST_STATUSES = ["draft", "published"] as const;

// One category as edited in the list — `id` is present for existing rows, absent
// for newly-added ones (the action assigns it). Slug is derived from the name.
export const blogCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "required").max(60),
});

export const saveBlogCategoriesSchema = z.object({
  websiteId: z.string().uuid(),
  categories: z.array(blogCategorySchema).max(30),
});

export type SaveBlogCategoriesInput = z.infer<typeof saveBlogCategoriesSchema>;

// A blog post's editable fields. `slug` may be blank — the action derives it from
// the title and guarantees per-website uniqueness. `status` is independent of the
// site publish (a post goes live the moment it's published, plan §1).
export const saveBlogPostSchema = z.object({
  websiteId: z.string().uuid(),
  postId: z.string().uuid(),
  title: z.string().trim().min(1, "required").max(200),
  slug: z.string().trim().toLowerCase().max(80).default(""),
  categoryId: z.string().uuid().or(z.literal("")).default(""),
  status: z.enum(BLOG_POST_STATUSES),
  coverPath: z.string().trim().max(500).default(""),
  excerpt: z.string().trim().max(300).default(""),
  bodyHtml: z.string().max(50000).default(""),
  authorName: z.string().trim().max(120).default(""),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(200).default(""),
});

export type SaveBlogPostInput = z.infer<typeof saveBlogPostSchema>;

// --- Custom domain (W13) ---

// `domain` is validated/normalised in the action via lib/website/domain.ts; the
// schema only guards the shape so a malformed payload fails fast.
export const connectDomainSchema = z.object({
  websiteId: z.string().uuid(),
  domain: z.string().trim().min(3).max(253),
});

export type ConnectDomainInput = z.infer<typeof connectDomainSchema>;

// --- SEO (W14) ---

// `seo` jsonb on host_websites. og_image_path is a website-assets storage path
// (uploaded browser→Storage, like the logo). robots_index/sitemap_enabled
// default to true (a published site is indexable + has a sitemap unless the
// host opts out). gsc_token is the Google Search Console verification token.
export const seoSchema = z.object({
  websiteId: z.string().uuid(),
  title: z.string().trim().max(70).default(""),
  description: z.string().trim().max(200).default(""),
  ogImagePath: z.string().trim().max(500).default(""),
  gscToken: z.string().trim().max(120).default(""),
  robotsIndex: z.boolean().default(true),
  sitemapEnabled: z.boolean().default(true),
});

export type SeoInput = z.infer<typeof seoSchema>;
