// Canonical sample site content — a realistic one-page mock used by the Brand
// Studio live preview and the dev preview harness. Rendered through the SAME
// `components/site/*` renderer the public site uses, so every brand/theme change
// shows live exactly as guests will see it. Pure data (schema-validated) — safe
// to import in client or server.

import type {
  AddonsPreviewData,
  AmenitiesData,
  ProfileData,
  BlogPreviewData,
  BookingFunnelData,
  GalleryData,
  RateTableData,
  ReviewsData,
  RoomDetail,
  RoomPolicies,
  RoomsPreviewData,
  SeasonalPricingData,
  SiteData,
  SiteNavItem,
  SpecialsPreviewData,
} from "@/lib/site/types";
import {
  sectionsSchema,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import type { PageDoc } from "@/lib/website/pageDoc.schema";

const IMG = (seed: string) =>
  `https://picsum.photos/seed/wielo-${seed}/900/700`;

// Demo fillers for the Brand Studio preview when the host's real site has no
// rooms / photos yet — so they can still design the brand against content.
export const DEMO_ROOMS: RoomsPreviewData = {
  rooms: [
    {
      id: "demo-r1",
      name: "Garden Suite",
      price: 1850,
      currency: "ZAR",
      description: "Sleeps 2 · private stoep · fireplace.",
      imageUrl: IMG("dr1"),
      bookHref: "#",
    },
    {
      id: "demo-r2",
      name: "Family Cottage",
      price: 2200,
      currency: "ZAR",
      description: "Sleeps 4 · full kitchen · garden views.",
      imageUrl: IMG("dr2"),
      bookHref: "#",
    },
    {
      id: "demo-r3",
      name: "The Loft",
      price: 1500,
      currency: "ZAR",
      description: "Sleeps 2 · cosy · pet friendly.",
      imageUrl: IMG("dr3"),
      bookHref: "#",
    },
  ],
};

export const DEMO_GALLERY: GalleryData = {
  images: Array.from({ length: 6 }, (_, i) => ({
    url: IMG(`dg${i}`),
    caption: null,
  })),
};

export const DEMO_REVIEWS: ReviewsData = {
  average: 4.8,
  count: 37,
  items: [
    {
      author: "Thandi M.",
      rating: 5,
      body: "The most restful weekend we've had in years.",
      date: "Mar 2026",
    },
    {
      author: "Pieter V.",
      rating: 5,
      body: "Spotless, characterful, and the host went out of her way.",
      date: "Feb 2026",
    },
    {
      author: "Aisha K.",
      rating: 4,
      body: "Beautiful spot. Bring layers — the nights get cold!",
      date: "Jan 2026",
    },
  ],
};

export const DEMO_BLOG: BlogPreviewData = {
  posts: [
    {
      title: "Five walks within an hour",
      href: "#",
      excerpt: "From gentle riverside strolls to the Compassberg summit.",
      coverUrl: IMG("b1"),
      date: "Apr 2026",
    },
    {
      title: "What to pack for the Karoo",
      href: "#",
      excerpt: "It's hot by day and properly cold by night.",
      coverUrl: IMG("b2"),
      date: "Mar 2026",
    },
    {
      title: "Our favourite village suppers",
      href: "#",
      excerpt: "Where the locals actually eat.",
      coverUrl: IMG("b3"),
      date: "Feb 2026",
    },
  ],
};

// Two bookable properties so the booking widgets (search bar / date search /
// search results) render a populated preview on the builder canvas. The canvas
// is non-interactive, so these never hit the quote/availability endpoints — the
// live site recalculates every price server-side via /api/website-quote.
export const DEMO_BOOKING: BookingFunnelData = {
  websiteId: "demo-website",
  searchHref: "#",
  properties: [
    {
      id: "demo-p1",
      slug: "olive-grove",
      name: "Olive Grove Guesthouse",
      currency: "ZAR",
      minNights: 1,
      maxGuests: 6,
      bookBase: "#?property=demo-p1",
    },
    {
      id: "demo-p2",
      slug: "karoo-cottages",
      name: "Karoo Cottages",
      currency: "ZAR",
      minNights: 2,
      maxGuests: 4,
      bookBase: "#?property=demo-p2",
    },
  ],
};

// One room's full detail — the sample the room-scoped widgets (room gallery /
// overview / amenities / rate / policies) all render on the builder canvas and
// in the room-detail template preview (the public page injects the LIVE room).
export const DEMO_ROOM_DETAIL: RoomDetail = {
  id: "demo-r1",
  slug: "garden-suite",
  name: "Garden Suite",
  description:
    "A sunlit corner suite opening onto the fig garden — a deep bath, a private stoep, and a fireplace for cold Karoo nights.",
  price: 1850,
  currency: "ZAR",
  images: Array.from({ length: 5 }, (_, i) => ({
    url: IMG(`rd${i}`),
    alt: "Garden Suite",
  })),
  facts: ["Sleeps 2", "1 king bed", "Ensuite", "28 m²", "Garden view"],
  amenities: [
    { label: "Free Wi-Fi" },
    { label: "Fireplace" },
    { label: "Private stoep" },
    { label: "Nespresso" },
    { label: "Underfloor heating" },
    { label: "Pet friendly" },
  ],
  bookHref: "#",
  propertyId: "demo-p1",
  propertyName: "Olive Grove Guesthouse",
  maxGuests: 2,
  policies: {
    cancellation: "Free cancellation up to 7 days before check-in.",
    checkIn: "From 14:00",
    checkOut: "Until 10:00",
    houseRules: "No smoking indoors. Quiet hours after 22:00.",
    children: true,
    pets: true,
  },
};

export const DEMO_AMENITIES: AmenitiesData = {
  items: [
    { icon: "📶", label: "Free Wi-Fi" },
    { icon: "🅿️", label: "Free parking" },
    { icon: "🏊", label: "Pool" },
    { icon: "🍳", label: "Kitchen" },
    { icon: "❄️", label: "Air conditioning" },
    { icon: "🔥", label: "Braai / BBQ" },
    { icon: "🌿", label: "Garden" },
    { icon: "☕", label: "Nespresso" },
  ],
  // Grouped sample so the builder canvas previews the categorized layout.
  categories: [
    {
      id: "internet",
      label: "Internet",
      icon: "wifi",
      items: [{ key: "wifi", label: "Free WiFi in public areas" }],
    },
    {
      id: "parking",
      label: "Parking & transport",
      icon: "square-parking",
      items: [
        { key: "parking", label: "Free parking" },
        { key: "shuttle_paid", label: "Airport shuttle (paid)" },
      ],
    },
    {
      id: "wellness",
      label: "Recreation & wellness",
      icon: "waves",
      items: [
        { key: "pool", label: "Pool" },
        { key: "fitness_centre", label: "Fitness centre" },
      ],
    },
    {
      id: "outdoors",
      label: "Outdoors & view",
      icon: "tree-pine",
      items: [
        { key: "braai", label: "Braai / BBQ facilities" },
        { key: "garden", label: "Garden" },
      ],
    },
  ],
};

export const DEMO_PROFILE: ProfileData = {
  name: "Thandi Mokoena",
  avatar: null,
  bio: "Born and raised in the winelands, I've hosted travellers from all over the world for the past eight years. I love sharing my favourite hidden trails, farm stalls and sunset spots — just ask.",
  rating: 4.9,
  reviews: 128,
  superhost: true,
  verified: true,
};

export const DEMO_ADDONS: AddonsPreviewData = {
  addons: [
    {
      id: "da1",
      name: "Airport transfer",
      description: "Door-to-door pickup from the airport.",
      pricingModel: "per_stay",
      price: 650,
      currency: "ZAR",
    },
    {
      id: "da2",
      name: "Breakfast basket",
      description: "Fresh local produce delivered each morning.",
      pricingModel: "per_guest_per_night",
      price: 120,
      currency: "ZAR",
    },
    {
      id: "da3",
      name: "Wine tasting",
      description: "Guided tasting at a nearby estate.",
      pricingModel: "per_guest",
      price: 300,
      currency: "ZAR",
    },
  ],
};

export const DEMO_RATE_TABLE: RateTableData = {
  rows: [
    {
      roomId: "dr1",
      name: "Garden Suite",
      propertyId: "dp1",
      nightlyFrom: 1850,
      currency: "ZAR",
      maxGuests: 2,
      bookHref: "#",
    },
    {
      roomId: "dr2",
      name: "Family Cottage",
      propertyId: "dp1",
      nightlyFrom: 2200,
      currency: "ZAR",
      maxGuests: 4,
      bookHref: "#",
    },
    {
      roomId: "dr3",
      name: "The Loft",
      propertyId: "dp1",
      nightlyFrom: 1500,
      currency: "ZAR",
      maxGuests: 2,
      bookHref: "#",
    },
  ],
};

export const DEMO_SEASONAL: SeasonalPricingData = {
  seasons: [
    { label: "Peak", dates: "Dec – Jan", priceFrom: 2400, currency: "ZAR" },
    { label: "High", dates: "Feb – Apr", priceFrom: 1850, currency: "ZAR" },
    { label: "Low", dates: "May – Aug", priceFrom: 1480, currency: "ZAR" },
  ],
};

export const DEMO_POLICIES: RoomPolicies = {
  cancellation: "Free cancellation up to 7 days before check-in.",
  checkIn: "From 14:00",
  checkOut: "Until 10:00",
  houseRules: "No smoking indoors. Quiet hours after 22:00.",
  children: true,
  pets: true,
};

export const DEMO_SPECIALS: SpecialsPreviewData = {
  specials: [
    {
      id: "demo-s1",
      title: "Midweek escape — 20% off",
      slug: "midweek-escape",
      description: "Stay Sun–Thu and save on our garden cottages.",
      imageUrl: IMG("ds1"),
      badge: "20% off",
      priceMode: "per_night",
      price: 1480,
      currency: "ZAR",
      wasPrice: 1850,
      savingsPct: 20,
      bookHref: "#",
    },
    {
      id: "demo-s2",
      title: "Stay 3, pay 2",
      slug: "stay-3-pay-2",
      description: "Your third night is on us, all season long.",
      imageUrl: IMG("ds2"),
      badge: "Free night",
      priceMode: "flat",
      price: 3700,
      currency: "ZAR",
      bookHref: "#",
    },
  ],
};

// Map ONE block (by id + type + props) to its representative stock datum — the
// shared core behind both the PageDoc walker and the flat-section builder below.
// Returns undefined for blocks that carry their own content in props (hero/intro/
// cta/…) or auto-populate types without a demo filler.
function sampleDatumFor(
  id: string,
  type: string,
  props?: Record<string, unknown>,
): SiteData[string] | undefined {
  switch (type) {
    case "rooms_preview":
      return { type: "rooms_preview", data: DEMO_ROOMS };
    case "gallery":
      return { type: "gallery", data: DEMO_GALLERY };
    case "reviews":
      return { type: "reviews", data: DEMO_REVIEWS };
    case "blog_preview":
      return { type: "blog_preview", data: DEMO_BLOG };
    case "specials_preview":
      return { type: "specials_preview", data: DEMO_SPECIALS };
    case "amenities":
      return { type: "amenities", data: DEMO_AMENITIES };
    case "profile":
      return { type: "profile", data: DEMO_PROFILE };
    case "addons_preview":
      return { type: "addons_preview", data: DEMO_ADDONS };
    case "policies":
      return { type: "policies", data: DEMO_POLICIES };
    case "rate_table":
      return { type: "rate_table", data: DEMO_RATE_TABLE };
    case "room_rates":
      return { type: "room_rates", data: DEMO_RATE_TABLE };
    case "seasonal_pricing":
      return { type: "seasonal_pricing", data: DEMO_SEASONAL };
    case "booking_search":
      return { type: "booking_search", data: DEMO_BOOKING };
    case "availability_calendar":
      return { type: "availability_calendar", data: DEMO_BOOKING };
    case "search_results":
      return { type: "search_results", data: DEMO_BOOKING };
    case "el_room_card": {
      const wanted = props?.room_id;
      const room =
        DEMO_ROOMS.rooms.find((r) => r.id === wanted) ?? DEMO_ROOMS.rooms[0];
      return room ? { type: "el_room_card", data: room } : undefined;
    }
    // Room-scoped widgets (room-detail template) — all render the SAME room.
    case "room_gallery":
    case "room_overview":
    case "room_amenities":
    case "room_rate":
    case "room_policies":
      return { type, data: DEMO_ROOM_DETAIL } as SiteData[string];
    default:
      return undefined;
  }
}

// Builder V2 — walk a PageDoc's widget leaves and produce sample SiteData KEYED
// BY NODE ID, so the auto-populate blocks (rooms grid, room card, gallery,
// reviews, journal, specials) show representative content on the builder canvas
// instead of empty states. Pure + client-safe; the public site uses real data.
export function sampleDataForDoc(doc: PageDoc): SiteData {
  const out: SiteData = {};
  const visit = (node: {
    id: string;
    type: string;
    props?: Record<string, unknown>;
    kids?: unknown[];
  }) => {
    if (Array.isArray(node.kids)) {
      for (const k of node.kids) visit(k as Parameters<typeof visit>[0]);
      return;
    }
    const datum = sampleDatumFor(node.id, node.type, node.props);
    if (datum) out[node.id] = datum;
  };
  for (const s of doc.root.kids) {
    visit(s as unknown as Parameters<typeof visit>[0]);
  }
  return out;
}

// Theme PREVIEW — the flat-section counterpart to {@link sampleDataForDoc}. A
// theme's `page_templates` are flat `WebsiteSection[]`; keying stock data by
// section id here lets the theme preview render its designed layout with
// representative content REGARDLESS of whether the host has set up rooms/photos
// yet — so "view theme preview" is always pixel-perfect. Activation then swaps in
// the host's real data through the live `assembleSectionData` path.
export function sampleDataForFlatSections(
  sections: { id: string; type: string; props?: Record<string, unknown> }[],
): SiteData {
  const out: SiteData = {};
  for (const s of sections) {
    const datum = sampleDatumFor(s.id, s.type, s.props);
    if (datum) out[s.id] = datum;
  }
  return out;
}

// Stable uuids per section (the schema requires id: uuid).
const ID = {
  // Home page
  hero: "b0000000-0000-4000-8000-000000000001",
  intro: "b0000000-0000-4000-8000-000000000002",
  highlights: "b0000000-0000-4000-8000-000000000003",
  gallery: "b0000000-0000-4000-8000-000000000004",
  rooms: "b0000000-0000-4000-8000-000000000005",
  hostBio: "b0000000-0000-4000-8000-000000000006",
  reviews: "b0000000-0000-4000-8000-000000000007",
  blog: "b0000000-0000-4000-8000-000000000008",
  homeCta: "b0000000-0000-4000-8000-000000000009",
  // About page
  aboutIntro: "b0000000-0000-4000-8000-000000000010",
  aboutHost: "b0000000-0000-4000-8000-000000000011",
  aboutValues: "b0000000-0000-4000-8000-000000000012",
  // Contact page
  contactIntro: "b0000000-0000-4000-8000-000000000013",
  contactForm: "b0000000-0000-4000-8000-000000000014",
  contactLocation: "b0000000-0000-4000-8000-000000000015",
  // Rooms page
  roomsIntro: "b0000000-0000-4000-8000-000000000016",
  roomsList: "b0000000-0000-4000-8000-000000000017",
  roomsCta: "b0000000-0000-4000-8000-000000000018",
  // Blog page
  blogIntro: "b0000000-0000-4000-8000-000000000019",
  blogList: "b0000000-0000-4000-8000-000000000020",
  // Checkout page
  checkoutIntro: "b0000000-0000-4000-8000-000000000021",
  // Thank you page
  thanksIntro: "b0000000-0000-4000-8000-000000000022",
  thanksCta: "b0000000-0000-4000-8000-000000000023",
} as const;

export const SAMPLE_NAV: SiteNavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Rooms", href: "/rooms" },
  { label: "Contact", href: "/contact" },
  { label: "Blog", href: "/blog" },
];

