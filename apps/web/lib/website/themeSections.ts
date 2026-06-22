// Code-defined, professionally-designed sections + page templates attached to a
// THEME.
//
// • SECTION PRESETS — ready-made single sections (pre-set variant + styling +
//   starter copy) the host pulls into a page from the sidebar's theme group.
// • PAGE TEMPLATES — ordered compositions of those sections, so a host can start
//   a whole page from a designed layout in one click.
//
// Both are pre-configured instances of the EXISTING curated section types, so
// they render + validate through the same schema with zero new plumbing. Each
// theme's character comes from its `base` (palette + fonts via buildSiteVars);
// here we differentiate per theme through VOICE, variant, tone and ordering.
//
// Adding a theme's set = add a factory record + presets/templates arrays, then a
// REGISTRY entry keyed by the theme slug (`SiteThemeConfig.preset`). Aria is the
// exemplar; the other six built-in themes follow the same shape below.
import { newSection } from "./sectionDefaults";
import type { SectionType, WebsiteSection } from "./sections.schema";

export type ThemeSectionPreset = {
  /** Stable key (for the sidebar card key + search). */
  key: string;
  /** Sidebar card label. */
  label: string;
  /** Builds a ready-to-insert section (fresh id) pre-styled for the theme. */
  make: () => WebsiteSection;
};

export type ThemeTemplate = {
  key: string;
  label: string;
  /** One-line description shown in the template gallery. */
  description: string;
  /** Builds the full ordered section list (each with a fresh id). */
  make: () => WebsiteSection[];
};

/**
 * Build a schema-valid section of `type` with a fresh id, then let `apply`
 * mutate its (fully typed) props/tone. The cast narrows the discriminated union
 * to the requested member — sound because `newSection(type)` returns exactly
 * that member's shape.
 */
function build<T extends SectionType>(
  type: T,
  apply: (s: Extract<WebsiteSection, { type: T }>) => void,
): WebsiteSection {
  const s = newSection(type) as Extract<WebsiteSection, { type: T }>;
  apply(s);
  return s;
}

// ── Aria (the modern flagship theme) — modern editorial elegance ──────────
const aria = {
  heroSpotlight: () =>
    build("hero", (s) => {
      s.tone = "dark";
      s.props.headline = "Your escape begins here";
      s.props.subheadline = "A calm, design-led stay moments from everything.";
      s.props.cta_label = "Check availability";
      s.props.cta_href = "#book";
      s.props.align = "center";
      s.props.variant = "spotlight";
      s.props.overlay = "strong";
      s.props.textTone = "light";
      s.props.height = "tall";
    }),
  heroSplit: () =>
    build("hero", (s) => {
      s.props.headline = "Designed for the way you travel";
      s.props.subheadline =
        "Thoughtful spaces, honest pricing, direct booking.";
      s.props.cta_label = "Explore the rooms";
      s.props.cta_href = "#rooms";
      s.props.align = "left";
      s.props.variant = "split_right";
      s.props.height = "medium";
    }),
  featureTrio: () =>
    build("highlights", (s) => {
      s.props.heading = "Why guests choose us";
      s.props.variant = "grid";
      s.props.items = [
        {
          icon: "Sparkles",
          title: "Effortless stays",
          body: "Self check-in and a spotless space, every time.",
        },
        {
          icon: "MapPin",
          title: "Perfectly placed",
          body: "Minutes from the best of the area.",
        },
        {
          icon: "Heart",
          title: "Hosted with care",
          body: "Real people, quick replies, local tips.",
        },
      ];
    }),
  statsBand: () =>
    build("stats", (s) => {
      s.tone = "accent";
      s.props.variant = "band";
      s.props.items = [
        { value: "4.9★", label: "Average guest rating" },
        { value: "1,200+", label: "Happy stays" },
        { value: "24/7", label: "Host support" },
      ];
    }),
  ctaBanner: () =>
    build("cta", (s) => {
      s.tone = "dark";
      s.props.heading = "Ready when you are";
      s.props.body = "Book direct for the best rate — no booking fees, ever.";
      s.props.button_label = "Book your dates";
      s.props.button_href = "#book";
      s.props.variant = "banner";
    }),
  rooms: () =>
    build("rooms_preview", (s) => {
      s.props.heading = "Where you'll stay";
    }),
  reviews: () =>
    build("reviews", (s) => {
      s.props.heading = "Loved by guests";
      s.props.variant = "grid";
    }),
  intro: () =>
    build("intro", (s) => {
      s.props.heading = "About your hosts";
      s.props.body =
        "Tell your story here — what makes the stay, and you, special.";
      s.props.variant = "lead";
    }),
};

