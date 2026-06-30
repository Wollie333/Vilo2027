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

// ── Room-detail blocks (theme-agnostic; styling comes from the theme base) ──
// The /rooms/<slug> route injects the active room into each of these.
const roomDetail = {
  gallery: () =>
    build("room_gallery", (s) => {
      // Directory-style hero mosaic (big photo + grid + "View all") with lightbox.
      s.props.variant = "mosaic";
      s.props.max = 12;
    }),
  overview: () =>
    build("room_overview", (s) => {
      s.props.show_facts = true;
      s.props.show_price = true;
      s.props.variant = "split";
    }),
  amenities: () =>
    build("room_amenities", (s) => {
      s.props.heading = "Room amenities";
      s.props.variant = "grid";
    }),
  rate: () =>
    build("room_rate", (s) => {
      s.props.cta_label = "Book this room";
      s.props.note = "Your final price is confirmed at checkout.";
      s.props.variant = "card";
    }),
  policies: () =>
    build("room_policies", (s) => {
      // Auto "things to know" (cancellation, check-in/out, house rules) pulled
      // from the parent property — like the listing's policy block, per room.
      s.props.heading = "Things to know";
      s.props.variant = "grid";
    }),
};

// ── Safari — unfenced wilderness lodge (savanna ochre, bushveld green) ────
// Voice modelled on the NenGama Lodge design: evocative, unhurried, the bush at
// your door. Dark bands (tone "dark") echo the design's alternating dark
// sections; the warm bone/ochre palette + serif display come from the base.
const safari = {
  heroFull: () =>
    build("hero", (s) => {
      s.tone = "dark";
      s.props.headline = "Where the wild still runs";
      s.props.subheadline =
        "An unfenced lodge deep in the Waterberg — a handful of suites, wide skies, and the bush at your door.";
      s.props.cta_label = "Check availability";
      s.props.cta_href = "#book";
      s.props.cta2_label = "Our story";
      s.props.cta2_href = "/about";
      s.props.stats = [
        { value: "12,000", label: "Hectares" },
        { value: "Big Five", label: "Free-roaming" },
        { value: "4.98 ★★★★★", label: "214 guest stays" },
      ];
      // The NenGama home hero is left-aligned (the bespoke design); the host can
      // switch to centre/right in the builder.
      s.props.align = "left";
      s.props.variant = "fullscreen";
      s.props.overlay = "strong";
      s.props.textTone = "light";
      s.props.height = "tall";
    }),
  heroSplit: () =>
    build("hero", (s) => {
      s.props.headline = "A house at the heart of the bush";
      s.props.subheadline =
        "Twelve thousand hectares, three suites, and nothing between you and the horizon.";
      s.props.cta_label = "Explore the lodge";
      s.props.cta_href = "#rooms";
      s.props.align = "left";
      s.props.variant = "split_right";
      s.props.height = "medium";
    }),
  story: () =>
    build("intro", (s) => {
      s.props.heading = "An unfenced wilderness";
      s.props.body =
        "Some places you pass through. This one stays with you. Days here move to the rhythm of the reserve — early light, long drives, the slow hush of the afternoon, and a fire under more stars than you have ever seen.\n\nReplace this with your own story: the land, the welcome, and why guests make the journey.";
      s.props.variant = "lead";
    }),
  // ── About-page blocks (the bespoke NenGama About design) ──
  aboutHero: () =>
    build("hero", (s) => {
      s.props.compact = true;
      s.props.eyebrow = "About";
      s.props.headline = "A family, a fence line we chose to remove";
      s.props.subheadline =
        "Since 2009 we've given this corner of the Waterberg back to the wild — and opened just three doors to share it.";
    }),
  aboutStory: () =>
    build("intro", (s) => {
      s.props.eyebrow = "Our story";
      s.props.heading = "The land came first";
      s.props.body =
        "This began as a worn-out cattle farm — overgrazed, fenced into squares, its wildlife long gone. We bought the first 3,000 hectares with a single idea: take the fences down and let the bush decide what it wanted to be.\n\nFifteen years on, those squares are one unbroken wilderness. The grass came back, then the antelope, then the predators that follow them.";
      s.props.badge_value = "12,000";
      s.props.badge_label = "Hectares rewilded";
      s.props.variant = "lead";
    }),
  aboutStats: () =>
    build("stats", (s) => {
      s.props.items = [
        { value: "15", label: "Years rewilding" },
        { value: "3", label: "Suites only" },
        { value: "340+", label: "Species recorded" },
        { value: "0", label: "Internal fences" },
      ];
    }),
  aboutConservation: () =>
    build("host_bio", (s) => {
      s.props.reverse = true;
      s.props.heading = "Conservation";
      s.props.name = "Every stay protects the wild";
      s.props.body =
        "We keep the lodge small on purpose. Fewer guests means lighter footprints and a bigger share of every booking going where it matters — into the land and the people who guard it.";
      s.props.points = [
        { text: "A full-time anti-poaching unit on the reserve" },
        { text: "Black & white rhino monitored daily" },
        { text: "40 local people employed from neighbouring villages" },
        { text: "Borehole-fed waterholes through the dry season" },
      ];
    }),
  aboutFounderNote: () =>
    build("host_bio", (s) => {
      s.props.variant = "centered";
      s.props.heading = "A note from the family";
      s.props.body =
        "We don't think of ourselves as hoteliers. We're custodians who happen to keep three beautiful rooms. Come as our guests, leave as part of the reason this place still exists.";
      s.props.name = "Lethabo & Naledi Mokoena";
    }),
  aboutValues: () =>
    build("values", (s) => {
      s.props.heading = "Three quiet promises";
      s.props.items = [
        {
          title: "Space, not crowds",
          body: "Never more than six guests in the vehicle, and often it's just you and your ranger under the whole sky.",
        },
        {
          title: "Honest pricing",
          body: "One inclusive rate, booked direct with us. No agents, no booking fees, no commission. The price you're quoted is the price you pay.",
        },
        {
          title: "People of this place",
          body: "Our guides, trackers and cooks were raised in the Waterberg. Their knowledge isn't trained — it's inherited.",
        },
      ];
    }),
  experiences: () =>
    build("highlights", (s) => {
      s.tone = "dark";
      s.props.heading = "The reserve, unhurried";
      s.props.variant = "grid";
      s.props.items = [
        {
          icon: "Sunrise",
          title: "Game drives",
          body: "Dawn and dusk on the reserve with an expert guide and tracker.",
        },
        {
          icon: "Footprints",
          title: "Guided walks",
          body: "Read the tracks on foot — the bush at its smallest and wildest.",
        },
        {
          icon: "Flame",
          title: "Boma evenings",
          body: "Dinner under the stars around an open fire, stories included.",
        },
      ];
    }),
  rooms: () =>
    build("rooms_preview", (s) => {
      s.props.heading = "Three suites, one horizon";
    }),
  // ── Suites-page blocks (the bespoke NenGama Suites design) ──
  roomsHero: () =>
    build("hero", (s) => {
      s.props.compact = true;
      s.props.eyebrow = "Suites";
      s.props.headline = "Three suites, one wild horizon";
      s.props.subheadline =
        "Each opens onto the reserve, each fully inclusive of meals, safaris and transfers. Choose the one that fits your stay.";
    }),
  roomsIncluded: () =>
    build("amenities", (s) => {
      s.props.variant = "inline";
      s.props.items = [
        { label: "All meals & house wines" },
        { label: "Two daily safaris" },
        { label: "Airstrip transfers" },
        { label: "0% booking fees" },
      ];
    }),
  roomsShowcase: () =>
    build("rooms_preview", (s) => {
      s.props.display = "showcase";
      s.props.heading = "Three suites, one wild horizon";
    }),
  gallery: () =>
    build("gallery", (s) => {
      s.props.heading = "Moments from the reserve";
    }),
  reviews: () =>
    build("reviews", (s) => {
      s.props.heading = "Quiet that you can feel";
      s.props.variant = "grid";
    }),
  location: () =>
    build("location", (s) => {
      s.tone = "dark";
      s.props.heading = "Deep in the Waterberg";
      s.props.variant = "split";
    }),
  ctaBanner: () =>
    build("cta", (s) => {
      s.tone = "dark";
      s.props.heading = "Your dates, under wide skies";
      s.props.body =
        "Book direct for the best rate and first pick of the season — we'll take care of the rest.";
      s.props.button_label = "Check availability";
      s.props.button_href = "#book";
      s.props.variant = "banner";
    }),
  contactForm: () =>
    build("contact_form", (s) => {
      s.props.heading = "Plan your stay";
      s.props.body =
        "Tell us your dates and what you're hoping for — a guide will be in touch to shape your time in the bush.";
      s.props.variant = "split";
    }),
  // ── Contact-page blocks (the bespoke NenGama Contact design) ──
  contactHero: () =>
    build("hero", (s) => {
      s.props.compact = true;
      s.props.eyebrow = "Contact";
      s.props.headline = "Let's plan your stay";
      s.props.subheadline =
        "Tell us who's travelling and when. A real person at the lodge replies within a day — often the same one who'll meet you at the gate.";
    }),
  contactMap: () =>
    build("map", (s) => {
      s.props.heading = "Find us";
      s.props.address =
        "NenGama Private Reserve · Waterberg Biosphere, Vaalwater, Limpopo";
    }),
  faq: () =>
    build("faq", (s) => {
      s.props.heading = "Good to know";
      s.props.variant = "accordion";
      s.props.items = [
        {
          q: "How do we get there?",
          a: "We're a scenic drive from the nearest town, with a fly-in option to a private strip. Full directions follow your booking.",
        },
        {
          q: "Is it malaria-free?",
          a: "Yes — the reserve sits in a malaria-free region, so it's an easy choice for families.",
        },
        {
          q: "What's included?",
          a: "Rates are full-board with daily guided activities. Replace this with your own inclusions.",
        },
      ];
    }),
  amenities: () =>
    build("amenities", (s) => {
      s.props.heading = "At the lodge";
      s.props.items = [
        { icon: "🔥", label: "Boma & fire pit" },
        { icon: "🏊", label: "Rock pool" },
        { icon: "🍷", label: "Sundowners" },
        { icon: "🦓", label: "Daily game drives" },
        { icon: "🍽️", label: "All meals" },
        { icon: "📶", label: "Wi-Fi at the main house" },
      ];
    }),
  pricing: () =>
    build("pricing", (s) => {
      s.props.heading = "Rates";
      s.props.items = [
        {
          label: "Suite, full-board",
          price: "R6 500",
          note: "per person / night",
        },
        { label: "Sole-use (whole lodge)", price: "On request", note: "" },
      ];
      s.props.footnote =
        "Rates are indicative and include meals and daily activities — your final price is confirmed at booking.";
    }),
  blog: () =>
    build("blog_preview", (s) => {
      s.props.heading = "From the field journal";
    }),
  // ── Journal-page blocks (the bespoke NenGama Journal design) ──
  journalHero: () =>
    build("hero", (s) => {
      s.props.compact = true;
      s.props.eyebrow = "Journal";
      s.props.headline = "Field notes";
      s.props.subheadline =
        "Stories from the lodge — written by the people who live and work here.";
    }),
  journalPosts: () =>
    build("blog_preview", (s) => {
      s.props.display = "journal";
      s.props.heading = "Field notes";
      s.props.max = 9;
    }),
  newsletterCta: () =>
    build("cta", (s) => {
      s.tone = "dark";
      s.props.newsletter = true;
      s.props.heading = "Field notes, twice a season";
      s.props.body =
        "Sightings, open dates and the occasional recipe — no noise, just the lodge in your inbox.";
      s.props.button_label = "Subscribe";
      s.props.button_href = "#";
    }),
};