export const SAMPLE_SECTIONS: WebsiteSection[] = sectionsSchema.parse([
  {
    id: ID.hero,
    type: "hero",
    props: {
      headline: "Stillwater Cottage",
      subheadline:
        "A quiet escape on the edge of the Karoo — yours to book directly.",
      image_path: IMG("hero"),
      cta_label: "Check availability",
      cta_href: "#rooms",
    },
  },
  {
    id: ID.intro,
    type: "intro",
    props: {
      heading: "Welcome",
      body: "Three restored cottages set among old oaks, a stone's throw from the village. Slow mornings, big skies, and a host who actually answers the phone.",
    },
  },
  {
    id: ID.highlights,
    type: "highlights",
    props: {
      heading: "Why guests come back",
      items: [
        {
          icon: "✦",
          title: "Direct rates",
          body: "No platform markup — you book straight with us.",
        },
        {
          icon: "✦",
          title: "Pet friendly",
          body: "Well-behaved dogs welcome in two of the cottages.",
        },
        {
          icon: "✦",
          title: "Self check-in",
          body: "Arrive on your own schedule with a smart lock.",
        },
      ],
    },
  },
  {
    id: ID.gallery,
    type: "gallery",
    props: { heading: "The cottages", layout: "grid", max: 6 },
  },
  {
    id: ID.rooms,
    type: "rooms_preview",
    props: { heading: "Rooms", max: 3, ctaLabel: "Book this room" },
  },
  {
    id: ID.hostBio,
    type: "host_bio",
    props: {
      heading: "Your host",
      name: "Lerato & Sam",
      body: "We've run Stillwater for nine years. Between us we know every walking trail, the best bakery, and exactly which cottage catches the morning sun.",
      photo_path: IMG("host"),
    },
  },
  {
    id: ID.reviews,
    type: "reviews",
    props: { heading: "What guests say", max: 4 },
  },
  {
    id: ID.blog,
    type: "blog_preview",
    props: { heading: "From the journal", max: 3 },
  },
  {
    id: ID.homeCta,
    type: "cta",
    props: {
      heading: "Ready to book?",
      body: "Reserve your dates directly.",
      button_label: "Check availability",
      button_href: "/rooms",
    },
  },
]);

