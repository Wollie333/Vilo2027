import { z } from "zod";

import {
  sectionSchema,
  sectionsSchema,
  type SectionType,
} from "@/lib/website/sections.schema";
import {
  formFieldsSchema,
  formSettingsSchema,
  FORM_TYPES,
} from "@/lib/website/forms.schema";
import { roomDetailOverrideSchema } from "@/lib/website/roomDetailOverride";
import { pageDocSchema } from "@/lib/website/pageDoc.schema";

// Apply a catalogue theme to a site — `themeId` is a site_themes uuid OR a
// "preset:<slug>" id for the built-in presets (pre-migration fallback). `fresh`
// forces a clean seed (ignoring any prior customised version of the theme) — the
// "reset to default" path uses it.
export const applyThemeSchema = z.object({
  websiteId: z.string().uuid(),
  themeId: z.string().trim().min(1).max(80),
  fresh: z.boolean().default(false),
});

export type ApplyThemeInput = z.input<typeof applyThemeSchema>;

// Restore points (Phase 2.5 — design safety net).
export const saveRestorePointSchema = z.object({
  websiteId: z.string().uuid(),
  label: z.string().trim().max(80).default(""),
});
export type SaveRestorePointInput = z.infer<typeof saveRestorePointSchema>;

export const restorePointIdSchema = z.object({
  restorePointId: z.string().uuid(),
});
export type RestorePointIdInput = z.infer<typeof restorePointIdSchema>;

export const resetToDefaultSchema = z.object({
  websiteId: z.string().uuid(),
});
export type ResetToDefaultInput = z.infer<typeof resetToDefaultSchema>;

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

// Setup wizard — one-shot create with theme + palette + brand, then auto-publish.
// Additive to the simple createWebsiteSchema (which the legacy card still uses).
export const createWebsiteWizardSchema = z.object({
  businessId: z.string().uuid(),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "too_short")
    .max(63, "too_long"),
  siteName: z.string().trim().min(1, "too_short").max(120),
  /** Theme catalogue id (uuid) or a `preset:<slug>` fallback id. */
  themeId: z.string().trim().min(1),
  /** Index into generatePalettes() (0-4); ignored when customAccent is set. */
  paletteIndex: z.number().int().min(0).max(4).default(0),
  /** Custom accent hex (#rgb/#rrggbb) — overrides paletteIndex when valid. */
  customAccent: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .optional(),
  logoPath: z.string().trim().max(400).optional(),
  contactEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  contactPhone: z.string().trim().max(40).optional(),
});

export type CreateWebsiteWizardInput = z.infer<
  typeof createWebsiteWizardSchema
>;

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
  "homely",
] as const;
export const SITE_RADII = ["none", "sm", "md", "lg", "xl"] as const;
export const SITE_PRESET_NAMES = ["warm", "coastal"] as const;
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

// Per-element font-size overrides (px). `null` = inherit the modular scale
// (baseSize × scale). Each element can be pinned to an exact size.
export const SIZE_KEYS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "body",
  "accent",
] as const;
export type SizeKey = (typeof SIZE_KEYS)[number];

const sizeOverride = z.number().int().min(8).max(200).nullable().default(null);

export const siteSizesSchema = z
  .object({
    h1: sizeOverride,
    h2: sizeOverride,
    h3: sizeOverride,
    h4: sizeOverride,
    h5: sizeOverride,
    h6: sizeOverride,
    body: sizeOverride,
    accent: sizeOverride,
  })
  .default({
    h1: null,
    h2: null,
    h3: null,
    h4: null,
    h5: null,
    h6: null,
    body: null,
    accent: null,
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
    sizes: siteSizesSchema,
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
    sizes: {
      h1: null,
      h2: null,
      h3: null,
      h4: null,
      h5: null,
      h6: null,
      body: null,
      accent: null,
    },
  });

// Image styling (Brand Studio "Images" section) → theme.image jsonb.
export const SITE_SHADOW_NAMES = ["none", "sm", "md", "lg", "xl"] as const;

export const imageStyleSchema = z
  .object({
    radius: z.number().int().min(0).max(48).default(12),
    borderWidth: z.number().int().min(0).max(12).default(0),
    borderColor: hexOrEmpty,
    shadow: z.enum(SITE_SHADOW_NAMES).default("none"),
  })
  .default({ radius: 12, borderWidth: 0, borderColor: "", shadow: "none" });