const ARIA_PRESETS: ThemeSectionPreset[] = [
  {
    key: "aria_hero_spotlight",
    label: "Hero — Spotlight",
    make: aria.heroSpotlight,
  },
  {
    key: "aria_hero_split",
    label: "Hero — Split feature",
    make: aria.heroSplit,
  },
  { key: "aria_feature_trio", label: "Feature trio", make: aria.featureTrio },
  { key: "aria_stats_band", label: "Stats band", make: aria.statsBand },
  {
    key: "aria_cta_banner",
    label: "Closing call-to-action",
    make: aria.ctaBanner,
  },
];

const ARIA_TEMPLATES: ThemeTemplate[] = [
  {
    key: "aria_home",
    label: "Home",
    description:
      "Spotlight hero, features, rooms, stats, reviews and a closing CTA.",
    make: () => [
      aria.heroSpotlight(),
      aria.featureTrio(),
      aria.rooms(),
      aria.statsBand(),
      aria.reviews(),
      aria.ctaBanner(),
    ],
  },
  {
    key: "aria_about",
    label: "About",
    description: "Split hero, your story, what guests love, and a CTA.",
    make: () => [
      aria.heroSplit(),
      aria.intro(),
      aria.reviews(),
      aria.ctaBanner(),
    ],
  },
];

// ── Classic — timeless boutique (elegant serif, deep green) ───────────────
const classic = {
  heroBoxed: () =>
    build("hero", (s) => {
      s.props.headline = "A timeless place to stay";
      s.props.subheadline =
        "Gracious rooms, genuine hospitality, and a welcome that lingers.";
      s.props.cta_label = "View our rooms";
      s.props.cta_href = "#rooms";
      s.props.align = "center";
      s.props.variant = "boxed";
      s.props.height = "medium";
    }),
  heroSplit: () =>
    build("hero", (s) => {
      s.props.headline = "Elegance, the way it used to be";
      s.props.subheadline =
        "Considered comfort and quiet luxury, hosted with care.";
      s.props.cta_label = "Check availability";
      s.props.cta_href = "#book";
      s.props.align = "left";
      s.props.variant = "split_left";
      s.props.height = "medium";
    }),
  hallmarks: () =>
    build("highlights", (s) => {
      s.props.heading = "The hallmarks of a stay";
      s.props.variant = "list";
      s.props.items = [
        {
          icon: "Award",
          title: "Refined comfort",
          body: "Quality linens and thoughtful details throughout.",
        },
        {
          icon: "Clock",
          title: "Attentive service",
          body: "We're here when you need us, never when you don't.",
        },
        {
          icon: "Wine",
          title: "A sense of occasion",
          body: "Spaces that make an ordinary evening feel special.",
        },
      ];
    }),
  standing: () =>
    build("stats", (s) => {
      s.tone = "accent";
      s.props.heading = "Our standing";
      s.props.variant = "cards";
      s.props.items = [
        { value: "4.9★", label: "Guest rating" },
        { value: "15 yrs", label: "Welcoming guests" },
        { value: "98%", label: "Would return" },
      ];
    }),
  invitation: () =>
    build("cta", (s) => {
      s.props.heading = "We'd be honoured to host you";
      s.props.body =
        "Reserve directly for our finest rate and a warmer welcome.";
      s.props.button_label = "Reserve your stay";
      s.props.button_href = "#book";
      s.props.variant = "card";
    }),
  story: () =>
    build("intro", (s) => {
      s.props.heading = "A house with a history";
      s.props.body =
        "Every room here has a story. Replace this with yours — what makes this house, and your hospitality, worth the journey.";
      s.props.variant = "lead";
    }),
  rooms: () =>
    build("rooms_preview", (s) => {
      s.props.heading = "Our rooms";
    }),
  reviews: () =>
    build("reviews", (s) => {
      s.props.heading = "In our guests' words";
      s.props.variant = "list";
    }),
};