// ── Sabela Lodge — dark-first editorial safari lodge (ebony ground, brand-gold)
// The founder's second theme. Voice: intimate, design-led, the reserve at dusk.
// Most home bands carry tone "dark" to match the ebony-first design; the scoped
// .wielo-sabela render layer + Ebony base supply the look.
const sabela = {
  heroFull: () =>
    build("hero", (s) => {
      s.tone = "dark";
      s.props.headline = "Where the wild still keeps its secrets";
      s.props.subheadline =
        "An intimate, design-led safari lodge on a private reserve — eight suites, twice-daily game drives, and nothing between you and the bush.";
      s.props.cta_label = "Plan your safari";
      s.props.cta_href = "#book";
      s.props.cta2_label = "Our story";
      s.props.cta2_href = "/about";
      s.props.stats = [
        { value: "12,000", label: "Hectares" },
        { value: "Big Five", label: "Free-roaming" },
        { value: "4.97 ★★★★★", label: "180 guest stays" },
      ];
      s.props.align = "left";
      s.props.variant = "fullscreen";
      s.props.overlay = "strong";
      s.props.textTone = "light";
      s.props.height = "tall";
    }),
  heroSplit: () =>
    build("hero", (s) => {
      s.props.headline = "A camp built to disappear into the bush";
      s.props.subheadline =
        "Eight suites along the riverbed, one table, and a reserve we have spent years giving back to the wild.";
      s.props.cta_label = "See the suites";
      s.props.cta_href = "#rooms";
      s.props.align = "left";
      s.props.variant = "split_right";
      s.props.height = "medium";
    }),
  story: () =>
    build("intro", (s) => {
      s.props.eyebrow = "The Sabela experience";
      s.props.heading = "A safari measured in moments, not checklists";
      s.props.body =
        "Some places you pass through. This one stays with you. Days here move to the rhythm of the reserve — first light on the riverbed, long drives, the slow hush of the afternoon, and a fire under more stars than you have ever seen.\n\nReplace this with your own story: the land, the welcome, and why guests make the journey.";
      s.props.variant = "lead";
    }),
  // ── About-page blocks ──
  aboutHero: () =>
    build("hero", (s) => {
      s.props.compact = true;
      s.props.eyebrow = "About";
      s.props.headline = "A camp built to disappear into the bush";
      s.props.subheadline =
        "Low, quiet, and shaped around the land it sits on. Eight suites, one table, and a reserve we have spent years giving back to the wild.";
    }),
  aboutStory: () =>
    build("intro", (s) => {
      s.props.eyebrow = "Our story";
      s.props.heading = "The land came first";
      s.props.body =
        "Sabela began with a single idea: take the fences down and let the bush decide what it wanted to be. Fifteen years on, those squares are one unbroken wilderness — the grass came back, then the antelope, then the predators that follow them.";
      s.props.badge_value = "12,000";
      s.props.badge_label = "Hectares rewilded";
      s.props.variant = "lead";
    }),
  aboutStats: () =>
    build("stats", (s) => {
      s.props.items = [
        { value: "15", label: "Years rewilding" },
        { value: "8", label: "Suites only" },
        { value: "340+", label: "Species recorded" },
        { value: "0", label: "Internal fences" },
      ];
    }),
  aboutHost: () =>
    build("host_bio", (s) => {
      s.props.heading = "Your team in the bush";
      s.props.name = "Themba Nkosi & the Sabela guides";
      s.props.body =
        "A few warm lines about the people who will share the reserve with you, and what they love most about this corner of the bush. Born of the Waterberg, their knowledge is not trained — it is inherited.";
    }),
  aboutValues: () =>
    build("values", (s) => {
      s.props.heading = "Three commitments behind every stay";
      s.props.items = [
        {
          title: "Space, not crowds",
          body: "Never more than a handful of guests in the vehicle, and often it is just you and your ranger under the whole sky.",
        },
        {
          title: "Honest pricing",
          body: "One inclusive rate, booked direct. No agents, no booking fees, no commission. The price you are quoted is the price you pay.",
        },
        {
          title: "People of this place",
          body: "Our guides, trackers and cooks were raised here. Their knowledge is not trained — it is inherited.",
        },
      ];
    }),
  experiences: () =>
    build("highlights", (s) => {
      s.tone = "dark";
      s.props.heading = "The reserve, unhurried";
      s.props.variant = "grid";
      s.props.items = [
        {
          icon: "Sunrise",
          title: "Twice-daily game drives",
          body: "Dawn and dusk on open vehicles with an expert guide and tracker.",
        },
        {
          icon: "Moon",
          title: "Eight suites, nothing more",
          body: "A small camp by design, so the bush stays quiet and yours.",
        },
        {
          icon: "Flame",
          title: "The table & the fire",
          body: "Long dinners under the stars, the boma fire, and stories that run late.",
        },
      ];
    }),
  rooms: () =>
    build("rooms_preview", (s) => {
      s.props.heading = "Eight suites along the riverbed";
    }),
  // ── Suites-page blocks ──
  roomsHero: () =>
    build("hero", (s) => {
      s.props.compact = true;
      s.props.eyebrow = "The suites";
      s.props.headline = "Eight suites along the riverbed";
      s.props.subheadline =
        "Each opens onto the reserve, each fully inclusive of meals, game drives and transfers. Choose the one that fits your stay.";
    }),
  roomsIncluded: () =>
    build("amenities", (s) => {
      s.props.variant = "inline";
      s.props.items = [
        { label: "All meals & house wines" },
        { label: "Two daily game drives" },
        { label: "Airstrip transfers" },
        { label: "0% booking fees" },
      ];
    }),
  roomsShowcase: () =>
    build("rooms_preview", (s) => {
      s.props.display = "showcase";
      s.props.heading = "Where you will stay";
    }),
  gallery: () =>
    build("gallery", (s) => {
      s.props.heading = "The reserve, in fragments";
    }),
  reviews: () =>
    build("reviews", (s) => {
      s.props.heading = "Guests arrive curious. They leave changed.";
      s.props.variant = "grid";
    }),
  location: () =>
    build("location", (s) => {
      s.tone = "dark";
      s.props.heading = "Closer than you think";
      s.props.variant = "split";
    }),
  ctaBanner: () =>
    build("cta", (s) => {
      s.tone = "dark";
      s.props.heading = "Your safari begins with a single message";
      s.props.body =
        "Book direct for the best rate and first pick of the season — we will take care of the rest.";
      s.props.button_label = "Plan your safari";
      s.props.button_href = "#book";
      s.props.variant = "banner";
    }),
  contactForm: () =>
    build("contact_form", (s) => {
      s.props.heading = "Send an enquiry";
      s.props.body = "We usually reply within a few hours.";
      s.props.variant = "split";
    }),
  // ── Contact-page blocks ──
  contactHero: () =>
    build("hero", (s) => {
      s.props.compact = true;
      s.props.eyebrow = "Contact";
      s.props.headline = "Let's plan your safari";
      s.props.subheadline =
        "Tell us who is travelling and when. A real person at the lodge replies within a day — often the same one who will meet you at the airstrip.";
    }),
  contactMap: () =>
    build("map", (s) => {
      s.props.heading = "Find us";
      s.props.address =
        "Sabela Private Reserve · Waterberg Biosphere, Vaalwater, Limpopo";
    }),
  faq: () =>
    build("faq", (s) => {
      s.props.heading = "Good to know";
      s.props.variant = "accordion";
      s.props.items = [
        {
          q: "How do we get there?",
          a: "A 45-minute charter from Johannesburg, or scheduled flights to Hoedspruit and Skukuza. Our airstrip is a 15-minute transfer from camp.",
        },
        {
          q: "Is it malaria-free?",
          a: "Yes — the reserve sits in a malaria-free region, so it is an easy choice for families.",
        },
        {
          q: "What is included?",
          a: "Rates are full-board with twice-daily guided game drives. Replace this with your own inclusions.",
        },
      ];
    }),
  amenities: () =>
    build("amenities", (s) => {
      s.props.heading = "At the lodge";
      s.props.items = [
        { icon: "🔥", label: "Boma & fire pit" },
        { icon: "🏊", label: "Rock pool" },
        { icon: "🍷", label: "Sundowners" },
        { icon: "🦓", label: "Daily game drives" },
        { icon: "🍽️", label: "All meals" },
        { icon: "📶", label: "Wi-Fi at the main house" },
      ];
    }),
  pricing: () =>
    build("pricing", (s) => {
      s.props.heading = "Rates";
      s.props.items = [
        {
          label: "Suite, full-board",
          price: "R7 500",
          note: "per person / night",
        },
        { label: "Take the whole lodge", price: "On request", note: "" },
      ];
      s.props.footnote =
        "Rates are indicative and include meals and daily activities — your final price is confirmed at booking.";
    }),
  blog: () =>
    build("blog_preview", (s) => {
      s.props.heading = "Field notes from the reserve";
    }),
  // ── Journal-page blocks ──
  journalHero: () =>
    build("hero", (s) => {
      s.props.compact = true;
      s.props.eyebrow = "The journal";
      s.props.headline = "Field notes from the reserve";
      s.props.subheadline =
        "Stories from the bush — written by the people who live and work here.";
    }),
  journalPosts: () =>
    build("blog_preview", (s) => {
      s.props.display = "journal";
      s.props.heading = "Latest from the journal";
      s.props.max = 9;
    }),
  newsletterCta: () =>
    build("cta", (s) => {
      s.tone = "dark";
      s.props.newsletter = true;
      s.props.heading = "Field notes, twice a season";
      s.props.body =
        "Sightings, open dates and the occasional recipe — no noise, just the reserve in your inbox.";
      s.props.button_label = "Subscribe";
      s.props.button_href = "#";
    }),
};