export type ImageStyleInput = z.infer<typeof imageStyleSchema>;

// Stage 2 — cards, hero layout, social styling.
export const SITE_CARD_STYLES = ["elevated", "bordered", "flat"] as const;
export const SITE_CARD_RATIOS = ["4:3", "16:9", "1:1", "3:2"] as const;
export const SITE_HERO_LAYOUTS = ["center", "left"] as const;
export const SITE_SOCIAL_SHAPES = ["round", "square"] as const;
export const SITE_SOCIAL_STYLES = ["filled", "outline", "plain"] as const;
export const SITE_HEADER_LAYOUT_NAMES = [
  "classic",
  "centered",
  "split",
  "minimal",
] as const;
export const SITE_FOOTER_LAYOUT_NAMES = [
  "centered",
  "columns",
  "simple",
] as const;

export const cardStyleSchema = z
  .object({
    style: z.enum(SITE_CARD_STYLES).default("elevated"),
    radius: z.number().int().min(0).max(40).default(14),
    shadow: z.enum(SITE_SHADOW_NAMES).default("sm"),
    ratio: z.enum(SITE_CARD_RATIOS).default("4:3"),
  })
  .default({ style: "elevated", radius: 14, shadow: "sm", ratio: "4:3" });

export const socialStyleSchema = z
  .object({
    shape: z.enum(SITE_SOCIAL_SHAPES).default("round"),
    style: z.enum(SITE_SOCIAL_STYLES).default("plain"),
  })
  .default({ shape: "round", style: "plain" });

// Button config for primary + secondary buttons (Phase 2.2).
export const buttonConfigSchema = z
  .object({
    style: z.enum(SITE_BUTTON_STYLES).default("solid"),
    color: hexOrEmpty,
    borderWidth: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    pill: z.boolean().default(false),
  })
  .default({ style: "solid", color: "", borderWidth: 2, pill: false });

export const buttonsSchema = z
  .object({
    primary: buttonConfigSchema,
    secondary: buttonConfigSchema,
  })
  .default({
    primary: { style: "solid", color: "", borderWidth: 2, pill: false },
    secondary: { style: "solid", color: "", borderWidth: 2, pill: false },
  });

export type CardStyleInput = z.infer<typeof cardStyleSchema>;
export type SocialStyleInput = z.infer<typeof socialStyleSchema>;
export type ButtonConfigInput = z.infer<typeof buttonConfigSchema>;
export type ButtonsInput = z.infer<typeof buttonsSchema>;