const CLASSIC_PRESETS: ThemeSectionPreset[] = [
  { key: "classic_hero_boxed", label: "Hero — Boxed", make: classic.heroBoxed },
  {
    key: "classic_hero_split",
    label: "Hero — Split feature",
    make: classic.heroSplit,
  },
  {
    key: "classic_hallmarks",
    label: "Hallmarks list",
    make: classic.hallmarks,
  },
  { key: "classic_standing", label: "Standing stats", make: classic.standing },
  {
    key: "classic_invitation",
    label: "Invitation CTA",
    make: classic.invitation,
  },
];

const CLASSIC_TEMPLATES: ThemeTemplate[] = [
  {
    key: "classic_home",
    label: "Home",
    description:
      "Boxed hero, hallmarks, rooms, standing stats, reviews and an invitation.",
    make: () => [
      classic.heroBoxed(),
      classic.hallmarks(),
      classic.rooms(),
      classic.standing(),
      classic.reviews(),
      classic.invitation(),
    ],
  },
  {
    key: "classic_about",
    label: "About",
    description:
      "Split hero, the house's story, guest words and an invitation.",
    make: () => [
      classic.heroSplit(),
      classic.story(),
      classic.reviews(),
      classic.invitation(),
    ],
  },
];

// ── Modern — crisp & design-forward (clean sans, blue) ────────────────────
const modern = {
  heroSplit: () =>
    build("hero", (s) => {
      s.props.headline = "Modern stays, done right";
      s.props.subheadline =
        "Clean design, honest pricing, and a booking that takes seconds.";
      s.props.cta_label = "See availability";
      s.props.cta_href = "#book";
      s.props.align = "left";
      s.props.variant = "split_right";
      s.props.height = "medium";
    }),
  heroMinimal: () =>
    build("hero", (s) => {
      s.props.headline = "Everything you need. Nothing you don't.";
      s.props.subheadline = "A simple, beautiful stay — booked direct.";
      s.props.cta_label = "Explore rooms";
      s.props.cta_href = "#rooms";
      s.props.align = "center";
      s.props.variant = "minimal";
      s.props.height = "medium";
    }),
  features: () =>
    build("highlights", (s) => {
      s.props.heading = "Built around you";
      s.props.variant = "grid";
      s.props.items = [
        {
          icon: "Zap",
          title: "Instant booking",
          body: "Pick your dates and you're done in under a minute.",
        },
        {
          icon: "ShieldCheck",
          title: "Secure & direct",
          body: "Pay safely, deal with us — no middleman.",
        },
        {
          icon: "Smartphone",
          title: "Made for mobile",
          body: "Browse and book beautifully from any device.",
        },
      ];
    }),
  metrics: () =>
    build("stats", (s) => {
      s.tone = "accent";
      s.props.heading = "The numbers";
      s.props.variant = "band";
      s.props.items = [
        { value: "4.9", label: "Guest rating" },
        { value: "2k+", label: "Stays booked" },
        { value: "<1 min", label: "To book" },
      ];
    }),
  cta: () =>
    build("cta", (s) => {
      s.tone = "dark";
      s.props.heading = "Your dates are waiting";
      s.props.body = "Book direct for the best rate, every time.";
      s.props.button_label = "Book now";
      s.props.button_href = "#book";
      s.props.variant = "banner";
    }),
  intro: () =>
    build("intro", (s) => {
      s.props.heading = "About us";
      s.props.body =
        "A short, confident paragraph about who you are and what you do differently. Keep it clean and direct — modern guests appreciate clarity.";
      s.props.variant = "lead";
    }),
  rooms: () =>
    build("rooms_preview", (s) => {
      s.props.heading = "Rooms";
      s.props.layout = "grid";
    }),
  reviews: () =>
    build("reviews", (s) => {
      s.props.heading = "What people say";
      s.props.variant = "grid";
    }),
};

const MODERN_PRESETS: ThemeSectionPreset[] = [
  {
    key: "modern_hero_split",
    label: "Hero — Split feature",
    make: modern.heroSplit,
  },
  {
    key: "modern_hero_minimal",
    label: "Hero — Minimal",
    make: modern.heroMinimal,
  },
  { key: "modern_features", label: "Feature grid", make: modern.features },
  { key: "modern_metrics", label: "Metrics band", make: modern.metrics },
  { key: "modern_cta", label: "Closing CTA", make: modern.cta },
];