// Additional sections for other pages
const ABOUT_SECTIONS: WebsiteSection[] = sectionsSchema.parse([
  {
    id: ID.aboutIntro,
    type: "intro",
    props: {
      heading: "Our story",
      body: "A quiet escape on the edge of the Karoo, where the pace slows and the sky stretches forever. We've been welcoming guests for nearly a decade.",
    },
  },
  {
    id: ID.aboutHost,
    type: "host_bio",
    props: {
      heading: "Your hosts",
      name: "Lerato & Sam",
      body: "We've run Stillwater for nine years. Between us we know every walking trail, the best bakery, and exactly which cottage catches the morning sun.",
      photo_path: IMG("host"),
    },
  },
  {
    id: ID.aboutValues,
    type: "highlights",
    props: {
      heading: "What we stand for",
      items: [
        {
          icon: "✦",
          title: "Personal touch",
          body: "Every stay feels like visiting friends.",
        },
        {
          icon: "✦",
          title: "Local roots",
          body: "We know this area inside out.",
        },
        {
          icon: "✦",
          title: "Direct booking",
          body: "No middlemen, no hidden fees.",
        },
      ],
    },
  },
]);

const CONTACT_SECTIONS: WebsiteSection[] = sectionsSchema.parse([
  {
    id: ID.contactIntro,
    type: "intro",
    props: {
      heading: "Get in touch",
      body: "Have a question about your stay? We'd love to hear from you.",
    },
  },
  {
    id: ID.contactForm,
    type: "contact_form",
    props: {
      heading: "Send us a message",
      body: "Fill in the form below and we'll get back to you as soon as possible.",
      submit_label: "Send message",
      show_phone: true,
    },
  },
  {
    id: ID.contactLocation,
    type: "location",
    props: { heading: "Find us", show_map: true },
  },
]);