// One Brand Studio save — patches the brand (identity) + theme (design) columns.
// Asset paths (logos/favicons) persist on upload via the asset actions, not here.
export const brandStudioSchema = z.object({
  websiteId: z.string().uuid(),
  // Identity (brand jsonb)
  name: z.string().trim().max(120).default(""),
  tagline: z.string().trim().max(200).default(""),
  monogram: z.string().trim().max(2).default(""),
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
  // Design (theme jsonb) — `preset` is the theme slug; the server resolves its
  // `base` from the site_themes catalogue on save (never trusts a client base).
  preset: z.string().trim().min(1).max(60).default("warm"),
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
  buttons: buttonsSchema,
  image: imageStyleSchema,
  card: cardStyleSchema,
  heroLayout: z.enum(SITE_HERO_LAYOUTS).default("center"),
  social: socialStyleSchema,
  iconColor: hexOrEmpty,
  header: z
    .object({
      desktop: z.enum(SITE_HEADER_LAYOUT_NAMES).default("classic"),
      mobile: z.enum(SITE_HEADER_LAYOUT_NAMES).default("minimal"),
    })
    .default({ desktop: "classic", mobile: "minimal" }),
  footer: z
    .object({
      desktop: z.enum(SITE_FOOTER_LAYOUT_NAMES).default("centered"),
      mobile: z.enum(SITE_FOOTER_LAYOUT_NAMES).default("centered"),
    })
    .default({ desktop: "centered", mobile: "centered" }),
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

// --- Builder V2 (PageDoc) ---
// The nested-document builder persists a validated PageDoc into the same
// draft/published JSONB columns (parallel build; distinguished by `v:2`).
export const saveBuilderDocSchema = z.object({
  websiteId: z.string().uuid(),
  pageId: z.string().uuid(),
  doc: pageDocSchema,
});
export type SaveBuilderDocInput = z.infer<typeof saveBuilderDocSchema>;

export const publishBuilderDocSchema = z.object({
  websiteId: z.string().uuid(),
  pageId: z.string().uuid(),
});
export type PublishBuilderDocInput = z.infer<typeof publishBuilderDocSchema>;

// Builder V2 Brand Studio — persist the working theme + a brand-identity subset.
// `theme` is the full working SiteThemeConfig (authoritative: replaces the column);
// `brand` is the subset the overlay edits (merged into the brand column so
// logo/contact/other socials are preserved).
export const saveBuilderBrandSchema = z.object({
  websiteId: z.string().uuid(),
  theme: z.record(z.string(), z.unknown()),
  brand: z.object({
    name: z.string().max(120).optional(),
    tagline: z.string().max(200).optional(),
    monogram: z.string().max(4).optional(),
    socials: z
      .object({
        instagram: z.string().max(200).optional(),
        facebook: z.string().max(200).optional(),
        x: z.string().max(200).optional(),
        youtube: z.string().max(200).optional(),
        linkedin: z.string().max(200).optional(),
        website: z.string().max(200).optional(),
      })
      .partial()
      .optional(),
  }),
});
export type SaveBuilderBrandInput = z.infer<typeof saveBuilderBrandSchema>;

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

// Per-room detail overrides (the host's optional customization for ONE room,
// layered over the shared room_detail template). Persists to
// website_rooms.detail_overrides; empty override is stored as NULL (pure template).
export const saveRoomDetailOverrideSchema = z.object({
  websiteId: z.string().uuid(),
  roomId: z.string().uuid(),
  override: roomDetailOverrideSchema,
});
export type SaveRoomDetailOverrideInput = z.infer<
  typeof saveRoomDetailOverrideSchema
>;

// --- Blog (W11) ---

export const BLOG_POST_STATUSES = ["draft", "published", "scheduled"] as const;

// Standard Meta-Pixel/GA4 events a host can fire ON a specific page or blog post
// (e.g. mark the Suites page as a ViewContent, a post as a Lead). "none" = fire
// nothing extra (the site-wide PageView still fires). Curated to the events that
// make sense for a hospitality site — Purchase is auto-fired on booking.
export const PAGE_PIXEL_EVENTS = [
  "none",
  "ViewContent",
  "Lead",
  "Contact",
  "Subscribe",
  "Search",
  "InitiateCheckout",
  "CompleteRegistration",
] as const;

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
  // Free-form tag names — created on save (find-or-create per website by slug)
  // and reconciled onto the post↔tag join. Blank/dupe names are dropped server-side.
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(200).default(""),
  seoFocusKeyword: z.string().trim().max(60).default(""),
  // Per-post custom head code (meta tags / verification / tracking snippets),
  // injected into <head> on the live post page only — parity with per-page
  // headCode. The host's own site, trusted like the site-level pixel/GA4 ids.
  headCode: z.string().trim().max(4000).default(""),
  // Per-post Meta-Pixel/GA4 event fired on the live post page (none = nothing
  // extra beyond the site-wide PageView) — parity with the per-page pixelEvent.
  pixelEvent: z.enum(PAGE_PIXEL_EVENTS).default("none"),
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
  // Site identity — quick-edit of brand.name / brand.tagline from Settings (the
  // same values Brand Studio owns). Empty name is ignored (keeps the current).
  brandName: z.string().trim().max(120).default(""),
  brandTagline: z.string().trim().max(200).default(""),
  enquiryEmailEnabled: z.boolean().default(false),
  enquiryEmailTo: z
    .string()
    .trim()
    .max(160)
    .email("invalid_email")
    .or(z.literal(""))
    .default(""),
  // On-site booking payment methods the host accepts on their website checkout.
  // Default ON — the method still only shows when the host has the capability
  // (a connected Paystack gateway / valid EFT details). Stored under
  // `settings.payments`. Lets a host hide a method without disconnecting it.
  payPaystackEnabled: z.boolean().default(true),
  payEftEnabled: z.boolean().default(true),
  // Conversion chrome (Phase 6A slice 2): floating WhatsApp button + a
  // dismissible announcement bar. Stored under `settings.conversion`.
  whatsappEnabled: z.boolean().default(false),
  whatsappNumber: z.string().trim().max(32).default(""),
  whatsappMessage: z.string().trim().max(300).default(""),
  announcementEnabled: z.boolean().default(false),
  announcementText: z.string().trim().max(200).default(""),
  announcementLinkLabel: z.string().trim().max(60).default(""),
  announcementLinkHref: z.string().trim().max(300).default(""),
  // Pop-up modal (Phase 6A slice 3): trigger rules + frequency cap, with an
  // optional CTA link or an embedded `website_forms` form (e.g. newsletter).
  popupEnabled: z.boolean().default(false),
  popupHeading: z.string().trim().max(120).default(""),
  popupBody: z.string().trim().max(400).default(""),
  popupTrigger: z.enum(["delay", "scroll", "exit"]).default("delay"),
  popupDelaySeconds: z.coerce.number().int().min(0).max(120).default(5),
  popupScrollPercent: z.coerce.number().int().min(5).max(100).default(50),
  popupFrequency: z.enum(["once", "daily", "always"]).default("once"),
  popupCtaLabel: z.string().trim().max(60).default(""),
  popupCtaHref: z.string().trim().max(300).default(""),
  popupFormId: z.string().uuid().or(z.literal("")).default(""),
  // Third-party analytics (host's own GA4 + Meta Pixel), stored under
  // `settings.analytics`. The pixels render on the public tenant site; a POPIA
  // consent gate (default on) holds them until the visitor accepts.
  ga4MeasurementId: z
    .string()
    .trim()
    .max(20)
    .regex(/^G-[A-Z0-9]{4,}$/i, "invalid_ga4")
    .or(z.literal(""))
    .default(""),
  metaPixelId: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d{6,20}$/, "invalid_pixel")
    .or(z.literal(""))
    .default(""),
  gtmId: z
    .string()
    .trim()
    .max(20)
    .regex(/^GTM-[A-Z0-9]{4,}$/i, "invalid_gtm")
    .or(z.literal(""))
    .default(""),
  tiktokId: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Z0-9]{10,}$/i, "invalid_tiktok")
    .or(z.literal(""))
    .default(""),
  googleAdsId: z
    .string()
    .trim()
    .max(20)
    .regex(/^AW-[0-9]{6,}$/i, "invalid_gads")
    .or(z.literal(""))
    .default(""),
  cookieConsentEnabled: z.boolean().default(true),
  cookieConsentMessage: z.string().trim().max(300).default(""),
  privacyPolicyHref: z.string().trim().max(300).default(""),
  // Blog index config — the heading + intro shown atop the generic-theme blog
  // listing page (`/blog`). Stored under `settings.blog`. Blank inherits the
  // built-in defaults ("Blog" / "News, stories and local guides"). The Safari
  // theme's blog index is section-driven, so these apply to generic themes.
  blogHeading: z.string().trim().max(80).default(""),
  blogIntro: z.string().trim().max(200).default(""),
});

