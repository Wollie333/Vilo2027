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
]);

export function isAutoPopulate(type: SectionType): boolean {
  return AUTO_POPULATE_SECTIONS.has(type);
}

// ── Per-section presentation (Phase 1) ────────────────────────
// `tone` is shared across every section (one-tap colour scheme); `variant` is
// per-type (each section declares the layout options that make sense for it).
export const SECTION_TONES = ["default", "accent", "dark", "muted"] as const;
export type SectionTone = (typeof SECTION_TONES)[number];

// Device targeting + scheduling (optional, so no default churn on every section).
export const SECTION_VISIBILITY = ["all", "desktop", "mobile"] as const;
export type SectionVisibility = (typeof SECTION_VISIBILITY)[number];

export const HERO_VARIANTS = ["classic", "split", "minimal"] as const;
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

// ── Shared prop fragments ─────────────────────────────────────
const heading = z.string().max(200).optional();
const gridLayout = z.enum(["grid", "list", "carousel"]).optional();

// ── Per-type props ────────────────────────────────────────────
const heroProps = z.object({
  headline: z.string().max(200),
  subheadline: z.string().max(400).optional(),
  image_path: z.string().optional(),
  cta_label: z.string().max(60).optional(),
  cta_href: z.string().max(500).optional(),
  align: z.enum(["left", "center"]).default("center"),
  variant: z.enum(HERO_VARIANTS).default("classic"),
});

const introProps = z.object({
  heading,
  body: z.string().max(4000),
  variant: z.enum(INTRO_VARIANTS).default("centered"),
});

const highlightsProps = z.object({
  heading,
  items: z
    .array(
      z.object({
        icon: z.string().max(60).optional(),
        title: z.string().max(120),
        body: z.string().max(600).optional(),
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
  layout: gridLayout,
  max: z.number().int().min(1).max(60).default(6),
  ctaLabel: z.string().max(60).optional(),
});

const locationProps = z.object({
  heading,
  show_map: z.boolean().default(true),
  variant: z.enum(LOCATION_VARIANTS).default("split"),
});

const reviewsProps = z.object({
  heading,
  max: z.number().int().min(1).max(30).default(6),
  variant: z.enum(REVIEWS_VARIANTS).default("grid"),
});

const ctaProps = z.object({
  heading: z.string().max(200),
  body: z.string().max(600).optional(),
  button_label: z.string().max(60),
  button_href: z.string().max(500),
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

// ── Section discriminated union ───────────────────────────────
const sectionBase = {
  id: z.string().uuid(),
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
