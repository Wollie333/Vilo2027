// Shared Zod contract for Website CMS page sections.
//
// This is the single source of truth for the section unit (plan §1). It is
// imported by the builder (validate edits), the renderer (read props safely)
// and the publish action (validate draft before snapshotting). One schema, no
// divergence.
//
// Co-located in apps/web (not packages/schemas) because all three consumers
// live in the web app; the mobile app never renders host websites. Promote to a
// workspace package only if a second app ever needs it.
//
// Two kinds of section, baked into the schema:
//   • FREE-FORM   — stores its own text/media (hero, intro, cta, values,
//                   host_bio, faq, rich_text, highlights). props carry content.
//   • AUTO-POPULATE — stores only CONFIG; reads live data at render time from
//                   properties / property_rooms / reviews / POIs (gallery,
//                   rooms_preview, location, reviews, blog_preview). Never
//                   duplicates Property data, so the site is never stale.
import { z } from "zod";

// ── Section type catalog ──────────────────────────────────────
export const SECTION_TYPES = [
  "hero",
  "intro",
  "highlights",
  "stats",
  "gallery",
  "logos",
  "rooms_preview",
  "location",
  "map",
  "reviews",
  "cta",
  "host_bio",
  "values",
  "blog_preview",
  "rich_text",
  "faq",
  "contact_form",
  "form",
  "specials_preview",
  "amenities",
  "pricing",
  "video",
  "trust",
  "booking_search",
  "availability_calendar",
  "rate_table",
  // Editable rates blocks (manual content — no live pricing dependency).
  "room_rates",
  "seasonal_pricing",
  // Room detail — room-scoped sections that render the SINGLE room being viewed
  // (the /rooms/<slug> route injects the active room into each one's data). Only
  // meaningful on the `room_detail` page template.
  "room_gallery",
  "room_overview",
  "room_amenities",
  "room_rate",
  // Free elements — light building blocks (page-builder primitives).
  "el_heading",
  "el_text",
  "el_image",
  "el_button",
  "el_spacer",
  "el_divider",
  // Columns — a bounded single-level container (NOT a general element tree).
  "columns",
  // Flex container — a free-form block where the host arranges elements with
  // flexbox (direction / justify / align / gap / wrap) to design their own row.
  "flex",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/** Sections that pull live data at render time (props are config only). */
export const AUTO_POPULATE_SECTIONS: ReadonlySet<SectionType> = new Set([
  "gallery",
  "rooms_preview",
  "location",
  "reviews",
  "blog_preview",
  "specials_preview",
  // `form` pulls its definition (fields/settings) live from website_forms, so
  // editing the form in the Forms tab updates the rendered section instantly.
  "form",
  // Phase 6B booking funnel — all three read the business's live properties /
  // rooms / availability at render (never duplicate engine data, never stale).
  "booking_search",
  "availability_calendar",
  "rate_table",
]);

export function isAutoPopulate(type: SectionType): boolean {
  return AUTO_POPULATE_SECTIONS.has(type);
}

/**
 * Room-scoped sections render the SINGLE room currently being viewed. Unlike the
 * auto-populate set (resolved by type for any page), these get the active room
 * injected by the room route (`/rooms/<slug>`); in the builder preview they show
 * a sample room. Only surfaced in the palette on the `room_detail` page.
 */
export const ROOM_SCOPED_SECTIONS: ReadonlySet<SectionType> = new Set([
  "room_gallery",
  "room_overview",
  "room_amenities",
  "room_rate",
]);

export function isRoomScoped(type: SectionType): boolean {
  return ROOM_SCOPED_SECTIONS.has(type);
}

// ── Per-section presentation (Phase 1) ────────────────────────
// `tone` is shared across every section (one-tap colour scheme); `variant` is
// per-type (each section declares the layout options that make sense for it).
export const SECTION_TONES = ["default", "accent", "dark", "muted"] as const;
export type SectionTone = (typeof SECTION_TONES)[number];

// Device targeting + scheduling (optional, so no default churn on every section).
export const SECTION_VISIBILITY = ["all", "desktop", "mobile"] as const;
export type SectionVisibility = (typeof SECTION_VISIBILITY)[number];

// Seven professionally-designed, responsive hero layouts (the host pulls one or
// more in and edits photo/text/colours). `classic`/`split` are LEGACY values
// kept only so already-saved heroes still parse + render — the palette offers
// just the seven; the renderer maps classic→spotlight, split→split_right.
export const HERO_VARIANTS = [
  "spotlight",
  "split_right",
  "split_left",
  "fullscreen",
  "minimal",
  "boxed",
  "search",
  "classic",
  "split",
] as const;
/** The seven layouts surfaced in the builder (excludes legacy aliases). */
export const HERO_LAYOUTS = [
  "spotlight",
  "split_right",
  "split_left",
  "fullscreen",
  "minimal",
  "boxed",
  "search",
] as const;
export type HeroLayout = (typeof HERO_LAYOUTS)[number];
// Hero style controls (preset-only, brand-safe). overlay darkens an image so
// text stays legible; textTone forces light/dark copy; height sets the band.
export const HERO_OVERLAY = ["none", "light", "medium", "strong"] as const;
export type HeroOverlay = (typeof HERO_OVERLAY)[number];
export const HERO_TEXT_TONE = ["auto", "light", "dark"] as const;
export type HeroTextTone = (typeof HERO_TEXT_TONE)[number];
export const HERO_HEIGHT = ["auto", "medium", "tall", "screen"] as const;
export type HeroHeight = (typeof HERO_HEIGHT)[number];
export const INTRO_VARIANTS = ["centered", "split", "lead"] as const;
export const CTA_VARIANTS = ["banner", "card", "split"] as const;
export const HIGHLIGHTS_VARIANTS = ["grid", "list", "plain"] as const;
export const STATS_VARIANTS = ["band", "plain", "cards"] as const;
export const VALUES_VARIANTS = ["border", "cards", "numbered"] as const;
export const HOSTBIO_VARIANTS = ["side", "centered", "card"] as const;
export const REVIEWS_VARIANTS = ["grid", "list", "plain"] as const;
export const BLOG_VARIANTS = ["grid", "list", "compact"] as const;
export const FAQ_VARIANTS = ["accordion", "plain", "columns"] as const;
export const LOGOS_VARIANTS = ["row", "grid", "color"] as const;
export const LOCATION_VARIANTS = ["split", "stacked", "list"] as const;
export const MAP_VARIANTS = ["boxed", "wide"] as const;
export const CONTACT_VARIANTS = ["stacked", "split"] as const;
export const RICHTEXT_VARIANTS = ["narrow", "wide"] as const;
export const TRUST_VARIANTS = ["badges", "grid"] as const;
// Room-detail sections (room-scoped).
export const ROOM_GALLERY_VARIANTS = [
  "mosaic",
  "carousel",
  "grid",
  "stacked",
] as const;
export const ROOM_OVERVIEW_VARIANTS = ["split", "stacked"] as const;
export const ROOM_AMENITIES_VARIANTS = ["grid", "list"] as const;
export const ROOM_RATE_VARIANTS = ["card", "banner"] as const;

// ── Shared prop fragments ─────────────────────────────────────
const heading = z.string().max(200).optional();
const gridLayout = z.enum(["grid", "list", "carousel"]).optional();

// ── Per-type props ────────────────────────────────────────────
const heroProps = z.object({
  headline: z.string().max(200),
  eyebrow: z.string().max(120).optional(),
  subheadline: z.string().max(400).optional(),
  image_path: z.string().optional(),
  cta_label: z.string().max(60).optional(),
  cta_href: z.string().max(500).optional(),
  // Optional SECONDARY cta + per-cta visibility (used by the Safari hero, which
  // ships two buttons). Additive — generic heroes ignore them.
  cta2_label: z.string().max(60).optional(),
  cta2_href: z.string().max(500).optional(),
  show_cta: z.boolean().optional(),
  show_cta2: z.boolean().optional(),
  // Optional stat row beneath the hero (Safari "12,000 Hectares" etc.). When
  // omitted the Safari band shows its stock stats; `show_stats:false` hides them.
  stats: z
    .array(
      z.object({
        value: z.string().max(60),
        label: z.string().max(80).optional(),
      }),
    )
    .max(4)
    .optional(),
  show_stats: z.boolean().optional(),
  align: z.enum(["left", "center", "right"]).default("center"),
  variant: z.enum(HERO_VARIANTS).default("spotlight"),
  overlay: z.enum(HERO_OVERLAY).default("medium"),
  // Fine overlay control: a colour + opacity %. When set they override the
  // `overlay` preset (which stays as the simple/legacy black-scrim default).
  overlayColor: z.string().max(40).optional(),
  overlayOpacity: z.number().int().min(0).max(100).optional(),
  textTone: z.enum(HERO_TEXT_TONE).default("auto"),
  height: z.enum(HERO_HEIGHT).default("auto"),
});

const introProps = z.object({
  heading,
  eyebrow: z.string().max(120).optional(),
  body: z.string().max(4000),
  image_path: z.string().optional(),
  // Optional stat badge over the image (Safari "2009 / Family-run since"). When
  // omitted the Safari band shows its stock badge; `show_badge:false` hides it.
  badge_value: z.string().max(40).optional(),
  badge_label: z.string().max(80).optional(),
  show_badge: z.boolean().optional(),
  variant: z.enum(INTRO_VARIANTS).default("centered"),
});

const highlightsProps = z.object({
  heading,
  eyebrow: z.string().max(120).optional(),
  subheading: z.string().max(600).optional(),
  items: z
    .array(
      z.object({
        icon: z.string().max(60).optional(),
        title: z.string().max(120),
        body: z.string().max(600).optional(),
        image_path: z.string().optional(),
      }),
    )
    .max(12)
    .default([]),
  variant: z.enum(HIGHLIGHTS_VARIANTS).default("grid"),
});

const statsProps = z.object({
  heading,
  items: z
    .array(
      z.object({
        value: z.string().max(40),
        label: z.string().max(120),
      }),
    )
    .max(8)
    .default([]),
  variant: z.enum(STATS_VARIANTS).default("band"),
});

const logosProps = z.object({
  heading,
  items: z
    .array(
      z.object({
        image_path: z.string().max(500),
        alt: z.string().max(120).optional(),
        href: z.string().max(500).optional(),
      }),
    )
    .max(16)
    .default([]),
  variant: z.enum(LOGOS_VARIANTS).default("row"),
});

const galleryProps = z.object({
  heading,
  eyebrow: z.string().max(120).optional(),
  layout: gridLayout,
  max: z.number().int().min(1).max(60).default(12),
});

const mapProps = z.object({
  heading,
  address: z.string().max(300),
  caption: z.string().max(300).optional(),
  zoom: z.number().int().min(1).max(20).default(14),
  variant: z.enum(MAP_VARIANTS).default("boxed"),
});

const roomsPreviewProps = z.object({
  heading,
  eyebrow: z.string().max(120).optional(),
  layout: gridLayout,
  max: z.number().int().min(1).max(60).default(6),
  ctaLabel: z.string().max(60).optional(),
});

const locationProps = z.object({
  heading,
  eyebrow: z.string().max(120).optional(),
  body: z.string().max(1000).optional(),
  image_path: z.string().optional(),
  show_map: z.boolean().default(true),
  variant: z.enum(LOCATION_VARIANTS).default("split"),
});

const reviewsProps = z.object({
  heading,
  eyebrow: z.string().max(120).optional(),
  subheading: z.string().max(300).optional(),
  max: z.number().int().min(1).max(30).default(6),
  variant: z.enum(REVIEWS_VARIANTS).default("grid"),
});

const ctaProps = z.object({
  heading: z.string().max(200),
  eyebrow: z.string().max(120).optional(),
  body: z.string().max(600).optional(),
  button_label: z.string().max(60),
  button_href: z.string().max(500),
  image_path: z.string().optional(),
  variant: z.enum(CTA_VARIANTS).default("banner"),
});

const hostBioProps = z.object({
  heading,
  name: z.string().max(120).optional(),
  body: z.string().max(4000),
  photo_path: z.string().optional(),
  variant: z.enum(HOSTBIO_VARIANTS).default("side"),
});

const valuesProps = z.object({
  heading,
  items: z
    .array(
      z.object({
        title: z.string().max(120),
        body: z.string().max(600).optional(),
      }),
    )
    .max(12)
    .default([]),
  variant: z.enum(VALUES_VARIANTS).default("border"),
});

const blogPreviewProps = z.object({
  heading,
  eyebrow: z.string().max(120).optional(),
  max: z.number().int().min(1).max(12).default(3),
  variant: z.enum(BLOG_VARIANTS).default("grid"),
});

// Auto-populate: reads the business's active + show_on_website specials at render
// time (see lib/site/loadSitePage.ts assembleSiteDataByType). Props are config
// only — never duplicates special data, so the section is never stale.
const specialsPreviewProps = z.object({
  heading,
  layout: gridLayout,
  max: z.number().int().min(1).max(60).default(6),
  ctaLabel: z.string().max(60).optional(),
});

const richTextProps = z.object({
  html: z.string().max(50000),
  variant: z.enum(RICHTEXT_VARIANTS).default("narrow"),
});

const faqProps = z.object({
  eyebrow: z.string().max(120).optional(),
  heading,
  items: z
    .array(
      z.object({
        q: z.string().max(300),
        a: z.string().max(2000),
      }),
    )
    .max(40)
    .default([]),
  variant: z.enum(FAQ_VARIANTS).default("accordion"),
});

// Lead-capture form. Free-form CONFIG only — a submission is not stored in the
// section; it opens a "Website Enquiry" in the host inbox (see
// lib/website/createWebsiteEnquiry.ts). The form posts the live website id so the
// host is resolved server-side; never trusts anything client-supplied.
const contactFormProps = z.object({
  eyebrow: z.string().max(120).optional(),
  heading,
  body: z.string().max(600).optional(),
  submit_label: z.string().max(60).default("Send message"),
  success_message: z
    .string()
    .max(300)
    .default("Thanks — your message is on its way. We'll be in touch soon."),
  show_phone: z.boolean().default(true),
  variant: z.enum(CONTACT_VARIANTS).default("stacked"),
});

// Host-built form (Phase 4). CONFIG only — references a website_forms row by id;
// the fields/settings are resolved live at render (auto-populate). A submission
// is persisted to website_form_submissions and, for email-bearing forms, opens
// a "Website Enquiry" in the inbox (see lib/website/submitWebsiteForm.ts).
const formProps = z.object({
  form_id: z.string().uuid().optional(),
  heading,
  body: z.string().max(600).optional(),
  variant: z.enum(CONTACT_VARIANTS).default("stacked"),
});

// Free-form facilities/amenities grid (icon + label).
const amenitiesProps = z.object({
  eyebrow: z.string().max(120).optional(),
  heading,
  items: z
    .array(
      z.object({
        icon: z.string().max(60).optional(),
        label: z.string().max(120),
      }),
    )
    .max(40)
    .default([]),
});

// Free-form display-only rates table (booking always re-prices server-side).
const pricingProps = z.object({
  eyebrow: z.string().max(120).optional(),
  heading,
  items: z
    .array(
      z.object({
        label: z.string().max(120),
        price: z.string().max(40),
        note: z.string().max(160).optional(),
      }),
    )
    .max(20)
    .default([]),
  footnote: z.string().max(300).optional(),
});

// Free-form embedded video (YouTube / Vimeo URL).
const videoProps = z.object({
  heading,
  url: z.string().max(500),
  caption: z.string().max(300).optional(),
});

// Trust signals (Phase 6A) — free-form badges (awards / certifications /
// payment + secure badges) plus an OPTIONAL live review score. The badges live
// in props (host-entered, like amenities); the score is pulled live from the
// business's published reviews at render time (see lib/site/loadSitePage.ts —
// it reuses the reviews aggregate), so it's never stale.
const trustProps = z.object({
  heading,
  body: z.string().max(600).optional(),
  /** Show the live "★ 4.9 · 128 reviews" block above the badges. */
  show_review_score: z.boolean().default(true),
  items: z
    .array(
      z.object({
        icon: z.string().max(60).optional(),
        label: z.string().max(120),
        caption: z.string().max(160).optional(),
      }),
    )
    .max(20)
    .default([]),
  variant: z.enum(TRUST_VARIANTS).default("badges"),
});

// ── Booking funnel (Phase 6B) ─────────────────────────────────
// All three are AUTO-POPULATE config: they reference the business's own
// properties/rooms and read live availability + SERVER-RECALCULATED pricing from
// the existing booking engine. Props NEVER carry a price (the client is never
// trusted); `property_id` (optional) pins the section to one of the site's
// visible properties — empty means "let the guest choose" (or the primary one).

// Lead-gen search widget: date range + guests → live availability + a
// server-recalculated quote, then a deep-link into the real checkout.
const bookingSearchProps = z.object({
  heading,
  body: z.string().max(600).optional(),
  property_id: z.string().uuid().optional(),
  ctaLabel: z.string().max(60).optional(),
});

// Month calendar of live availability for one property (booked/blocked dates
// greyed out). Reads blocked_dates at render — never a stale snapshot.
const availabilityCalendarProps = z.object({
  heading,
  body: z.string().max(600).optional(),
  property_id: z.string().uuid().optional(),
  months: z.number().int().min(1).max(2).default(1),
});

// Live nightly-rate table across the site's visible rooms. Prices are read
// server-side from the live rooms (display-only; booking always re-prices).
const rateTableProps = z.object({
  heading,
  eyebrow: z.string().max(120).optional(),
  note: z.string().max(300).optional(),
  ctaLabel: z.string().max(60).optional(),
});

// Source for the rates blocks. "auto" (default) pulls the host's live data set
// in the app; "manual" uses the host-typed rows below as an override.
const RATES_SOURCE = ["auto", "manual"] as const;

// "Room rate" block. Defaults to the host's live room rates (same source as the
// rate_table). In "manual" mode the host types the rows (price as free text,
// e.g. "From R1,200 / night") — display-only, no live dependency.
const roomRatesProps = z.object({
  heading,
  note: z.string().max(300).optional(),
  source: z.enum(RATES_SOURCE).default("auto"),
  items: z
    .array(
      z.object({
        room: z.string().max(120),
        price: z.string().max(60),
        detail: z.string().max(200).optional(),
      }),
    )
    .max(20)
    .default([]),
});

// "Seasonal pricing" block. Defaults to the host's configured seasonal rules
// (property_seasonal_pricing, grouped by label). In "manual" mode the host types
// the rows below as an override.
const seasonalPricingProps = z.object({
  heading,
  note: z.string().max(300).optional(),
  source: z.enum(RATES_SOURCE).default("auto"),
  items: z
    .array(
      z.object({
        season: z.string().max(120),
        dates: z.string().max(80).optional(),
        price: z.string().max(60),
        detail: z.string().max(200).optional(),
      }),
    )
    .max(20)
    .default([]),
});

// ── Free elements (page-builder primitives) ───────────────────
// Light, self-contained building blocks the host drops between the curated
// sections — free-form (never auto-populate). Deliberately simple: text, image,
// button + spacing helpers. (A "Columns" container and per-block responsive
// style overrides are planned follow-up slices.)
const ELEMENT_ALIGN = ["left", "center", "right"] as const;

// Preset typography tokens (brand-safe — tied to the theme, never raw px/hex):
//   • size   — "auto" inherits (heading uses its level's --site-hN, text uses
//              the body base); the rest scale off --site-text-base.
//   • weight — "auto" inherits the theme heading/body weight.
//   • color  — "default" inherits (heading=ink, text=mute); the rest are theme
//              palette roles, so a host can recolour without going off-brand.
export const EL_SIZE = ["auto", "xs", "sm", "md", "lg", "xl", "2xl"] as const;
export type ElSize = (typeof EL_SIZE)[number];
export const EL_WEIGHT = [
  "auto",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
] as const;
export type ElWeight = (typeof EL_WEIGHT)[number];
export const EL_COLOR = ["default", "muted", "accent", "secondary"] as const;
export type ElColor = (typeof EL_COLOR)[number];
export const EL_BUTTON_SIZE = ["sm", "md", "lg"] as const;
export type ElButtonSize = (typeof EL_BUTTON_SIZE)[number];
export const EL_DIVIDER_THICKNESS = ["thin", "medium", "thick"] as const;
export type ElDividerThickness = (typeof EL_DIVIDER_THICKNESS)[number];

const elHeadingProps = z.object({
  text: z.string().max(200),
  // The HTML tag this renders as — lets the host pick the right element for SEO
  // (h1…h6) or a plain paragraph. Legacy values h2/h3/h4 still parse.
  level: z.enum(["h1", "h2", "h3", "h4", "h5", "h6", "p"]).default("h2"),
  align: z.enum(ELEMENT_ALIGN).default("left"),
  size: z.enum(EL_SIZE).default("auto"),
  weight: z.enum(EL_WEIGHT).default("auto"),
  color: z.enum(EL_COLOR).default("default"),
});

const elTextProps = z.object({
  body: z.string().max(4000),
  align: z.enum(ELEMENT_ALIGN).default("left"),
  size: z.enum(EL_SIZE).default("auto"),
  weight: z.enum(EL_WEIGHT).default("auto"),
  color: z.enum(EL_COLOR).default("default"),
});

const elImageProps = z.object({
  image_path: z.string().optional(),
  alt: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  href: z.string().max(500).optional(),
  width: z.enum(["narrow", "medium", "full"]).default("full"),
  align: z.enum(ELEMENT_ALIGN).default("center"),
});

const elButtonProps = z.object({
  label: z.string().max(60),
  href: z.string().max(500),
  variant: z.enum(["primary", "secondary"]).default("primary"),
  size: z.enum(EL_BUTTON_SIZE).default("md"),
  align: z.enum(ELEMENT_ALIGN).default("left"),
});

const elSpacerProps = z.object({
  size: z.enum(["xs", "sm", "md", "lg", "xl", "2xl"]).default("md"),
});

const elDividerProps = z.object({
  line: z.enum(["solid", "dashed", "dotted"]).default("solid"),
  thickness: z.enum(EL_DIVIDER_THICKNESS).default("thin"),
  width: z.enum(["narrow", "full"]).default("full"),
});

// ── Columns container ─────────────────────────────────────────
// A bounded, SINGLE-LEVEL layout block: a row of 1–4 columns, each holding a
// short list of inline content blocks (heading / text / image / button). This
// is NOT a general element tree — columns cannot nest columns; the page stays a
// flat list of sections. Collapses to one column on mobile.
const columnBlockSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("heading"),
    text: z.string().max(200),
    level: z.enum(["h1", "h2", "h3", "h4", "h5", "h6", "p"]).default("h3"),
  }),
  z.object({ kind: z.literal("text"), body: z.string().max(2000) }),
  z.object({
    kind: z.literal("image"),
    image_path: z.string().optional(),
    alt: z.string().max(200).optional(),
  }),
  z.object({
    kind: z.literal("button"),
    label: z.string().max(60),
    href: z.string().max(500),
    variant: z.enum(["primary", "secondary"]).default("primary"),
  }),
]);
export type ColumnBlock = z.infer<typeof columnBlockSchema>;
export type ColumnBlockKind = ColumnBlock["kind"];