export type WebsiteSettingsInput = z.infer<typeof websiteSettingsSchema>;

// Builder V2 — thin, site-wide analytics patch written from the Page Settings
// overlay's Tracking tab. These IDs are SITE-WIDE (one `settings.analytics`
// record for every page); the action merges them, preserving other analytics
// keys. GA4 + Meta ship first; gtm/tiktok/googleAds are added with their
// injection wiring (Tracking plan Phase 4).
export const builderAnalyticsSchema = z.object({
  websiteId: z.string().uuid(),
  ga4: z
    .string()
    .trim()
    .max(20)
    .regex(/^G-[A-Z0-9]{4,}$/i, "invalid_ga4")
    .or(z.literal(""))
    .default(""),
  metaPixel: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d{6,20}$/, "invalid_pixel")
    .or(z.literal(""))
    .default(""),
  gtm: z
    .string()
    .trim()
    .max(20)
    .regex(/^GTM-[A-Z0-9]{4,}$/i, "invalid_gtm")
    .or(z.literal(""))
    .default(""),
  tiktok: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Z0-9]{10,}$/i, "invalid_tiktok")
    .or(z.literal(""))
    .default(""),
  googleAds: z
    .string()
    .trim()
    .max(20)
    .regex(/^AW-[0-9]{6,}$/i, "invalid_gads")
    .or(z.literal(""))
    .default(""),
  cookieConsentEnabled: z.boolean().default(true),
  cookieConsentMessage: z.string().trim().max(300).default(""),
  privacyHref: z.string().trim().max(300).default(""),
});

