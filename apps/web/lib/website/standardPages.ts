// The canonical theme page set (THEME_CONTRACT.md — "The canonical page set every
// theme MUST ship"). This is the SHARED foundation: every theme seeds these
// required marketing pages, whether or not its own DB blueprint defines them. A
// theme's own page (matched by `kind`) always wins; any REQUIRED page the theme
// omits is filled here with a sensible default spine. The spines use shared
// section `type`s, so they render in the active theme's scoped CSS via the
// type-dispatched renderer (Safari bands / generic fallback) — no per-theme work.
//
// Adding a new theme therefore does NOT require re-listing every page: define only
// the pages you want to art-direct; the rest are guaranteed by mergeStandardPages.

import type { ThemePageTemplate } from "@/lib/site/themes.server";

const uuid = () => crypto.randomUUID();

type Section = { id: string; type: string; enabled: boolean; props?: unknown };

/** Mint a section with a fresh id (matches the seeding shape in actions.ts). */
function s(type: string, props?: Record<string, unknown>): Section {
  return { id: uuid(), type, enabled: true, ...(props ? { props } : {}) };
}

// --- Default section spines per required page kind --------------------------
// Stock copy is intentionally generic + on-brand-neutral; data-bound sections
// (specials_preview / gallery / rooms_preview / location / reviews / form) fill
// from the host's live data at render and auto-hide when empty.

function homeSpine(siteName: string): Section[] {
  return [
    s("hero", {
      headline: siteName,
      subheadline: "Book your stay with us directly — no booking fees.",
      align: "center",
    }),
    s("intro", {
      heading: "Welcome",
      body: "Tell guests what makes your place special — the setting, the welcome, the little touches they’ll remember.",
    }),
    s("rooms_preview", { heading: "Rooms & rates", max: 6 }),
    s("specials_preview", { heading: "Special offers", max: 3 }),
    s("gallery", { heading: "A look around" }),
    s("reviews", { heading: "What guests say", max: 6 }),
    s("location", { heading: "Where you’ll be", show_map: true }),
    s("cta", {
      heading: "Ready to book?",
      body: "Reserve your dates directly — no booking fees.",
      button_label: "Check availability",
      button_href: "/rooms",
    }),
  ];
}

function aboutSpine(siteName: string): Section[] {
  return [
    s("intro", {
      heading: `About ${siteName}`,
      body: "Share your story — who you are, why you host, and what guests can expect.",
    }),
    s("host_bio", {
      heading: "Your host",
      body: "A few warm lines about you and your team.",
    }),
    s("gallery", { heading: "Moments here" }),
  ];
}

function roomsSpine(): Section[] {
  return [
    s("intro", {
      heading: "Where you’ll stay",
      body: "Browse the rooms and choose the one that fits your trip.",
    }),
    s("rooms_preview", { heading: "Rooms & rates", max: 9 }),
    s("amenities", { heading: "What’s on offer" }),
    s("rate_table", { heading: "Nightly rates" }),
    s("cta", {
      heading: "Ready to book?",
      body: "Check availability and reserve directly.",
      button_label: "Check availability",
      button_href: "/rooms",
    }),
  ];
}

function specialsSpine(): Section[] {
  return [
    s("intro", {
      heading: "Special offers",
      body: "Limited-time deals and packages — book direct for the best rate.",
    }),
    s("specials_preview", { heading: "Current specials", max: 12 }),
    s("cta", {
      heading: "Don’t see your dates?",
      body: "Get in touch and we’ll help you find the right stay.",
      button_label: "Contact us",
      button_href: "/contact",
    }),
  ];
}

function experiencesSpine(): Section[] {
  return [
    s("intro", {
      heading: "Things to do",
      body: "Make the most of your stay — here’s what awaits beyond your room.",
    }),
    s("highlights", {
      heading: "Experiences",
      variant: "grid",
      items: [
        {
          icon: "Compass",
          title: "Explore",
          body: "Describe a signature experience guests can enjoy nearby.",
        },
        {
          icon: "Utensils",
          title: "Taste",
          body: "Dining, local flavours, or something you serve on-site.",
        },
        {
          icon: "Sparkles",
          title: "Unwind",
          body: "A way guests relax — spa, pool, fire, or quiet views.",
        },
      ],
    }),
    s("gallery", { heading: "A taste of it" }),
    s("cta", {
      heading: "Plan your stay around it",
      body: "Reserve your dates and we’ll help with the rest.",
      button_label: "Check availability",
      button_href: "/rooms",
    }),
  ];
}