const columnSchema = z.object({
  blocks: z.array(columnBlockSchema).max(12).default([]),
});

const columnsProps = z.object({
  heading,
  columns: z.array(columnSchema).min(1).max(4).default([]),
  gap: z.enum(["sm", "md", "lg"]).default("md"),
  align: z.enum(["left", "center"]).default("left"),
});

// Flex container — a single free-form block laid out with flexbox. Reuses the
// column block kinds (heading/text/image/button) as its children.
export const FLEX_DIRECTION = ["row", "column"] as const;
export const FLEX_JUSTIFY = [
  "start",
  "center",
  "end",
  "between",
  "around",
] as const;
export const FLEX_ALIGN = ["start", "center", "end", "stretch"] as const;
const flexProps = z.object({
  blocks: z.array(columnBlockSchema).max(20).default([]),
  direction: z.enum(FLEX_DIRECTION).default("row"),
  justify: z.enum(FLEX_JUSTIFY).default("start"),
  align: z.enum(FLEX_ALIGN).default("stretch"),
  gap: z.enum(["sm", "md", "lg"]).default("md"),
  wrap: z.boolean().default(true),
});

// ── Per-block responsive style (additive) ─────────────────────
// Optional per-viewport spacing overrides + an optional background colour.
// Applied by the renderer's SectionWrap (a scoped <style> with media queries) —
// any section can be fine-tuned for desktop/tablet/mobile without an element
// tree. All optional, so existing sections/themes never need to set it.
export const BLOCK_SPACE = ["none", "sm", "md", "lg", "xl"] as const;
export type BlockSpace = (typeof BLOCK_SPACE)[number];