export type BuilderAnalyticsInput = z.infer<typeof builderAnalyticsSchema>;

// --- Multi-page management (Phase 6) ---

export const PAGE_TEMPLATES = [
  "blank",
  "about",
  "contact",
  "landing",
  "rooms",
  "rates",
  "experiences",
  "gallery",
] as const;
export type PageTemplate = (typeof PAGE_TEMPLATES)[number];

/** Section composition per page template — shared by the create-page action
 *  (builds real sections via newSection) and the picker's preview wireframe. */
export const PAGE_TEMPLATE_SECTIONS: Record<PageTemplate, SectionType[]> = {
  blank: ["intro"],
  about: ["intro", "host_bio", "values"],
  contact: ["intro", "contact_form"],
  landing: ["hero", "highlights", "rooms_preview", "reviews", "cta"],
  rooms: ["intro", "rooms_preview", "amenities", "pricing", "cta"],
  // Rates page: intro + an editable room-rate block + a seasonal-pricing block +
  // a book CTA. The two rates blocks are manual content (host-edited); for a
  // live, auto-populated table the `rate_table` section is also available.
  rates: ["intro", "room_rates", "seasonal_pricing", "cta"],
  experiences: ["intro", "highlights", "gallery", "cta"],
  gallery: ["intro", "gallery"],
};

export const createPageSchema = z.object({
  websiteId: z.string().uuid(),
  title: z.string().trim().min(1, "required").max(120),
  template: z.enum(PAGE_TEMPLATES).default("blank"),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

// --- Saved sections ("my blocks") — reusable customised sections ---

/** A persisted saved section in host_websites.saved_sections. */
export const savedSectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(80),
  section: sectionSchema,
});
export const savedSectionsSchema = z.array(savedSectionSchema).max(50);
export type SavedSection = z.infer<typeof savedSectionSchema>;

export const saveSavedSectionSchema = z.object({
  websiteId: z.string().uuid(),
  name: z.string().trim().min(1, "required").max(80),
  section: sectionSchema,
});
export type SaveSavedSectionInput = z.infer<typeof saveSavedSectionSchema>;

export const deleteSavedSectionSchema = z.object({
  websiteId: z.string().uuid(),
  id: z.string().uuid(),
});
export type DeleteSavedSectionInput = z.infer<typeof deleteSavedSectionSchema>;

// --- Navigation (menu, top bar, header CTA/behaviour, footer extras) ---

// Per-LINK style override (one layer). Sits on top of the global menu style for
// THIS link only. All optional — unset fields inherit the global/desktop value.
const menuItemStyleLayerSchema = z.object({
  color: z.string().trim().max(40).optional(),
  hoverColor: z.string().trim().max(40).optional(),
  fontSize: z.number().int().min(8).max(48).optional(),
  weight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
  uppercase: z.boolean().optional(),
  /** Background colour (turns the link into a button/pill when set). */
  bg: z.string().trim().max(40).optional(),
  /** Rounded pill shape (with padding) — for button-style links. */
  pill: z.boolean().optional(),
});
// Responsive per-link style: a desktop base + tablet/mobile diff layers, exactly
// like the global menu's per-device overrides (only stored diffs win).
const menuItemStyleSchema = menuItemStyleLayerSchema.extend({
  tablet: menuItemStyleLayerSchema.optional(),
  mobile: menuItemStyleLayerSchema.optional(),
});

const menuLinkSchema = z.object({
  id: z.string(),
  label: z.string().trim().max(60),
  href: z.string().trim().max(500),
  newTab: z.boolean().optional(),
  /** Per-link responsive style override (the selected-link Style controls). */
  style: menuItemStyleSchema.optional(),
  /** Page keys this link is HIDDEN on ("home" or a slug) — per-page show/hide. */
  hiddenOnPages: z.array(z.string().trim().max(120)).max(60).optional(),
});
// Two levels of nesting: top → sub → sub-sub (the sub-sub are leaf links).
const menuSubItemSchema = menuLinkSchema.extend({
  children: z.array(menuLinkSchema).max(12).optional(),
});
export const menuItemSchema = menuLinkSchema.extend({
  children: z.array(menuSubItemSchema).max(12).optional(),
  // When true, this item's dropdown is auto-filled at render with the site's
  // current rooms (always up to date) — `hiddenRoomIds` are left out.
  autoRooms: z.boolean().optional(),
  hiddenRoomIds: z.array(z.string()).max(200).optional(),
});