function gallerySpine(): Section[] {
  return [
    s("intro", {
      heading: "Gallery",
      body: "A closer look at the rooms, the spaces, and the surroundings.",
    }),
    s("gallery", { heading: "" }),
    s("cta", {
      heading: "Like what you see?",
      body: "Check availability and book your stay directly.",
      button_label: "Check availability",
      button_href: "/rooms",
    }),
  ];
}

function contactSpine(): Section[] {
  return [
    s("intro", {
      heading: "Get in touch",
      body: "Questions about a stay, a special request, or a group booking? Send us a message.",
    }),
    s("form", { heading: "Send a message" }),
    s("location", { heading: "Find us", show_map: true }),
    s("faq", { heading: "Good to know", variant: "accordion" }),
  ];
}

/** One required Class-1 page in the canonical set. `build` returns its default
 * section spine, used only when the active theme's blueprint omits this kind. */
type StandardPageDef = {
  kind: string;
  slug: string;
  title: string;
  nav_label: string;
  /** Canonical relative order among the standard pages (Home first). */
  order: number;
  build: (siteName: string) => Section[];
};

/** The required marketing pages every theme must ship, in canonical nav order.
 * Blog is intentionally absent — it is OPTIONAL per the contract. System
 * templates (checkout/thank-you/room_detail/search_results) are seeded elsewhere
 * (lazily / by their own flows), not here. */
export const REQUIRED_STANDARD_PAGES: StandardPageDef[] = [
  {
    kind: "home",
    slug: "home",
    title: "Home",
    nav_label: "Home",
    order: 0,
    build: homeSpine,
  },
  {
    kind: "rooms",
    slug: "rooms",
    title: "Rooms",
    nav_label: "Rooms",
    order: 1,
    build: roomsSpine,
  },
  {
    kind: "specials",
    slug: "specials",
    title: "Specials",
    nav_label: "Specials",
    order: 2,
    build: specialsSpine,
  },
  {
    kind: "experiences",
    slug: "experiences",
    title: "Experiences",
    nav_label: "Experiences",
    order: 3,
    build: experiencesSpine,
  },
  {
    kind: "gallery",
    slug: "gallery",
    title: "Gallery",
    nav_label: "Gallery",
    order: 4,
    build: gallerySpine,
  },
  {
    kind: "about",
    slug: "about",
    title: "About",
    nav_label: "About",
    order: 5,
    build: aboutSpine,
  },
  {
    kind: "contact",
    slug: "contact",
    title: "Contact",
    nav_label: "Contact",
    order: 6,
    build: contactSpine,
  },
];

/** The full set of required pages as ThemePageTemplates — used as the fallback
 * when a theme ships NO blueprint at all (replaces the old home+about stub). */
export function standardPageTemplates(siteName: string): ThemePageTemplate[] {
  return REQUIRED_STANDARD_PAGES.map((p) => ({
    kind: p.kind,
    slug: p.slug,
    title: p.kind === "home" ? siteName : p.title,
    nav_label: p.nav_label,
    nav_order: p.order,
    show_in_nav: true,
    sections: p.build(siteName),
  }));
}

/**
 * Guarantee the required page set: keep every page the theme defines (it wins by
 * `kind`), then append any REQUIRED page the theme omits, using its default
 * spine. Added pages are placed after the theme's current pages in nav order (the
 * host can reorder in the Pages manager), keeping the canonical order among
 * themselves. Theme pages are returned untouched.
 */
export function mergeStandardPages(
  themePages: ThemePageTemplate[],
  siteName: string,
): ThemePageTemplate[] {
  if (!themePages.length) return standardPageTemplates(siteName);

  const haveKinds = new Set(themePages.map((p) => p.kind));
  const maxNav = themePages.reduce(
    (m, p) => Math.max(m, typeof p.nav_order === "number" ? p.nav_order : 0),
    0,
  );

  const missing = REQUIRED_STANDARD_PAGES.filter((p) => !haveKinds.has(p.kind))
    .sort((a, b) => a.order - b.order)
    .map((p, i) => ({
      kind: p.kind,
      slug: p.slug,
      title: p.kind === "home" ? siteName : p.title,
      nav_label: p.nav_label,
      nav_order: maxNav + 1 + i,
      show_in_nav: true,
      sections: p.build(siteName),
    }));

  return [...themePages, ...missing];
}