// Frame controls (preset-only, brand-safe). border colour + radius are theme
// roles / a fixed scale, so a host can't enter raw values and drift off-brand.
export const BLOCK_BORDER = ["none", "thin", "medium", "thick"] as const;
export type BlockBorder = (typeof BLOCK_BORDER)[number];
export const BLOCK_BORDER_COLOR = ["line", "ink", "accent"] as const;
export type BlockBorderColor = (typeof BLOCK_BORDER_COLOR)[number];
export const BLOCK_RADIUS = ["none", "sm", "md", "lg", "full"] as const;
export type BlockRadius = (typeof BLOCK_RADIUS)[number];
export const BLOCK_MAXWIDTH = ["full", "wide", "medium", "narrow"] as const;
export type BlockMaxWidth = (typeof BLOCK_MAXWIDTH)[number];
// Fixed minimum section height (any block). "auto" = content height.
export const BLOCK_MINHEIGHT = ["auto", "sm", "md", "lg", "screen"] as const;
export type BlockMinHeight = (typeof BLOCK_MINHEIGHT)[number];

const blockViewportStyle = z
  .object({
    padTop: z.enum(BLOCK_SPACE).optional(),
    padBottom: z.enum(BLOCK_SPACE).optional(),
    // Left+right padding (one control — symmetric, keeps it simple/curated).
    padX: z.enum(BLOCK_SPACE).optional(),
  })
  .optional();

