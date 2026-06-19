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

// --- Brand Studio (logos, identity, colours, typography, buttons) ---

export const LOGO_STYLES = ["wordmark", "mark", "icon"] as const;

// Brand asset slots — each maps to a flat key on the brand jsonb and a storage
// path prefix. Kept flat (no nested `logos` object) so patchSiteJson's shallow
// merge never clobbers a sibling path. `primary`/`favicon` reuse the legacy
// `logo_path`/`favicon_path` keys (no data migration).
export const BRAND_ASSET_SLOTS = [
  "primary",
  "light",
  "icon",
  "favicon",
  "apple",
] as const;
export type BrandAssetSlot = (typeof BRAND_ASSET_SLOTS)[number];

export const BRAND_ASSET_KEYS: Record<BrandAssetSlot, string> = {
  primary: "logo_path",
  light: "logo_light_path",
  icon: "logo_icon_path",
  favicon: "favicon_path",
  apple: "apple_icon_path",
};

const socialUrl = z.string().trim().max(300).optional();

export const SITE_FONTS = [
  "sans",
  "serif",
  "elegant",
  "grotesk",
  "editorial",
] as const;
export const SITE_RADII = ["none", "sm", "md", "lg", "xl"] as const;
export const SITE_PRESET_NAMES = [
  "classic",
  "modern",
  "coastal",
  "warm",
  "minimal",
  "nightfall",
] as const;
export const SITE_BUTTON_STYLES = ["solid", "outline"] as const;

const hexOrEmpty = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "invalid_hex")
  .or(z.literal(""))
  .default("");

// Per-role colour overrides — each blank value means "inherit the preset" and is
// dropped before writing the theme jsonb (so buildSiteVars falls back).
export const siteColorsSchema = z
  .object({
    bg: hexOrEmpty,
    surface: hexOrEmpty,
    ink: hexOrEmpty,
    mute: hexOrEmpty,
    line: hexOrEmpty,
    accent: hexOrEmpty,
    secondary: hexOrEmpty,
  })
  // Zod 4: an all-defaulted object has a fully-required output type, so the
  // outer default must be a full literal (every role blank = inherit preset).
  .default({
    bg: "",
    surface: "",
    ink: "",
    mute: "",
    line: "",
    accent: "",
    secondary: "",
  });

// Typography overrides. Fonts blank = inherit preset family; the numeric fields
// always carry a concrete (bounded) value defaulting to the type system defaults.
export const siteTypeSchema = z
  .object({
    headingFont: z.enum(SITE_FONTS).or(z.literal("")).default(""),
    bodyFont: z.enum(SITE_FONTS).or(z.literal("")).default(""),
    headingWeight: z.number().int().min(300).max(800).default(600),
    bodyWeight: z.number().int().min(300).max(800).default(400),
    baseSize: z.number().min(12).max(22).default(16),
    scale: z.number().min(1).max(1.6).default(1.2),
    headingLeading: z.number().min(1).max(2).default(1.15),
    bodyLeading: z.number().min(1).max(2).default(1.6),
    headingTracking: z.number().min(-0.05).max(0.1).default(-0.01),
    bodyTracking: z.number().min(-0.05).max(0.1).default(0),
  })
  // Zod 4: full literal default (mirrors the per-field defaults above).
  .default({
    headingFont: "",
    bodyFont: "",
    headingWeight: 600,
    bodyWeight: 400,
    baseSize: 16,
    scale: 1.2,
    headingLeading: 1.15,
    bodyLeading: 1.6,
    headingTracking: -0.01,
    bodyTracking: 0,
  });

// One Brand Studio save — patches the brand (identity) + theme (design) columns.
// Asset paths (logos/favicons) persist on upload via the asset actions, not here.
export const brandStudioSchema = z.object({
  websiteId: z.string().uuid(),
  // Identity (brand jsonb)
  name: z.string().trim().max(120).default(""),
  tagline: z.string().trim().max(200).default(""),
  logoStyle: z.enum(LOGO_STYLES).default("mark"),
  logoMaxHeight: z.number().int().min(28).max(64).default(40),
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
  // Design (theme jsonb)
  preset: z.enum(SITE_PRESET_NAMES),
  colors: siteColorsSchema,
  palette: z
    .array(
      z
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/),
    )
    .max(12)
    .default([]),
  type: siteTypeSchema,
  radius: z.enum(SITE_RADII).or(z.literal("")).default(""),
  buttonStyle: z.enum(SITE_BUTTON_STYLES).default("solid"),
});

