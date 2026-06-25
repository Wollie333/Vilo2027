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
  contactForm: () =>
    build("contact_form", (s) => {
      s.props.heading = "Get in touch";
      s.props.body =
        "Questions about your stay? Send us a message — we usually reply within a few hours.";
      s.props.variant = "split";
    }),
  faq: () =>
    build("faq", (s) => {
      s.props.heading = "Before you ask";
      s.props.variant = "accordion";
      s.props.items = [
        {
          q: "What time is check-in?",
          a: "Check-in is from 14:00 and check-out by 10:00 — flexible times on request.",
        },
        {
          q: "Is parking available?",
          a: "Yes — secure on-site parking, free for every guest.",
        },
        {
          q: "What's your cancellation policy?",
          a: "Free cancellation up to 7 days before arrival. Replace this with your own policy.",
        },
      ];
    }),
  location: () =>
    build("location", (s) => {
      s.props.heading = "Find us";
      s.props.variant = "split";
    }),
  amenities: () =>
    build("amenities", (s) => {
      s.props.heading = "Everything you need";
      s.props.items = [
        { icon: "📶", label: "Fast Wi-Fi" },
        { icon: "🅿️", label: "Free parking" },
        { icon: "☕", label: "Breakfast" },
        { icon: "❄️", label: "Air-conditioning" },
        { icon: "🏊", label: "Pool" },
        { icon: "🧺", label: "Laundry" },
      ];
    }),
  pricing: () =>
    build("pricing", (s) => {
      s.props.heading = "Rates";
      s.props.items = [
        { label: "Standard room", price: "R1 200", note: "per night" },
        { label: "Deluxe suite", price: "R2 400", note: "per night" },
      ];
      s.props.footnote =
        "Rates are indicative — your final price is confirmed at booking.";
    }),
  blog: () =>
    build("blog_preview", (s) => {
      s.props.heading = "From the journal";
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
  { key: "aria_contact_form", label: "Contact form", make: aria.contactForm },
  { key: "aria_faq", label: "FAQ", make: aria.faq },
  { key: "aria_amenities", label: "Amenities", make: aria.amenities },
  { key: "aria_pricing", label: "Rates", make: aria.pricing },
  { key: "aria_blog", label: "Blog posts", make: aria.blog },
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
  {
    key: "aria_contact",
    label: "Contact",
    description: "Contact form, where to find you, FAQs and a closing CTA.",
    make: () => [
      aria.contactForm(),
      aria.location(),
      aria.faq(),
      aria.ctaBanner(),
    ],
  },
  {
    key: "aria_rooms",
    label: "Rooms",
    description: "Your rooms, what's included, the rates and a closing CTA.",
    make: () => [
      aria.rooms(),
      aria.amenities(),
      aria.pricing(),
      aria.ctaBanner(),
    ],
  },
  {
    key: "aria_blog",
    label: "Blog",
    description: "Your latest journal posts and a closing CTA.",
    make: () => [aria.blog(), aria.ctaBanner()],
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
  contactForm: () =>
    build("contact_form", (s) => {
      s.props.heading = "Make an enquiry";
      s.props.body =
        "We'd be glad to answer any question before your stay. Do write to us.";
      s.props.variant = "stacked";
    }),
  faq: () =>
    build("faq", (s) => {
      s.props.heading = "Frequently asked";
      s.props.variant = "accordion";
      s.props.items = [
        {
          q: "What time may I arrive?",
          a: "Check-in is from 14:00, check-out by 10:00 — we'll gladly accommodate where we can.",
        },
        {
          q: "Is parking provided?",
          a: "Yes — complimentary, secure parking for resident guests.",
        },
        {
          q: "How do cancellations work?",
          a: "Free cancellation up to 7 days before arrival. Replace this with your own policy.",
        },
      ];
    }),
  location: () =>
    build("location", (s) => {
      s.props.heading = "Where to find us";
      s.props.variant = "split";
    }),
  amenities: () =>
    build("amenities", (s) => {
      s.props.heading = "Comforts & conveniences";
      s.props.items = [
        { icon: "🛏️", label: "Quality linens" },
        { icon: "☕", label: "Breakfast served" },
        { icon: "🅿️", label: "Private parking" },
        { icon: "📶", label: "Wi-Fi throughout" },
        { icon: "🛎️", label: "Attentive service" },
        { icon: "🌿", label: "Garden & grounds" },
      ];
    }),
  pricing: () =>
    build("pricing", (s) => {
      s.props.heading = "Our rates";
      s.props.items = [
        { label: "Classic room", price: "R1 400", note: "per night" },
        { label: "Garden suite", price: "R2 600", note: "per night" },
      ];
      s.props.footnote =
        "Rates are indicative — your final price is confirmed at reservation.";
    }),
  blog: () =>
    build("blog_preview", (s) => {
      s.props.heading = "From the journal";
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
  {
    key: "classic_contact_form",
    label: "Contact form",
    make: classic.contactForm,
  },
  { key: "classic_faq", label: "FAQ", make: classic.faq },
  { key: "classic_amenities", label: "Amenities", make: classic.amenities },
  { key: "classic_pricing", label: "Rates", make: classic.pricing },
  { key: "classic_blog", label: "Blog posts", make: classic.blog },
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
  {
    key: "classic_contact",
    label: "Contact",
    description: "An enquiry form, where to find you, FAQs and an invitation.",
    make: () => [
      classic.contactForm(),
      classic.location(),
      classic.faq(),
      classic.invitation(),
    ],
  },
  {
    key: "classic_rooms",
    label: "Rooms",
    description: "Our rooms, the comforts within, our rates and an invitation.",
    make: () => [
      classic.rooms(),
      classic.amenities(),
      classic.pricing(),
      classic.invitation(),
    ],
  },
  {
    key: "classic_blog",
    label: "Blog",
    description: "The latest from the journal and an invitation.",
    make: () => [classic.blog(), classic.invitation()],
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
  contactForm: () =>
    build("contact_form", (s) => {
      s.props.heading = "Say hello";
      s.props.body = "Drop us a line — we'll get back to you fast.";
      s.props.variant = "split";
    }),
  faq: () =>
    build("faq", (s) => {
      s.props.heading = "Quick answers";
      s.props.variant = "accordion";
      s.props.items = [
        {
          q: "When can I check in?",
          a: "From 14:00, with check-out by 10:00. Flexible times? Just ask.",
        },
        {
          q: "Do you have parking?",
          a: "Yes — free, secure on-site parking for guests.",
        },
        {
          q: "Can I cancel?",
          a: "Free cancellation up to 7 days before arrival. Swap in your own policy.",
        },
      ];
    }),
  location: () =>
    build("location", (s) => {
      s.props.heading = "Where we are";
      s.props.variant = "split";
    }),
  amenities: () =>
    build("amenities", (s) => {
      s.props.heading = "What's included";
      s.props.items = [
        { icon: "📶", label: "Fast Wi-Fi" },
        { icon: "🔌", label: "Smart TV" },
        { icon: "🅿️", label: "Free parking" },
        { icon: "❄️", label: "Climate control" },
        { icon: "🍳", label: "Kitchenette" },
        { icon: "🔑", label: "Self check-in" },
      ];
    }),
  pricing: () =>
    build("pricing", (s) => {
      s.props.heading = "Rates";
      s.props.items = [
        { label: "Studio", price: "R1 100", note: "per night" },
        { label: "One-bedroom", price: "R1 900", note: "per night" },
      ];
      s.props.footnote =
        "Final price is confirmed at booking — no hidden fees.";
    }),
  blog: () =>
    build("blog_preview", (s) => {
      s.props.heading = "Latest";
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
  {
    key: "modern_contact_form",
    label: "Contact form",
    make: modern.contactForm,
  },
  { key: "modern_faq", label: "FAQ", make: modern.faq },
  { key: "modern_amenities", label: "Amenities", make: modern.amenities },
  { key: "modern_pricing", label: "Rates", make: modern.pricing },
  { key: "modern_blog", label: "Blog posts", make: modern.blog },
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
  {
    key: "modern_contact",
    label: "Contact",
    description: "Contact form, where we are, quick answers and a CTA.",
    make: () => [
      modern.contactForm(),
      modern.location(),
      modern.faq(),
      modern.cta(),
    ],
  },
  {
    key: "modern_rooms",
    label: "Rooms",
    description: "Rooms, what's included, rates and a CTA.",
    make: () => [
      modern.rooms(),
      modern.amenities(),
      modern.pricing(),
      modern.cta(),
    ],
  },
  {
    key: "modern_blog",
    label: "Blog",
    description: "Your latest posts and a CTA.",
    make: () => [modern.blog(), modern.cta()],
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
  contactForm: () =>
    build("contact_form", (s) => {
      s.props.heading = "Send us a wave";
      s.props.body =
        "Questions about the coast or your stay? We're always happy to help.";
      s.props.variant = "stacked";
    }),
  faq: () =>
    build("faq", (s) => {
      s.props.heading = "Good to know";
      s.props.variant = "accordion";
      s.props.items = [
        {
          q: "What time is check-in?",
          a: "From 14:00, check-out by 10:00 — flexible times where the tide allows.",
        },
        {
          q: "Is the beach really that close?",
          a: "Yes — a short stroll from the door. Towels and beach chairs are provided.",
        },
        {
          q: "What's the cancellation policy?",
          a: "Free cancellation up to 7 days before arrival. Replace with your own policy.",
        },
      ];
    }),
  location: () =>
    build("location", (s) => {
      s.props.heading = "Find your way to the coast";
      s.props.variant = "split";
    }),
  pricing: () =>
    build("pricing", (s) => {
      s.props.heading = "Rates";
      s.props.items = [
        { label: "Sea-view room", price: "R1 600", note: "per night" },
        { label: "Beach suite", price: "R2 800", note: "per night" },
      ];
      s.props.footnote =
        "Rates are indicative — your final price is confirmed at booking.";
    }),
  blog: () =>
    build("blog_preview", (s) => {
      s.props.heading = "Coast notes";
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
  {
    key: "coastal_contact_form",
    label: "Contact form",
    make: coastal.contactForm,
  },
  { key: "coastal_faq", label: "FAQ", make: coastal.faq },
  { key: "coastal_pricing", label: "Rates", make: coastal.pricing },
  { key: "coastal_blog", label: "Blog posts", make: coastal.blog },
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
  {
    key: "coastal_contact",
    label: "Contact",
    description: "Contact form, directions to the coast, FAQs and a CTA.",
    make: () => [
      coastal.contactForm(),
      coastal.location(),
      coastal.faq(),
      coastal.cta(),
    ],
  },
  {
    key: "coastal_rooms",
    label: "Rooms",
    description: "Your rooms, seaside amenities, the rates and a CTA.",
    make: () => [
      coastal.rooms(),
      coastal.amenities(),
      coastal.pricing(),
      coastal.cta(),
    ],
  },
  {
    key: "coastal_blog",
    label: "Blog",
    description: "Notes from the coast and a CTA.",
    make: () => [coastal.blog(), coastal.cta()],
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
  contactForm: () =>
    build("contact_form", (s) => {
      s.props.heading = "Drop us a line";
      s.props.body =
        "Have a question before you come to stay? We'd love to hear from you.";
      s.props.variant = "stacked";
    }),
  faq: () =>
    build("faq", (s) => {
      s.props.heading = "Things guests often ask";
      s.props.variant = "accordion";
      s.props.items = [
        {
          q: "When can we arrive?",
          a: "Check-in is from 14:00 and check-out by 10:00 — let us know and we'll do our best to help.",
        },
        {
          q: "Is breakfast included?",
          a: "A home-style breakfast is on us every morning. Dietary needs? Just tell us.",
        },
        {
          q: "What if our plans change?",
          a: "Free cancellation up to 7 days before arrival. Replace this with your own policy.",
        },
      ];
    }),
  location: () =>
    build("location", (s) => {
      s.props.heading = "How to find us";
      s.props.variant = "split";
    }),
  amenities: () =>
    build("amenities", (s) => {
      s.props.heading = "Home comforts";
      s.props.items = [
        { icon: "☕", label: "Home-cooked breakfast" },
        { icon: "🔥", label: "Cosy fireplace" },
        { icon: "📶", label: "Free Wi-Fi" },
        { icon: "🅿️", label: "Off-street parking" },
        { icon: "🧺", label: "Laundry on request" },
        { icon: "🐾", label: "Pet friendly" },
      ];
    }),
  pricing: () =>
    build("pricing", (s) => {
      s.props.heading = "Our rates";
      s.props.items = [
        { label: "Double room", price: "R1 100", note: "per night" },
        { label: "Family room", price: "R1 800", note: "per night" },
      ];
      s.props.footnote =
        "Breakfast included. Final price confirmed at booking.";
    }),
  blog: () =>
    build("blog_preview", (s) => {
      s.props.heading = "Stories from home";
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
  { key: "warm_contact_form", label: "Contact form", make: warm.contactForm },
  { key: "warm_faq", label: "FAQ", make: warm.faq },
  { key: "warm_amenities", label: "Amenities", make: warm.amenities },
  { key: "warm_pricing", label: "Rates", make: warm.pricing },
  { key: "warm_blog", label: "Blog posts", make: warm.blog },
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
  {
    key: "warm_contact",
    label: "Contact",
    description: "A friendly contact form, how to find you, FAQs and a CTA.",
    make: () => [warm.contactForm(), warm.location(), warm.faq(), warm.cta()],
  },
  {
    key: "warm_rooms",
    label: "Rooms",
    description: "Our rooms, the home comforts, our rates and a CTA.",
    make: () => [warm.rooms(), warm.amenities(), warm.pricing(), warm.cta()],
  },
  {
    key: "warm_blog",
    label: "Blog",
    description: "Stories from home and a CTA.",
    make: () => [warm.blog(), warm.cta()],
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
  contactForm: () =>
    build("contact_form", (s) => {
      s.props.heading = "Contact";
      s.props.body = "A question? Send it. We'll reply.";
      s.props.variant = "stacked";
    }),
  faq: () =>
    build("faq", (s) => {
      s.props.heading = "FAQ";
      s.props.variant = "plain";
      s.props.items = [
        { q: "Check-in?", a: "From 14:00. Check-out by 10:00." },
        { q: "Parking?", a: "Yes. On-site. Free." },
        {
          q: "Cancellation?",
          a: "Free up to 7 days before arrival. Edit to match your policy.",
        },
      ];
    }),
  location: () =>
    build("location", (s) => {
      s.props.heading = "Location";
      s.props.variant = "list";
    }),
  amenities: () =>
    build("amenities", (s) => {
      s.props.heading = "Included";
      s.props.items = [
        { label: "Wi-Fi" },
        { label: "Parking" },
        { label: "Breakfast" },
        { label: "Heating & cooling" },
        { label: "Workspace" },
        { label: "Self check-in" },
      ];
    }),
  pricing: () =>
    build("pricing", (s) => {
      s.props.heading = "Rates";
      s.props.items = [
        { label: "Room", price: "R1 000", note: "per night" },
        { label: "Suite", price: "R1 800", note: "per night" },
      ];
      s.props.footnote = "Final price confirmed at booking.";
    }),
  blog: () =>
    build("blog_preview", (s) => {
      s.props.heading = "Notes";
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
  {
    key: "minimal_contact_form",
    label: "Contact form",
    make: minimal.contactForm,
  },
  { key: "minimal_faq", label: "FAQ", make: minimal.faq },
  { key: "minimal_amenities", label: "Amenities", make: minimal.amenities },
  { key: "minimal_pricing", label: "Rates", make: minimal.pricing },
  { key: "minimal_blog", label: "Blog posts", make: minimal.blog },
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
  {
    key: "minimal_contact",
    label: "Contact",
    description: "Contact, location, FAQ, book direct.",
    make: () => [
      minimal.contactForm(),
      minimal.location(),
      minimal.faq(),
      minimal.cta(),
    ],
  },
  {
    key: "minimal_rooms",
    label: "Rooms",
    description: "Rooms, included, rates, book direct.",
    make: () => [
      minimal.rooms(),
      minimal.amenities(),
      minimal.pricing(),
      minimal.cta(),
    ],
  },
  {
    key: "minimal_blog",
    label: "Blog",
    description: "Notes, book direct.",
    make: () => [minimal.blog(), minimal.cta()],
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
  contactForm: () =>
    build("contact_form", (s) => {
      s.props.heading = "Reach out";
      s.props.body =
        "For reservations and enquiries, send us a message — we'll respond promptly.";
      s.props.variant = "split";
    }),
  faq: () =>
    build("faq", (s) => {
      s.props.heading = "Questions";
      s.props.variant = "accordion";
      s.props.items = [
        {
          q: "What are the check-in hours?",
          a: "Check-in from 14:00, check-out by 10:00 — late arrivals welcome by arrangement.",
        },
        {
          q: "Is there a concierge?",
          a: "Yes — on hand around the clock to make your evening effortless.",
        },
        {
          q: "How do cancellations work?",
          a: "Free cancellation up to 7 days before arrival. Replace this with your own policy.",
        },
      ];
    }),
  location: () =>
    build("location", (s) => {
      s.props.heading = "Where to find us";
      s.props.variant = "split";
    }),
  amenities: () =>
    build("amenities", (s) => {
      s.props.heading = "In residence";
      s.props.items = [
        { icon: "🥂", label: "Welcome drink" },
        { icon: "🌙", label: "Blackout curtains" },
        { icon: "📶", label: "Fast Wi-Fi" },
        { icon: "🛁", label: "Deep soaking tub" },
        { icon: "🍷", label: "In-room minibar" },
        { icon: "🛎️", label: "24/7 concierge" },
      ];
    }),
  pricing: () =>
    build("pricing", (s) => {
      s.tone = "accent";
      s.props.heading = "Rates";
      s.props.items = [
        { label: "Twilight room", price: "R2 200", note: "per night" },
        { label: "Midnight suite", price: "R3 900", note: "per night" },
      ];
      s.props.footnote =
        "Rates are indicative — your final price is confirmed at booking.";
    }),
  blog: () =>
    build("blog_preview", (s) => {
      s.props.heading = "After dark";
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
  {
    key: "nightfall_contact_form",
    label: "Contact form",
    make: nightfall.contactForm,
  },
  { key: "nightfall_faq", label: "FAQ", make: nightfall.faq },
  {
    key: "nightfall_amenities",
    label: "Amenities",
    make: nightfall.amenities,
  },
  { key: "nightfall_pricing", label: "Rates", make: nightfall.pricing },
  { key: "nightfall_blog", label: "Blog posts", make: nightfall.blog },
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
  {
    key: "nightfall_contact",
    label: "Contact",
    description: "Contact form, where to find you, FAQs and a closing CTA.",
    make: () => [
      nightfall.contactForm(),
      nightfall.location(),
      nightfall.faq(),
      nightfall.cta(),
    ],
  },
  {
    key: "nightfall_rooms",
    label: "Rooms",
    description: "The rooms, what's in residence, the rates and a CTA.",
    make: () => [
      nightfall.rooms(),
      nightfall.amenities(),
      nightfall.pricing(),
      nightfall.cta(),
    ],
  },
  {
    key: "nightfall_blog",
    label: "Blog",
    description: "After-dark reading and a CTA.",
    make: () => [nightfall.blog(), nightfall.cta()],
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