export const blockStyleSchema = z.object({
  /** Background colour override (CSS colour) applied across all viewports. */
  background: z.string().max(40).optional(),
  desktop: blockViewportStyle,
  tablet: blockViewportStyle,
  mobile: blockViewportStyle,
  // Global frame (all viewports). Margin is outer spacing between blocks; the
  // border/radius/maxWidth turn a block into a framed "card".
  marginTop: z.enum(BLOCK_SPACE).optional(),
  marginBottom: z.enum(BLOCK_SPACE).optional(),
  border: z.enum(BLOCK_BORDER).optional(),
  borderColor: z.enum(BLOCK_BORDER_COLOR).optional(),
  radius: z.enum(BLOCK_RADIUS).optional(),
  maxWidth: z.enum(BLOCK_MAXWIDTH).optional(),
  minHeight: z.enum(BLOCK_MINHEIGHT).optional(),
  // Typography overrides for this block's text (the inspector's "Text" controls).
  // Applied to the section's headings / body via a scoped descendant rule whose
  // specificity beats the section's Tailwind text utilities.
  headingSize: z.enum(["sm", "md", "lg", "xl"]).optional(),
  headingWeight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
  bodySize: z.enum(["sm", "md", "lg"]).optional(),
  lineHeight: z
    .enum(["tight", "snug", "normal", "relaxed", "loose"])
    .optional(),
});
export type BlockStyle = z.infer<typeof blockStyleSchema>;