const MODERN_TEMPLATES: ThemeTemplate[] = [
  {
    key: "modern_home",
    label: "Home",
    description: "Split hero, features, rooms, metrics, reviews and a CTA.",
    make: () => [
      modern.heroSplit(),
      modern.features(),
      modern.rooms(),
      modern.metrics(),
      modern.reviews(),
      modern.cta(),
    ],
  },
  {
    key: "modern_about",
    label: "About",
    description: "Minimal hero, a tight intro, reviews and a CTA.",
    make: () => [
      modern.heroMinimal(),
      modern.intro(),
      modern.reviews(),
      modern.cta(),
    ],
  },
];

// ── Coastal — breezy seaside (airy sans, teal, soft corners) ──────────────
const coastal = {
  heroFullscreen: () =>
    build("hero", (s) => {
      s.props.headline = "Wake up by the water";
      s.props.subheadline =
        "Sea air, slow mornings, and a stay made for switching off.";
      s.props.cta_label = "Check the dates";
      s.props.cta_href = "#book";
      s.props.align = "center";
      s.props.variant = "fullscreen";
      s.props.overlay = "light";
      s.props.textTone = "light";
      s.props.height = "tall";
    }),
  heroSpotlight: () =>
    build("hero", (s) => {
      s.props.headline = "Your place at the coast";
      s.props.subheadline = "Light-filled rooms a short stroll from the shore.";
      s.props.cta_label = "View rooms";
      s.props.cta_href = "#rooms";
      s.props.align = "left";
      s.props.variant = "spotlight";
      s.props.height = "medium";
    }),
  whyHere: () =>
    build("highlights", (s) => {
      s.props.heading = "Why you'll love it here";
      s.props.variant = "grid";
      s.props.items = [
        {
          icon: "Waves",
          title: "Steps from the sea",
          body: "The beach is closer than your morning coffee.",
        },
        {
          icon: "Sun",
          title: "Light & airy",
          body: "Bright, breezy rooms that breathe.",
        },
        {
          icon: "Anchor",
          title: "Local at heart",
          body: "We'll point you to the best the coast has to offer.",
        },
      ];
    }),
  amenities: () =>
    build("amenities", (s) => {
      s.props.heading = "On hand for your stay";
      s.props.items = [
        { icon: "🌊", label: "Beach access" },
        { icon: "☀️", label: "Sun deck" },
        { icon: "🚲", label: "Bikes to borrow" },
        { icon: "☕", label: "Breakfast included" },
        { icon: "📶", label: "Fast Wi-Fi" },
        { icon: "🅿️", label: "Free parking" },
      ];
    }),
  cta: () =>
    build("cta", (s) => {
      s.tone = "accent";
      s.props.heading = "The tide's coming in";
      s.props.body =
        "Book direct and save — your seaside escape is a click away.";
      s.props.button_label = "Book your escape";
      s.props.button_href = "#book";
      s.props.variant = "banner";
    }),
  gallery: () =>
    build("gallery", (s) => {
      s.props.heading = "Postcards from the coast";
      s.props.max = 8;
    }),
  rooms: () =>
    build("rooms_preview", (s) => {
      s.props.heading = "Where you'll stay";
    }),
  reviews: () =>
    build("reviews", (s) => {
      s.props.heading = "Guests on the coast";
      s.props.variant = "grid";
    }),
  intro: () =>
    build("intro", (s) => {
      s.props.heading = "By the sea, for years";
      s.props.body =
        "Tell guests about your corner of the coast — the view, the village, the reason you never left.";
      s.props.variant = "lead";
    }),
};

const COASTAL_PRESETS: ThemeSectionPreset[] = [
  {
    key: "coastal_hero_fullscreen",
    label: "Hero — Full screen",
    make: coastal.heroFullscreen,
  },
  {
    key: "coastal_hero_spotlight",
    label: "Hero — Spotlight",
    make: coastal.heroSpotlight,
  },
  {
    key: "coastal_why_here",
    label: "Why you'll love it",
    make: coastal.whyHere,
  },
  {
    key: "coastal_amenities",
    label: "Seaside amenities",
    make: coastal.amenities,
  },
  { key: "coastal_cta", label: "Closing CTA", make: coastal.cta },
];

const COASTAL_TEMPLATES: ThemeTemplate[] = [
  {
    key: "coastal_home",
    label: "Home",
    description:
      "Full-screen hero, why-you'll-love-it, amenities, rooms, reviews and a CTA.",
    make: () => [
      coastal.heroFullscreen(),
      coastal.whyHere(),
      coastal.amenities(),
      coastal.rooms(),
      coastal.reviews(),
      coastal.cta(),
    ],
  },
  {
    key: "coastal_about",
    label: "About",
    description: "Spotlight hero, your story by the sea, a gallery and a CTA.",
    make: () => [
      coastal.heroSpotlight(),
      coastal.intro(),
      coastal.gallery(),
      coastal.cta(),
    ],
  },
];

