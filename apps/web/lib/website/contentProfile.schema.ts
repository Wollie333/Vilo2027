// Content Profile — the host's theme-agnostic website content.
//
// Plan of record: docs/features/BUILDER_V2_PLAN.md (Wizard arc) +
// project doc "Website_CMS_Wizard_and_Theme_Architecture_v1".
//
// The core principle: CONTENT is decoupled from SKIN. The host answers a short
// wizard ONCE; those answers live here (canonical slots), never inside a theme's
// blocks. A theme is a skin + blueprint that BINDS these slots into its sections
// (see SLOT_BINDINGS + hydrateProfile.ts). Switching themes re-skins without
// losing content; a new theme inherits every binding for free as long as it uses
// the canonical sections.
//
// Stored as a JSONB column `host_websites.content_profile`
// (migration 20260717090000_website_content_profile.sql). Every field is
// optional — an empty profile is valid and yields the theme's own demo copy.
import { z } from "zod";

// ── The profile shape (canonical slots) ───────────────────────
// Only the copy that genuinely CANNOT be pulled from the host's account lives
// here (hero tagline, About story, host bio, experiences, FAQ). Everything else
// on a site is auto-derived from the account or auto-populated live.
export const contentProfileSchema = z
  .object({
    brand: z
      .object({
        // A short marketing tagline, reused wherever a subheadline is needed.
        tagline: z.string().max(400).optional(),
      })
      .partial()
      .optional(),
    home: z
      .object({
        hero: z
          .object({
            headline: z.string().max(200).optional(),
            subheadline: z.string().max(400).optional(),
            imagePath: z.string().max(400).optional(),
          })
          .partial()
          .optional(),
        intro: z
          .object({ body: z.string().max(4000).optional() })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
    about: z
      .object({
        // The origin / why-you-host narrative → the About page intro body.
        story: z.string().max(4000).optional(),
        hostBio: z
          .object({
            body: z.string().max(4000).optional(),
            // Optional host/team photo the host picks or uploads in the wizard;
            // falls back to the account profile photo when empty.
            photoPath: z.string().max(400).optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
    experiences: z
      .object({
        intro: z.string().max(4000).optional(),
        items: z
          .array(
            z.object({
              title: z.string().max(120),
              body: z.string().max(600).optional(),
              icon: z.string().max(500).optional(),
              imagePath: z.string().max(400).optional(),
            }),
          )
          .max(3)
          .optional(),
        // Host-curated "nearby experiences" — real places fetched from OpenStreetMap
        // (lib/site/nearbyFetch.ts) and cached here so they're not re-fetched per
        // request. Shape mirrors NearbyPlace (lib/site/nearby.ts). Drafts the host
        // reviews before publishing — never silent auto-populate.
        nearby: z
          .array(
            z.object({
              name: z.string().max(200),
              category: z.string().max(80),
              distance: z.string().max(60),
              rating: z.number().nullable().optional(),
              reviews: z.number().nullable().optional(),
              price: z.string().max(12).nullable().optional(),
              openNow: z.boolean().nullable().optional(),
              blurb: z.string().max(600).nullable().optional(),
              imageUrl: z.string().max(600).nullable().optional(),
              mapsUri: z.string().max(600).nullable().optional(),
              group: z.enum(["eat", "nature", "see", "shop"]),
            }),
          )
          .max(24)
          .optional(),
      })
      .partial()
      .optional(),
    contact: z
      .object({
        faq: z
          .array(
            z.object({
              q: z.string().max(300),
              a: z.string().max(2000),
            }),
          )
          .max(12)
          .optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

export type ContentProfile = z.infer<typeof contentProfileSchema>;

/** Parse loosely: return a valid ContentProfile or {} (never throw). */
export function parseContentProfileLoose(value: unknown): ContentProfile {
  const res = contentProfileSchema.safeParse(value);
  return res.success ? res.data : {};
}

// ── Derived content (account-sourced fallbacks) ───────────────
// Computed once per site from the host's existing data. Used by hydration when a
// profile slot is empty but the value can be pulled from the account.
export type DerivedContent = {
  propertyDescription?: string;
  policiesFaq?: { q: string; a: string }[];
  hostName?: string;
  hostPhotoPath?: string;
  heroPhotoPath?: string;
};

// ── The canonical binding registry (theme-agnostic) ───────────
// Because every theme uses the same canonical sections per page, a binding is a
// property of the canonical SECTION, not the theme. `hydrateProfile` walks a
// seeded page's widget leaves and, for each leaf whose type matches a binding for
// that page kind, writes the resolved value into the bound prop. An empty
// resolved value leaves the theme's demo copy untouched.
export type PageKind =
  | "home"
  | "about"
  | "rooms"
  | "specials"
  | "experiences"
  | "gallery"
  | "contact"
  | "blog"
  | "room_detail"
  | "search_results"
  | "checkout"
  | "thank-you"
  | "custom";

export type SlotBinding = {
  /** Canonical slot id, for logging / the wizard field map. */
  slot: string;
  /** Which canonical page this binding applies to. */
  page: PageKind;
  /** The section/widget `type` whose leaf receives the value. */
  sectionType: string;
  /** The prop on that leaf to write. */
  prop: string;
  /** True when this slot is filled by the AI Q&A step (vs derived/default). */
  ai?: boolean;
  /** Pull the value from the profile (undefined/empty → fall back to derive). */
  get?: (p: ContentProfile) => unknown;
  /** Account-derived fallback when the profile slot is empty. */
  derive?: (d: DerivedContent) => unknown;
};

// NOTE (D1, tracked in the tech spec): the "experiences" slots are declared on
// the canonical `experiences` page here. Where a theme places the experiences
// `highlights` on a different page (e.g. Oceans View puts it on home), the
// seeding step decides placement; hydration binds by (page kind, section type).
export const SLOT_BINDINGS: SlotBinding[] = [
  {
    slot: "home.hero.headline",
    page: "home",
    sectionType: "hero",
    prop: "headline",
    ai: true,
    get: (p) => p.home?.hero?.headline,
  },
  {
    slot: "home.hero.subheadline",
    page: "home",
    sectionType: "hero",
    prop: "subheadline",
    ai: true,
    get: (p) => p.home?.hero?.subheadline ?? p.brand?.tagline,
  },
  {
    slot: "home.hero.image",
    page: "home",
    sectionType: "hero",
    prop: "image_path",
    get: (p) => p.home?.hero?.imagePath,
    derive: (d) => d.heroPhotoPath,
  },
  {
    slot: "home.intro.body",
    page: "home",
    sectionType: "intro",
    prop: "body",
    get: (p) => p.home?.intro?.body,
    derive: (d) => d.propertyDescription,
  },
  {
    slot: "about.story",
    page: "about",
    sectionType: "intro",
    prop: "body",
    ai: true,
    get: (p) => p.about?.story,
    derive: (d) => d.propertyDescription,
  },
  {
    slot: "about.hostBio.body",
    page: "about",
    sectionType: "host_bio",
    prop: "body",
    ai: true,
    get: (p) => p.about?.hostBio?.body,
  },
  {
    slot: "about.hostBio.name",
    page: "about",
    sectionType: "host_bio",
    prop: "name",
    derive: (d) => d.hostName,
  },
  {
    slot: "about.hostBio.photo",
    page: "about",
    sectionType: "host_bio",
    prop: "photo_path",
    get: (p) => p.about?.hostBio?.photoPath,
    derive: (d) => d.hostPhotoPath,
  },
  {
    slot: "experiences.intro",
    page: "experiences",
    sectionType: "intro",
    prop: "body",
    ai: true,
    get: (p) => p.experiences?.intro,
  },
  {
    slot: "experiences.items",
    page: "experiences",
    sectionType: "highlights",
    prop: "items",
    ai: true,
    get: (p) =>
      p.experiences?.items?.map((i) => ({
        icon: i.icon,
        title: i.title,
        body: i.body,
        image_path: i.imagePath,
      })),
  },
  {
    slot: "contact.faq",
    page: "contact",
    sectionType: "faq",
    prop: "items",
    get: (p) => p.contact?.faq,
    derive: (d) => d.policiesFaq,
  },
];

/** All bindings that apply to a given page kind. */
export function bindingsForPage(pageKind: string): SlotBinding[] {
  return SLOT_BINDINGS.filter((b) => b.page === pageKind);
}