// Per-device menu-style override (tablet / mobile). All optional — only the
// fields that DIFFER from the desktop base are stored, mirroring the page
// builder's responsive overrides; unset fields inherit the desktop values.
const menuDeviceStyleSchema = z.object({
  color: z.string().trim().max(40).optional(),
  hoverColor: z.string().trim().max(40).optional(),
  weight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
  uppercase: z.boolean().optional(),
  fontSize: z.number().int().min(8).max(48).optional(),
});

/** Optional menu styling (the Style tab) — applied to the header menu. */
export const menuStyleSchema = z
  .object({
    // ── Desktop base ──
    color: z.string().trim().max(40).optional(),
    hoverColor: z.string().trim().max(40).optional(),
    // Scrolled-state colours — when the header is transparent over the hero, the
    // link/hover colour once the bar turns solid on scroll (the over-hero colour
    // is `color`/`hoverColor` above). Blank → the over-hero colour carries over.
    scrolledColor: z.string().trim().max(40).optional(),
    scrolledHoverColor: z.string().trim().max(40).optional(),
    weight: z.enum(["normal", "medium", "semibold", "bold"]).default("medium"),
    uppercase: z.boolean().default(false),
    // Top-level link size (px). Blank → theme default.
    fontSize: z.number().int().min(8).max(40).optional(),
    // Where the menu sits within its slot in the header (the menu builder's
    // Layout "alignment" control).
    align: z.enum(["start", "center", "end"]).default("start"),
    // Sub-menu (dropdown) styling — applied to dropdown items + the panel, so a
    // host can style nested links separately from the top-level menu.
    submenuColor: z.string().trim().max(40).optional(),
    submenuHoverColor: z.string().trim().max(40).optional(),
    submenuBg: z.string().trim().max(40).optional(),
    // Scrolled-state dropdown — when a transparent-over-hero header has scrolled
    // to solid, the dropdown panel/link colours switch to these ([data-scrolled]).
    scrolledSubmenuBg: z.string().trim().max(40).optional(),
    scrolledSubmenuColor: z.string().trim().max(40).optional(),
    // Layout: horizontal spacing between top-level links (px). Blank → theme.
    itemGap: z.number().int().min(4).max(64).optional(),
    // ── Per-device overrides (scoped to screen size) ──
    // Tablet — the inline menu at tablet widths (only diffs from desktop).
    tablet: menuDeviceStyleSchema.optional(),
    // Mobile — the ☰ drawer / overlay (its own bg + link styling).
    mobile: menuDeviceStyleSchema
      .extend({
        overlayBg: z.string().trim().max(40).optional(),
        backdropColor: z.string().trim().max(40).optional(),
        // The drawer's expandable dropdown/submenu (nested child links).
        submenuColor: z.string().trim().max(40).optional(),
      })
      .optional(),
  })
  .default({ weight: "medium", uppercase: false, align: "start" });

// Per-page menu/header OVERRIDE — appearance + style scoped to one page key
// ("home" or a slug). All optional; only set fields override the global value.
const menuPageOverrideSchema = z.object({
  // Header appearance for this page (transparent-over-hero on/off + solid bar bg).
  transparentOverHero: z.boolean().optional(),
  bgColor: z.string().trim().max(40).optional(),
  // Menu styling for this page.
  color: z.string().trim().max(40).optional(),
  hoverColor: z.string().trim().max(40).optional(),
  /** Scrolled-state menu colour for this page (transparent-over-hero headers). */
  scrolledColor: z.string().trim().max(40).optional(),
  fontSize: z.number().int().min(8).max(40).optional(),
});