const ROOMS_SECTIONS: WebsiteSection[] = sectionsSchema.parse([
  {
    id: ID.roomsIntro,
    type: "intro",
    props: {
      heading: "Our rooms",
      body: "Find the perfect space for your stay. Each room is designed with comfort and character in mind.",
    },
  },
  {
    id: ID.roomsList,
    type: "rooms_preview",
    props: { heading: "", max: 20, layout: "list" },
  },
  {
    id: ID.roomsCta,
    type: "cta",
    props: {
      heading: "Need help choosing?",
      body: "Get in touch and we'll help you find the perfect room for your needs.",
      button_label: "Contact us",
      button_href: "/contact",
    },
  },
]);

const BLOG_SECTIONS: WebsiteSection[] = sectionsSchema.parse([
  {
    id: ID.blogIntro,
    type: "intro",
    props: {
      heading: "From the journal",
      body: "Stories, tips, and updates from our corner of the world.",
    },
  },
  {
    id: ID.blogList,
    type: "blog_preview",
    props: { heading: "", max: 12 },
  },
]);

const CHECKOUT_SECTIONS: WebsiteSection[] = sectionsSchema.parse([
  {
    id: ID.checkoutIntro,
    type: "intro",
    props: {
      heading: "Complete your booking",
      body: "You're almost there. Review your details and confirm your reservation.",
    },
  },
]);