// ── Room-detail props (room-scoped — render the viewed room) ───
// All config only; the room's name/photos/price/amenities resolve live from the
// active room (see lib/site/loadSitePage.ts loadRoomDetail).
const roomGalleryProps = z.object({
  variant: z.enum(ROOM_GALLERY_VARIANTS).default("carousel"),
  max: z.number().int().min(1).max(30).default(12),
});

const roomOverviewProps = z.object({
  /** Optional heading override; defaults to the room's name. */
  heading,
  show_facts: z.boolean().default(true),
  show_price: z.boolean().default(true),
  variant: z.enum(ROOM_OVERVIEW_VARIANTS).default("split"),
});

const roomAmenitiesProps = z.object({
  heading,
  variant: z.enum(ROOM_AMENITIES_VARIANTS).default("grid"),
});

const roomRateProps = z.object({
  heading,
  cta_label: z.string().max(60).default("Book this room"),
  note: z.string().max(300).optional(),
  variant: z.enum(ROOM_RATE_VARIANTS).default("card"),
});

// Per-device override bag (laptop/mobile). `hidden`/`image_path` apply to any
// section; the hero also honours `headline`/`subheadline`/`align`/`ctaStack` so a
// host can reword the hero and restack its buttons per screen. All optional.
const responsiveDeviceOverride = z.object({
  hidden: z.boolean().optional(),
  image_path: z.string().optional(),
  headline: z.string().max(200).optional(),
  subheadline: z.string().max(400).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  ctaStack: z.boolean().optional(),
});