export const navigationSchema = z.object({
  // Effective header menu — mirrored from the primary named menu (render SSOT).
  menu: z.array(menuItemSchema).max(20).default([]),
  // Named menus (multi-menu). The header uses the `primaryMenuId` menu.
  menus: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().trim().max(60),
        items: z.array(menuItemSchema).max(20).default([]),
      }),
    )
    .max(10)
    .optional(),
  primaryMenuId: z.string().max(120).optional(),
  menuStyle: menuStyleSchema,
  // Per-page appearance/style overrides, keyed by page key ("home" or a slug).
  perPage: z.record(z.string(), menuPageOverrideSchema).optional(),
  topBar: z
    .object({
      enabled: z.boolean().default(false),
      phone: z.string().trim().max(40).optional(),
      whatsapp: z.string().trim().max(40).optional(),
      email: z.string().trim().max(200).optional(),
      message: z.string().trim().max(160).optional(),
    })
    .default({ enabled: false }),
  header: z
    .object({
      // The chosen header style (the header builder's "layout" picker). Single
      // source of truth — SiteChrome prefers this over the theme's header layout.
      layout: z.enum(["classic", "centered", "split", "minimal"]).optional(),
      ctaLabel: z.string().trim().max(40).optional(),
      ctaHref: z.string().trim().max(500).optional(),
      // Small subtitle beside the brand name (themes that show one, e.g. Safari's
      // "Lodge · Direct booking"). Blank → the theme default.
      tagline: z.string().trim().max(80).optional(),
      sticky: z.boolean().default(true),
      // Transparent over the hero (fades to solid on scroll). Left OPTIONAL (no
      // default) so "unset" means "let the theme decide": generic themes treat
      // unset as solid (SiteChrome uses `=== true`); the Safari design treats
      // unset as transparent (its natural look). An explicit false forces solid.
      transparentOverHero: z.boolean().optional(),
      // Header background colour (solid mode). Blank → theme surface. Lets the
      // host set e.g. a solid black bar (pair with a white menu colour).
      bgColor: z.string().trim().max(40).optional(),
      // Background once the page is scrolled when transparentOverHero is on (the
      // transparent bar fades to this). Blank → theme ink (dark).
      scrolledBgColor: z.string().trim().max(40).optional(),
      // Bottom-border colour of the header once it's solid/scrolled. Blank → the
      // theme's default hairline.
      scrolledBorderColor: z.string().trim().max(40).optional(),
      // Drop-shadow under the header once it lifts off (scrolled, or a solid
      // sticky bar). Off by default; when on, the size (blur px) + colour tune it.
      scrolledShadow: z.boolean().optional(),
      scrolledShadowColor: z.string().trim().max(40).optional(),
      scrolledShadowSize: z.number().int().min(0).max(60).optional(),
      // Header bottom-border (solid state) — colour + width. Blank → theme hairline.
      borderColor: z.string().trim().max(40).optional(),
      borderWidth: z.number().int().min(0).max(8).optional(),
      // When the full menu collapses to a ☰ button: on phones only ("mobile"),
      // on tablets too ("tablet"), or never (always show the full inline menu).
      menuCollapse: z.enum(["mobile", "tablet", "never"]).default("mobile"),
      // Show the "Book now" button in the header. On collapsed (mobile/tablet)
      // views it's hidden and replaced by the ☰ menu icon — the drawer carries it.
      showBookCta: z.boolean().default(true),
      // Book button colour (background). Blank → theme's primary button style.
      bookCtaColor: z.string().trim().max(40).optional(),
      // Mobile ☰ menu icon design (the burger that opens the drawer).
      burger: z
        .object({
          color: z.string().trim().max(40).optional(),
          size: z.number().int().min(16).max(48).optional(),
          weight: z.enum(["thin", "regular", "bold"]).optional(),
          /** Glyph variant: 3 lines / short staggered lines / 3 dots / 9-dot grid. */
          style: z.enum(["lines", "short", "dots", "grid"]).optional(),
          /** Optional button background behind the icon. Blank → none. */
          bg: z.string().trim().max(40).optional(),
        })
        .optional(),
      // Show the brand logo in the header (a visible-element toggle).
      showLogo: z.boolean().default(true),
      // Header-level logo presentation overrides (blank → use the Brand Studio
      // value). Lets the host tune how the logo shows in THIS header.
      logoStyle: z.enum(["wordmark", "icon", "mark"]).optional(),
      logoMaxHeight: z.number().int().min(16).max(96).optional(),
      // Per-device logo overrides (tablet / mobile) — only the differing fields
      // are stored; unset inherits the desktop logo settings above.
      logoTablet: z
        .object({
          show: z.boolean().optional(),
          style: z.enum(["wordmark", "icon", "mark"]).optional(),
          maxHeight: z.number().int().min(16).max(96).optional(),
        })
        .optional(),
      logoMobile: z
        .object({
          show: z.boolean().optional(),
          style: z.enum(["wordmark", "icon", "mark"]).optional(),
          maxHeight: z.number().int().min(16).max(96).optional(),
        })
        .optional(),
    })
    .default({
      sticky: true,
      transparentOverHero: false,
      menuCollapse: "mobile",
      showBookCta: true,
      showLogo: true,
    }),
  footer: z
    .object({
      showPoweredBy: z.boolean().default(true),
      copyright: z.string().trim().max(160).optional(),
      columns: z
        .array(
          z.object({
            id: z.string(),
            heading: z.string().trim().max(60).optional(),
            links: z.array(menuLinkSchema).max(12).default([]),
          }),
        )
        .max(5)
        .default([]),
      // Optional newsletter sign-up block (themes that show one, e.g. Safari).
      newsletter: z
        .object({
          enabled: z.boolean().default(true),
          heading: z.string().trim().max(80).optional(),
          body: z.string().trim().max(200).optional(),
        })
        .optional(),
    })
    .default({ showPoweredBy: true, columns: [] }),
});
export type NavigationConfig = z.infer<typeof navigationSchema>;