// ── Warm — cosy & homely (warm serif, terracotta) ─────────────────────────
const warm = {
  heroSpotlight: () =>
    build("hero", (s) => {
      s.props.headline = "Feel at home from the first hello";
      s.props.subheadline =
        "Warm rooms, home-cooked touches, and hosts who treat you like family.";
      s.props.cta_label = "Find your room";
      s.props.cta_href = "#rooms";
      s.props.align = "center";
      s.props.variant = "spotlight";
      s.props.height = "medium";
    }),
  heroSplit: () =>
    build("hero", (s) => {
      s.props.headline = "Come in, stay a while";
      s.props.subheadline =
        "A relaxed, welcoming stay with everything you need to settle in.";
      s.props.cta_label = "Check availability";
      s.props.cta_href = "#book";
      s.props.align = "left";
      s.props.variant = "split_right";
      s.props.height = "medium";
    }),
  touches: () =>
    build("highlights", (s) => {
      s.props.heading = "The little touches";
      s.props.variant = "list";
      s.props.items = [
        {
          icon: "Coffee",
          title: "A proper welcome",
          body: "Fresh coffee and a friendly face when you arrive.",
        },
        {
          icon: "Home",
          title: "Homely comforts",
          body: "Cosy bedding, warm light, and a space that feels lived-in.",
        },
        {
          icon: "Heart",
          title: "Treated like family",
          body: "We look after you the way we'd look after our own.",
        },
      ];
    }),
  host: () =>
    build("host_bio", (s) => {
      s.props.heading = "Meet your hosts";
      s.props.body =
        "A few warm lines about you and your family — why you love hosting and the little things guests remember.";
      s.props.variant = "side";
    }),
  cta: () =>
    build("cta", (s) => {
      s.props.heading = "There's a room with your name on it";
      s.props.body =
        "Book direct for our friendliest rate and a warmer welcome.";
      s.props.button_label = "Book your stay";
      s.props.button_href = "#book";
      s.props.variant = "card";
    }),
  intro: () =>
    build("intro", (s) => {
      s.props.heading = "Our home, your home";
      s.props.body =
        "Tell the story of your place — how it came to be and why you love sharing it.";
      s.props.variant = "lead";
    }),
  rooms: () =>
    build("rooms_preview", (s) => {
      s.props.heading = "Our rooms";
    }),
  reviews: () =>
    build("reviews", (s) => {
      s.props.heading = "From guests who felt at home";
      s.props.variant = "grid";
    }),
};

const WARM_PRESETS: ThemeSectionPreset[] = [
  {
    key: "warm_hero_spotlight",
    label: "Hero — Spotlight",
    make: warm.heroSpotlight,
  },
  {
    key: "warm_hero_split",
    label: "Hero — Split feature",
    make: warm.heroSplit,
  },
  { key: "warm_touches", label: "Little touches list", make: warm.touches },
  { key: "warm_host", label: "Meet your hosts", make: warm.host },
  { key: "warm_cta", label: "Warm CTA", make: warm.cta },
];

const WARM_TEMPLATES: ThemeTemplate[] = [
  {
    key: "warm_home",
    label: "Home",
    description:
      "Spotlight hero, the little touches, rooms, reviews and a CTA.",
    make: () => [
      warm.heroSpotlight(),
      warm.touches(),
      warm.rooms(),
      warm.reviews(),
      warm.cta(),
    ],
  },
  {
    key: "warm_about",
    label: "About",
    description: "Split hero, your story, meet-the-hosts, reviews and a CTA.",
    make: () => [
      warm.heroSplit(),
      warm.intro(),
      warm.host(),
      warm.reviews(),
      warm.cta(),
    ],
  },
];