const SABELA_PRESETS: ThemeSectionPreset[] = [
  {
    key: "sabela_hero_full",
    label: "Hero — fullscreen",
    make: sabela.heroFull,
  },
  { key: "sabela_hero_split", label: "Hero — split", make: sabela.heroSplit },
  { key: "sabela_story", label: "Story", make: sabela.story },
  {
    key: "sabela_experiences",
    label: "Experiences",
    make: sabela.experiences,
  },
  { key: "sabela_gallery", label: "Gallery", make: sabela.gallery },
  { key: "sabela_reviews", label: "Reviews", make: sabela.reviews },
  { key: "sabela_location", label: "Location", make: sabela.location },
  { key: "sabela_cta", label: "Booking CTA", make: sabela.ctaBanner },
  {
    key: "sabela_contact_form",
    label: "Contact form",
    make: sabela.contactForm,
  },
  { key: "sabela_faq", label: "FAQ", make: sabela.faq },
  { key: "sabela_amenities", label: "At the lodge", make: sabela.amenities },
  { key: "sabela_pricing", label: "Rates", make: sabela.pricing },
  { key: "sabela_blog", label: "Journal", make: sabela.blog },
];

const SABELA_TEMPLATES: ThemeTemplate[] = [
  {
    key: "sabela_home",
    label: "Home",
    description:
      "Fullscreen hero, the experience, suites, gallery, reviews, location and a booking CTA.",
    make: () => [
      sabela.heroFull(),
      sabela.story(),
      sabela.experiences(),
      sabela.rooms(),
      sabela.gallery(),
      sabela.reviews(),
      sabela.location(),
      sabela.ctaBanner(),
    ],
  },
  {
    key: "sabela_about",
    label: "About",
    description:
      "Page-header banner, your story, the stats band, your team, your commitments and a CTA.",
    make: () => [
      sabela.aboutHero(),
      sabela.aboutStory(),
      sabela.aboutStats(),
      sabela.aboutHost(),
      sabela.aboutValues(),
      sabela.ctaBanner(),
    ],
  },
  {
    key: "sabela_rooms",
    label: "Suites",
    description:
      "Page-header banner, what's included, your suites as full-width showcases, rates and a CTA.",
    make: () => [
      sabela.roomsHero(),
      sabela.roomsIncluded(),
      sabela.roomsShowcase(),
      sabela.pricing(),
      sabela.ctaBanner(),
    ],
  },
  {
    key: "sabela_journal",
    label: "Journal",
    description:
      "Page-header banner, your posts (featured + grid) and a newsletter sign-up.",
    make: () => [
      sabela.journalHero(),
      sabela.journalPosts(),
      sabela.newsletterCta(),
    ],
  },
  {
    key: "sabela_contact",
    label: "Contact",
    description:
      "Page-header banner, enquiry form + details, a map and the good-to-know FAQ.",
    make: () => [
      sabela.contactHero(),
      sabela.contactForm(),
      sabela.contactMap(),
      sabela.faq(),
    ],
  },
];