const THANKYOU_SECTIONS: WebsiteSection[] = sectionsSchema.parse([
  {
    id: ID.thanksIntro,
    type: "intro",
    props: {
      heading: "Thank you!",
      body: "Your booking is confirmed. We've sent a confirmation email with all the details. We can't wait to welcome you.",
    },
  },
  {
    id: ID.thanksCta,
    type: "cta",
    props: {
      heading: "Questions before your stay?",
      body: "Feel free to reach out — we're here to help.",
      button_label: "Contact us",
      button_href: "/contact",
    },
  },
]);

// Sample "pages" for the preview page-tabs — all 7 required pages so the Brand
// Studio preview shows the full site structure even when the host hasn't added
// any real content yet.

export type SamplePage = {
  key: string;
  label: string;
  path: string;
  sections: WebsiteSection[];
};

export const SAMPLE_PAGES: SamplePage[] = [
  { key: "home", label: "Home", path: "/", sections: SAMPLE_SECTIONS },
  { key: "about", label: "About", path: "/about", sections: ABOUT_SECTIONS },
  {
    key: "contact",
    label: "Contact",
    path: "/contact",
    sections: CONTACT_SECTIONS,
  },
  { key: "rooms", label: "Rooms", path: "/rooms", sections: ROOMS_SECTIONS },
  { key: "blog", label: "Blog", path: "/blog", sections: BLOG_SECTIONS },
  {
    key: "checkout",
    label: "Book",
    path: "/checkout",
    sections: CHECKOUT_SECTIONS,
  },
  {
    key: "thank-you",
    label: "Thank you",
    path: "/thank-you",
    sections: THANKYOU_SECTIONS,
  },
];