// ── Minimal — less, but better (stark sans, black, no radius) ─────────────
const minimal = {
  heroMinimal: () =>
    build("hero", (s) => {
      s.props.headline = "Less, but better.";
      s.props.subheadline =
        "A quiet, considered stay. Nothing more than you need.";
      s.props.cta_label = "Availability";
      s.props.cta_href = "#book";
      s.props.align = "left";
      s.props.variant = "minimal";
      s.props.height = "medium";
    }),
  heroBoxed: () =>
    build("hero", (s) => {
      s.props.headline = "Space to think";
      s.props.subheadline = "Clean lines, calm rooms, zero clutter.";
      s.props.cta_label = "Rooms";
      s.props.cta_href = "#rooms";
      s.props.align = "center";
      s.props.variant = "boxed";
      s.props.height = "medium";
    }),
  principles: () =>
    build("highlights", (s) => {
      s.props.heading = "Principles";
      s.props.variant = "plain";
      s.props.items = [
        { title: "Simplicity", body: "Every detail earns its place." },
        { title: "Calm", body: "Uncluttered rooms for an uncluttered mind." },
        { title: "Quality", body: "Fewer things, chosen well." },
      ];
    }),
  numbers: () =>
    build("stats", (s) => {
      s.props.heading = "";
      s.props.variant = "plain";
      s.props.items = [
        { value: "4.9", label: "Guest rating" },
        { value: "100%", label: "Direct booking" },
        { value: "0", label: "Hidden fees" },
      ];
    }),
  cta: () =>
    build("cta", (s) => {
      s.props.heading = "Book direct.";
      s.props.body = "Best rate. No fees. No fuss.";
      s.props.button_label = "Reserve";
      s.props.button_href = "#book";
      s.props.variant = "split";
    }),
  intro: () =>
    build("intro", (s) => {
      s.props.heading = "About";
      s.props.body =
        "A short, deliberate paragraph. Say what matters and stop.";
      s.props.variant = "lead";
    }),
  rooms: () =>
    build("rooms_preview", (s) => {
      s.props.heading = "Rooms";
    }),
  reviews: () =>
    build("reviews", (s) => {
      s.props.heading = "Reviews";
      s.props.variant = "plain";
    }),
};

const MINIMAL_PRESETS: ThemeSectionPreset[] = [
  {
    key: "minimal_hero_minimal",
    label: "Hero — Minimal",
    make: minimal.heroMinimal,
  },
  { key: "minimal_hero_boxed", label: "Hero — Boxed", make: minimal.heroBoxed },
  { key: "minimal_principles", label: "Principles", make: minimal.principles },
  { key: "minimal_numbers", label: "Numbers", make: minimal.numbers },
  { key: "minimal_cta", label: "Book-direct CTA", make: minimal.cta },
];

const MINIMAL_TEMPLATES: ThemeTemplate[] = [
  {
    key: "minimal_home",
    label: "Home",
    description: "Minimal hero, principles, rooms, numbers, reviews and a CTA.",
    make: () => [
      minimal.heroMinimal(),
      minimal.principles(),
      minimal.rooms(),
      minimal.numbers(),
      minimal.reviews(),
      minimal.cta(),
    ],
  },
  {
    key: "minimal_about",
    label: "About",
    description: "Boxed hero, a deliberate intro, reviews and a CTA.",
    make: () => [
      minimal.heroBoxed(),
      minimal.intro(),
      minimal.reviews(),
      minimal.cta(),
    ],
  },
];

