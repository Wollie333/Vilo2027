// Canonical sample site content — a realistic one-page mock used by the Brand
// Studio live preview and the dev preview harness. Rendered through the SAME
// `components/site/*` renderer the public site uses, so every brand/theme change
// shows live exactly as guests will see it. Pure data (schema-validated) — safe
// to import in client or server.

import type {
  GalleryData,
  RoomsPreviewData,
  SiteData,
  SiteNavItem,
} from "@/lib/site/types";
import {
  sectionsSchema,
  type WebsiteSection,
} from "@/lib/website/sections.schema";

const IMG = (seed: string) => `https://picsum.photos/seed/vilo-${seed}/900/700`;

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

// Stable uuids per section (the schema requires id: uuid).
const ID = {
  hero: "b0000000-0000-4000-8000-000000000001",
  intro: "b0000000-0000-4000-8000-000000000002",
  highlights: "b0000000-0000-4000-8000-000000000003",
  gallery: "b0000000-0000-4000-8000-000000000004",
  rooms: "b0000000-0000-4000-8000-000000000005",
  hostBio: "b0000000-0000-4000-8000-000000000006",
  reviews: "b0000000-0000-4000-8000-000000000007",
  blog: "b0000000-0000-4000-8000-000000000008",
} as const;

export const SAMPLE_NAV: SiteNavItem[] = [
  { label: "Home", href: "#" },
  { label: "Rooms", href: "#rooms" },
  { label: "Gallery", href: "#gallery" },
  { label: "Journal", href: "#journal" },
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
]);

// Sample "pages" for the preview page-tabs. Each reuses section blocks from
// SAMPLE_SECTIONS (same ids → SAMPLE_DATA serves them all; pages render
// separately so reuse is safe).
const ofType = (...types: WebsiteSection["type"][]) =>
  SAMPLE_SECTIONS.filter((s) => types.includes(s.type));

export type SamplePage = {
  key: string;
  label: string;
  path: string;
  sections: WebsiteSection[];
};

export const SAMPLE_PAGES: SamplePage[] = [
  { key: "home", label: "Home", path: "/", sections: SAMPLE_SECTIONS },
  {
    key: "rooms",
    label: "Rooms",
    path: "/rooms",
    sections: ofType("rooms_preview", "gallery"),
  },
  {
    key: "about",
    label: "About",
    path: "/about",
    sections: ofType("host_bio", "highlights", "reviews"),
  },
  {
    key: "journal",
    label: "Journal",
    path: "/journal",
    sections: ofType("blog_preview"),
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
  [ID.reviews]: {
    type: "reviews",
    data: {
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
    },
  },
  [ID.blog]: {
    type: "blog_preview",
    data: {
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
    },
  },
};