export const SAMPLE_DATA: SiteData = {
  [ID.gallery]: {
    type: "gallery",
    data: {
      images: Array.from({ length: 6 }, (_, i) => ({
        url: IMG(`g${i}`),
        caption: null,
      })),
    },
  },
  [ID.rooms]: {
    type: "rooms_preview",
    data: {
      rooms: [
        {
          id: "r1",
          name: "Oak Cottage",
          price: 1850,
          currency: "ZAR",
          description: "Sleeps 2 · own stoep · fireplace.",
          imageUrl: IMG("r1"),
          bookHref: "#",
        },
        {
          id: "r2",
          name: "Dam View",
          price: 2200,
          currency: "ZAR",
          description: "Sleeps 4 · full kitchen · water views.",
          imageUrl: IMG("r2"),
          bookHref: "#",
        },
        {
          id: "r3",
          name: "The Loft",
          price: 1500,
          currency: "ZAR",
          description: "Sleeps 2 · cosy · pet friendly.",
          imageUrl: IMG("r3"),
          bookHref: "#",
        },
      ],
    },
  },
  [ID.reviews]: { type: "reviews", data: DEMO_REVIEWS },
  [ID.blog]: { type: "blog_preview", data: DEMO_BLOG },
  // Rooms page list — reuses same demo rooms data
  [ID.roomsList]: {
    type: "rooms_preview",
    data: {
      rooms: [
        {
          id: "r1",
          name: "Oak Cottage",
          price: 1850,
          currency: "ZAR",
          description: "Sleeps 2 · own stoep · fireplace.",
          imageUrl: IMG("r1"),
          bookHref: "#",
        },
        {
          id: "r2",
          name: "Dam View",
          price: 2200,
          currency: "ZAR",
          description: "Sleeps 4 · full kitchen · water views.",
          imageUrl: IMG("r2"),
          bookHref: "#",
        },
        {
          id: "r3",
          name: "The Loft",
          price: 1500,
          currency: "ZAR",
          description: "Sleeps 2 · cosy · pet friendly.",
          imageUrl: IMG("r3"),
          bookHref: "#",
        },
      ],
    },
  },
  // Blog page list — reuses same demo posts data
  [ID.blogList]: { type: "blog_preview", data: DEMO_BLOG },
};