// ── Nightfall — after-dark luxe (dark canvas, gold, elegant serif) ────────
const nightfall = {
  heroFullscreen: () =>
    build("hero", (s) => {
      s.tone = "dark";
      s.props.headline = "Where the night belongs to you";
      s.props.subheadline =
        "Dramatic spaces, golden light, and a stay that comes alive after dark.";
      s.props.cta_label = "Reserve your night";
      s.props.cta_href = "#book";
      s.props.align = "center";
      s.props.variant = "fullscreen";
      s.props.overlay = "strong";
      s.props.textTone = "light";
      s.props.height = "tall";
    }),
  heroSpotlight: () =>
    build("hero", (s) => {
      s.tone = "dark";
      s.props.headline = "An after-dark escape";
      s.props.subheadline = "Moody, intimate rooms designed for unwinding.";
      s.props.cta_label = "View rooms";
      s.props.cta_href = "#rooms";
      s.props.align = "left";
      s.props.variant = "spotlight";
      s.props.height = "medium";
    }),
  allure: () =>
    build("highlights", (s) => {
      s.props.heading = "The allure";
      s.props.variant = "grid";
      s.props.items = [
        {
          icon: "Moon",
          title: "Made for evenings",
          body: "Low light, deep comfort, total calm.",
        },
        {
          icon: "Sparkles",
          title: "A touch of gold",
          body: "Considered luxury in every corner.",
        },
        {
          icon: "Wine",
          title: "Stay in",
          body: "Everything you need to never want to leave.",
        },
      ];
    }),
  standing: () =>
    build("stats", (s) => {
      s.tone = "accent";
      s.props.heading = "By the numbers";
      s.props.variant = "band";
      s.props.items = [
        { value: "4.9★", label: "Guest rating" },
        { value: "5★", label: "Luxury stay" },
        { value: "24/7", label: "Concierge" },
      ];
    }),
  cta: () =>
    build("cta", (s) => {
      s.tone = "accent";
      s.props.heading = "The night is young";
      s.props.body = "Book direct for our best rate and a golden welcome.";
      s.props.button_label = "Reserve";
      s.props.button_href = "#book";
      s.props.variant = "banner";
    }),
  intro: () =>
    build("intro", (s) => {
      s.props.heading = "After dark, at our place";
      s.props.body = "Tell guests what makes the evenings here unforgettable.";
      s.props.variant = "lead";
    }),
  rooms: () =>
    build("rooms_preview", (s) => {
      s.props.heading = "The rooms";
    }),
  reviews: () =>
    build("reviews", (s) => {
      s.props.heading = "Guest impressions";
      s.props.variant = "grid";
    }),
};

const NIGHTFALL_PRESETS: ThemeSectionPreset[] = [
  {
    key: "nightfall_hero_fullscreen",
    label: "Hero — Full screen",
    make: nightfall.heroFullscreen,
  },
  {
    key: "nightfall_hero_spotlight",
    label: "Hero — Spotlight",
    make: nightfall.heroSpotlight,
  },
  { key: "nightfall_allure", label: "The allure", make: nightfall.allure },
  {
    key: "nightfall_standing",
    label: "Standing stats",
    make: nightfall.standing,
  },
  { key: "nightfall_cta", label: "After-dark CTA", make: nightfall.cta },
];

const NIGHTFALL_TEMPLATES: ThemeTemplate[] = [
  {
    key: "nightfall_home",
    label: "Home",
    description:
      "Full-screen hero, the allure, rooms, standing stats, reviews and a CTA.",
    make: () => [
      nightfall.heroFullscreen(),
      nightfall.allure(),
      nightfall.rooms(),
      nightfall.standing(),
      nightfall.reviews(),
      nightfall.cta(),
    ],
  },
  {
    key: "nightfall_about",
    label: "About",
    description: "Spotlight hero, your after-dark story, reviews and a CTA.",
    make: () => [
      nightfall.heroSpotlight(),
      nightfall.intro(),
      nightfall.reviews(),
      nightfall.cta(),
    ],
  },
];

// ── Registry (keyed by theme slug = SiteThemeConfig.preset) ───────────────
const PRESETS: Record<string, ThemeSectionPreset[]> = {
  aria: ARIA_PRESETS,
  classic: CLASSIC_PRESETS,
  modern: MODERN_PRESETS,
  coastal: COASTAL_PRESETS,
  warm: WARM_PRESETS,
  minimal: MINIMAL_PRESETS,
  nightfall: NIGHTFALL_PRESETS,
};
const TEMPLATES: Record<string, ThemeTemplate[]> = {
  aria: ARIA_TEMPLATES,
  classic: CLASSIC_TEMPLATES,
  modern: MODERN_TEMPLATES,
  coastal: COASTAL_TEMPLATES,
  warm: WARM_TEMPLATES,
  minimal: MINIMAL_TEMPLATES,
  nightfall: NIGHTFALL_TEMPLATES,
};

/** Designed section presets for a theme slug (empty when the theme ships none). */
export function getThemeSectionPresets(
  themeSlug: string | undefined | null,
): ThemeSectionPreset[] {
  return (themeSlug && PRESETS[themeSlug]) || [];
}

/** Designed page templates for a theme slug (empty when the theme ships none). */
export function getThemeTemplates(
  themeSlug: string | undefined | null,
): ThemeTemplate[] {
  return (themeSlug && TEMPLATES[themeSlug]) || [];
}

/** Human label for the sidebar theme group (capitalised slug, fallback "Theme"). */
export function themeGroupLabel(themeSlug: string | undefined | null): string {
  if (!themeSlug) return "Theme";
  return themeSlug.charAt(0).toUpperCase() + themeSlug.slice(1);
}