export type BrandStudioInput = z.infer<typeof brandStudioSchema>;
export type SiteColorsInput = z.infer<typeof siteColorsSchema>;
export type SiteTypeInput = z.infer<typeof siteTypeSchema>;

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
  featured: z.boolean().default(false),
  badge: z.string().trim().max(40).default(""),
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

// Per-property display overrides (Phase 7) → website_properties.display_overrides
// jsonb. Blank values inherit (no group header for that property).
export const websitePropertyOverrideSchema = z.object({
  propertyId: z.string().uuid(),
  heading: z.string().trim().max(120).default(""),
  intro: z.string().trim().max(600).default(""),
  heroPath: z.string().trim().max(500).default(""),
});

export const saveWebsiteRoomsSchema = z.object({
  websiteId: z.string().uuid(),
  // Rooms in their final display order — sort_order is derived from the index.
  rooms: z.array(websiteRoomSchema).max(500),
  properties: z.array(websitePropertyOverrideSchema).max(100).default([]),
});

export type SaveWebsiteRoomsInput = z.infer<typeof saveWebsiteRoomsSchema>;

// --- Blog (W11) ---

export const BLOG_POST_STATUSES = ["draft", "published", "scheduled"] as const;

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
  featured: z.boolean().default(false),
  // ISO datetime for a scheduled post (the cron worker publishes it at this time).
  publishAt: z.string().trim().max(40).default(""),
  coverPath: z.string().trim().max(500).default(""),
  excerpt: z.string().trim().max(300).default(""),
  bodyHtml: z.string().max(50000).default(""),
  // Reusable author profile (website_blog_authors row), or "" for none.
  authorId: z.string().uuid().or(z.literal("")).default(""),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(200).default(""),
});

export type SaveBlogPostInput = z.infer<typeof saveBlogPostSchema>;

// Reusable blog authors (Phase 8) — reconciled like categories. `id` present for
// existing rows, absent for new ones (the action assigns it).
export const blogAuthorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "required").max(120),
  avatarPath: z.string().trim().max(500).default(""),
  bio: z.string().trim().max(600).default(""),
});

export const saveBlogAuthorsSchema = z.object({
  websiteId: z.string().uuid(),
  authors: z.array(blogAuthorSchema).max(50),
});

export type SaveBlogAuthorsInput = z.infer<typeof saveBlogAuthorsSchema>;

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

// --- Settings (Phase 5) ---

// Site-wide settings stored in host_websites.settings jsonb. First occupant: the
// contact-form enquiry email — when enabled, a website contact-form submission is
// also emailed to `enquiryEmailTo` (the submission always lands in the inbox
// regardless). An empty/disabled address simply means inbox-only.
export const websiteSettingsSchema = z.object({
  websiteId: z.string().uuid(),
  enquiryEmailEnabled: z.boolean().default(false),
  enquiryEmailTo: z
    .string()
    .trim()
    .max(160)
    .email("invalid_email")
    .or(z.literal(""))
    .default(""),
});

export type WebsiteSettingsInput = z.infer<typeof websiteSettingsSchema>;

// --- Multi-page management (Phase 6) ---

export const PAGE_TEMPLATES = ["blank", "about", "contact"] as const;

export const createPageSchema = z.object({
  websiteId: z.string().uuid(),
  title: z.string().trim().min(1, "required").max(120),
  template: z.enum(PAGE_TEMPLATES).default("blank"),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

// One page's nav state as edited in the manager — order is derived from the array
// index, so a reorder persists. `navLabel` blank falls back to the page title.
export const pageNavSchema = z.object({
  id: z.string().uuid(),
  navLabel: z.string().trim().max(60).default(""),
  showInNav: z.boolean(),
});

export const savePagesSchema = z.object({
  websiteId: z.string().uuid(),
  pages: z.array(pageNavSchema).max(60),
});

export type SavePagesInput = z.infer<typeof savePagesSchema>;

// Per-page SEO overrides (Phase 6) → website_pages.seo_overrides jsonb. Empty
// strings mean "inherit the site-level SEO" and are stored as undefined.
export const savePageSeoSchema = z.object({
  websiteId: z.string().uuid(),
  pageId: z.string().uuid(),
  title: z.string().trim().max(70).default(""),
  description: z.string().trim().max(200).default(""),
});

export type SavePageSeoInput = z.infer<typeof savePageSeoSchema>;