// ── Section discriminated union ───────────────────────────────
const sectionBase = {
  // A section id is just a stable per-page key (React keys, selection, reorder) —
  // it is NOT a DB foreign key, so it need not be a UUID. The builder generates
  // UUIDs, but theme blueprints (site_themes.page_templates, seeded from
  // migrations) use readable ids like "safari-about-hero". Requiring a UUID here
  // made parseSectionsLoose silently DROP every such section, blanking the public
  // page for any site that applied a theme from the catalogue. Accept any
  // non-empty string.
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  tone: z.enum(SECTION_TONES).default("default"),
  // Optional so existing/new section literals don't all need to set them.
  visibility: z.enum(SECTION_VISIBILITY).optional(),
  schedule: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
  // Per-device responsive overrides (the Desktop/Laptop/Mobile tabs). Desktop is
  // the base (the section's own props); laptop (≤1024px) + mobile (≤640px) can
  // HIDE the section and/or swap its primary image for that screen size. Applied
  // with both @media (live site) and @container (builder device frames). Additive
  // + optional, so existing sections never set it.
  responsive: z
    .object({
      laptop: responsiveDeviceOverride.optional(),
      mobile: responsiveDeviceOverride.optional(),
    })
    .optional(),
  style: blockStyleSchema.optional(),
};

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ ...sectionBase, type: z.literal("hero"), props: heroProps }),
  z.object({ ...sectionBase, type: z.literal("intro"), props: introProps }),
  z.object({
    ...sectionBase,
    type: z.literal("highlights"),
    props: highlightsProps,
  }),
  z.object({ ...sectionBase, type: z.literal("stats"), props: statsProps }),
  z.object({ ...sectionBase, type: z.literal("logos"), props: logosProps }),
  z.object({ ...sectionBase, type: z.literal("gallery"), props: galleryProps }),
  z.object({ ...sectionBase, type: z.literal("map"), props: mapProps }),
  z.object({
    ...sectionBase,
    type: z.literal("rooms_preview"),
    props: roomsPreviewProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("location"),
    props: locationProps,
  }),
  z.object({ ...sectionBase, type: z.literal("reviews"), props: reviewsProps }),
  z.object({ ...sectionBase, type: z.literal("cta"), props: ctaProps }),
  z.object({
    ...sectionBase,
    type: z.literal("host_bio"),
    props: hostBioProps,
  }),
  z.object({ ...sectionBase, type: z.literal("values"), props: valuesProps }),
  z.object({
    ...sectionBase,
    type: z.literal("blog_preview"),
    props: blogPreviewProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("rich_text"),
    props: richTextProps,
  }),
  z.object({ ...sectionBase, type: z.literal("faq"), props: faqProps }),
  z.object({
    ...sectionBase,
    type: z.literal("contact_form"),
    props: contactFormProps,
  }),
  z.object({ ...sectionBase, type: z.literal("form"), props: formProps }),
  z.object({
    ...sectionBase,
    type: z.literal("specials_preview"),
    props: specialsPreviewProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("amenities"),
    props: amenitiesProps,
  }),
  z.object({ ...sectionBase, type: z.literal("pricing"), props: pricingProps }),
  z.object({ ...sectionBase, type: z.literal("video"), props: videoProps }),
  z.object({ ...sectionBase, type: z.literal("trust"), props: trustProps }),
  z.object({
    ...sectionBase,
    type: z.literal("booking_search"),
    props: bookingSearchProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("availability_calendar"),
    props: availabilityCalendarProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("rate_table"),
    props: rateTableProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("room_rates"),
    props: roomRatesProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("seasonal_pricing"),
    props: seasonalPricingProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("room_gallery"),
    props: roomGalleryProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("room_overview"),
    props: roomOverviewProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("room_amenities"),
    props: roomAmenitiesProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("room_rate"),
    props: roomRateProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("el_heading"),
    props: elHeadingProps,
  }),
  z.object({ ...sectionBase, type: z.literal("el_text"), props: elTextProps }),
  z.object({
    ...sectionBase,
    type: z.literal("el_image"),
    props: elImageProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("el_button"),
    props: elButtonProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("el_spacer"),
    props: elSpacerProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("el_divider"),
    props: elDividerProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("columns"),
    props: columnsProps,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("flex"),
    props: flexProps,
  }),
]);

export type WebsiteSection = z.infer<typeof sectionSchema>;

/** A page's section list (the `draft_sections` / `published_sections` JSONB). */
export const sectionsSchema = z.array(sectionSchema).max(40);
export type WebsiteSections = z.infer<typeof sectionsSchema>;

/**
 * Parse an unknown JSONB value (from the DB) into a validated section array,
 * dropping anything malformed rather than throwing — the renderer must stay
 * resilient to partially-saved drafts.
 */
export function parseSectionsLoose(value: unknown): WebsiteSections {
  if (!Array.isArray(value)) return [];
  const out: WebsiteSections = [];
  for (const raw of value) {
    const parsed = sectionSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