const SAFARI_PRESETS: ThemeSectionPreset[] = [
  {
    key: "safari_hero_full",
    label: "Hero — fullscreen",
    make: safari.heroFull,
  },
  { key: "safari_hero_split", label: "Hero — split", make: safari.heroSplit },
  { key: "safari_story", label: "Story", make: safari.story },
  { key: "safari_experiences", label: "Experiences", make: safari.experiences },
  { key: "safari_gallery", label: "Gallery", make: safari.gallery },
  { key: "safari_reviews", label: "Reviews", make: safari.reviews },
  { key: "safari_location", label: "Location", make: safari.location },
  { key: "safari_cta", label: "Booking CTA", make: safari.ctaBanner },
  {
    key: "safari_contact_form",
    label: "Contact form",
    make: safari.contactForm,
  },
  { key: "safari_faq", label: "FAQ", make: safari.faq },
  { key: "safari_amenities", label: "At the lodge", make: safari.amenities },
  { key: "safari_pricing", label: "Rates", make: safari.pricing },
  { key: "safari_blog", label: "Journal", make: safari.blog },
];

const SAFARI_TEMPLATES: ThemeTemplate[] = [
  {
    key: "safari_home",
    label: "Home",
    description:
      "Fullscreen hero, the story, experiences, suites, gallery, reviews, location and a booking CTA.",
    make: () => [
      safari.heroFull(),
      safari.story(),
      safari.experiences(),
      safari.rooms(),
      safari.gallery(),
      safari.reviews(),
      safari.location(),
      safari.ctaBanner(),
    ],
  },
  {
    key: "safari_about",
    label: "About",
    description:
      "Page-header banner, your story, the stats band, conservation, a founder note, your promises and a CTA.",
    make: () => [
      safari.aboutHero(),
      safari.aboutStory(),
      safari.aboutStats(),
      safari.aboutConservation(),
      safari.aboutFounderNote(),
      safari.aboutValues(),
      safari.ctaBanner(),
    ],
  },
  {
    key: "safari_rooms",
    label: "Suites",
    description:
      "Page-header banner, what's included, your suites as full-width showcases and a CTA.",
    make: () => [
      safari.roomsHero(),
      safari.roomsIncluded(),
      safari.roomsShowcase(),
      safari.ctaBanner(),
    ],
  },
  {
    key: "safari_journal",
    label: "Journal",
    description:
      "Page-header banner, your posts (featured + grid) and a newsletter sign-up.",
    make: () => [
      safari.journalHero(),
      safari.journalPosts(),
      safari.newsletterCta(),
    ],
  },
  {
    key: "safari_contact",
    label: "Contact",
    description:
      "Page-header banner, enquiry form + details, a map and the good-to-know FAQ.",
    make: () => [
      safari.contactHero(),
      safari.contactForm(),
      safari.contactMap(),
      safari.faq(),
    ],
  },
];