export const saveNavigationSchema = z.object({
  websiteId: z.string().uuid(),
  navigation: navigationSchema,
});
export type SaveNavigationInput = z.infer<typeof saveNavigationSchema>;

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
  focusKeyword: z.string().trim().max(60).default(""),
  // Per-page social/SEO featured image (og:image) — a website-assets storage
  // PATH (uploaded/picked in Page settings). Empty clears it (inherits the site).
  image: z.string().trim().max(500).default(""),
  // Per-page Meta-Pixel/GA4 event fired on the live page (none = nothing extra).
  pixelEvent: z.enum(PAGE_PIXEL_EVENTS).default("none"),
  // Per-page custom head code (meta tags / verification / tracking snippets),
  // injected into <head> on the live page only. The host's own site — trusted,
  // like the site-level pixel/GA4 ids. Empty = nothing injected.
  headCode: z.string().trim().max(4000).default(""),
  // Per-page search-engine visibility. true = emit robots noindex,nofollow for
  // THIS page only (overrides the site-level robots_index). Default indexable.
  noindex: z.boolean().default(false),
});

// ── Forms (Phase 4 — form builder) ────────────────────────────
// The field/settings shape is the SSOT in lib/website/forms.schema.ts (shared
// with the public render + submit route). These wrap it for the dashboard
// actions. A new form is created empty (name + type only); the builder then
// edits fields/settings and saves.
export const createWebsiteFormSchema = z.object({
  websiteId: z.string().uuid(),
  name: z.string().trim().min(1, "Name the form.").max(120),
  type: z.enum(FORM_TYPES).default("contact"),
  // Optional starter-template key (see lib/website/formTemplates.ts). When set,
  // the form is seeded with that template's fields + settings and `type` is
  // taken from the template. Unknown/missing → an empty form of `type`.
  template: z.string().trim().max(40).optional(),
});
export type CreateWebsiteFormInput = z.infer<typeof createWebsiteFormSchema>;

export const saveWebsiteFormSchema = z.object({
  websiteId: z.string().uuid(),
  formId: z.string().uuid(),
  name: z.string().trim().min(1, "Name the form.").max(120),
  type: z.enum(FORM_TYPES),
  fields: formFieldsSchema,
  settings: formSettingsSchema,
});
export type SaveWebsiteFormInput = z.infer<typeof saveWebsiteFormSchema>;

export const deleteWebsiteFormSchema = z.object({
  websiteId: z.string().uuid(),
  formId: z.string().uuid(),
});
export type DeleteWebsiteFormInput = z.infer<typeof deleteWebsiteFormSchema>;

export const duplicateWebsiteFormSchema = z.object({
  websiteId: z.string().uuid(),
  formId: z.string().uuid(),
});
export type DuplicateWebsiteFormInput = z.infer<
  typeof duplicateWebsiteFormSchema
>;

export const SUBMISSION_STATUSES = ["new", "read", "archived", "spam"] as const;

export const setSubmissionStatusSchema = z.object({
  websiteId: z.string().uuid(),
  submissionId: z.string().uuid(),
  status: z.enum(SUBMISSION_STATUSES),
});
export type SetSubmissionStatusInput = z.infer<
  typeof setSubmissionStatusSchema
>;

export type SavePageSeoInput = z.infer<typeof savePageSeoSchema>;