// ── Registry (keyed by theme slug = SiteThemeConfig.preset) ───────────────
const PRESETS: Record<string, ThemeSectionPreset[]> = {
  safari: SAFARI_PRESETS,
  sabela: SABELA_PRESETS,
};
const TEMPLATES: Record<string, ThemeTemplate[]> = {
  safari: SAFARI_TEMPLATES,
  sabela: SABELA_TEMPLATES,
};

// Themes currently ACTIVE in the system. Their designed building blocks (section
// presets + page templates) are the only ones offered in the page builder — a
// theme's blocks appear only while that theme is active. Safari is now the SOLE
// platform theme (site_themes holds only the Safari row; see migration
// 20260630120000_keep_only_safari_theme). A site stuck on a removed theme simply
// gets no theme blocks.
const ACTIVE_THEME_SLUGS = new Set<string>(["safari", "sabela"]);

/** Designed section presets for the slug — only when that theme is active. */
export function getThemeSectionPresets(
  themeSlug: string | undefined | null,
): ThemeSectionPreset[] {
  if (!themeSlug || !ACTIVE_THEME_SLUGS.has(themeSlug)) return [];
  return PRESETS[themeSlug] || [];
}

/** Designed page templates for the slug — only when that theme is active. */
export function getThemeTemplates(
  themeSlug: string | undefined | null,
): ThemeTemplate[] {
  if (!themeSlug || !ACTIVE_THEME_SLUGS.has(themeSlug)) return [];
  return TEMPLATES[themeSlug] || [];
}

/** Human label for the sidebar theme group (capitalised slug, fallback "Theme"). */
export function themeGroupLabel(themeSlug: string | undefined | null): string {
  if (!themeSlug) return "Theme";
  return themeSlug.charAt(0).toUpperCase() + themeSlug.slice(1);
}

// ── Room-detail page template (one per theme) ──────────────────
// The designed default layout for the `room_detail` page: the room blocks
// (gallery → overview → amenities → rate) closed by the theme's own reviews +
// CTA, so it carries the theme's voice. Used to seed a website's room_detail
// page AND as the public render fallback when the host hasn't customised it.
const ROOM_DETAIL: Record<string, () => WebsiteSection[]> = {
  safari: () => [
    roomDetail.gallery(),
    roomDetail.overview(),
    roomDetail.amenities(),
    roomDetail.rate(),
    roomDetail.policies(),
    safari.reviews(),
    safari.ctaBanner(),
  ],
  sabela: () => [
    roomDetail.gallery(),
    roomDetail.overview(),
    roomDetail.amenities(),
    roomDetail.rate(),
    roomDetail.policies(),
    sabela.reviews(),
    sabela.ctaBanner(),
  ],
};

/**
 * Whether a theme ships a DESIGNED room-detail template. A theme must have one
 * to be activatable (the room-detail page is part of every theme) — the
 * `applyThemeAction` gate relies on this; `getThemeRoomDetailSections` still
 * returns a safe fallback for rendering, but activation is blocked without a
 * real design.
 */
export function hasThemeRoomDetailTemplate(
  themeSlug: string | undefined | null,
): boolean {
  return !!themeSlug && themeSlug in ROOM_DETAIL;
}

/**
 * The designed room-detail layout for a theme slug. Falls back to the bare room
 * blocks for an unknown theme so a room page ALWAYS renders something sensible.
 */
export function getThemeRoomDetailSections(
  themeSlug: string | undefined | null,
): WebsiteSection[] {
  const fn = themeSlug ? ROOM_DETAIL[themeSlug] : undefined;
  if (fn) return fn();
  return [
    roomDetail.gallery(),
    roomDetail.overview(),
    roomDetail.amenities(),
    roomDetail.rate(),
    roomDetail.policies(),
  ];
}
