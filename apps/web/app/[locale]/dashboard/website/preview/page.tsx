import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import {
  SITE_PRESET_KEYS,
  siteSurfaceIsDark,
  type SiteThemeConfig,
} from "@/lib/site/themes";
import type { SiteData } from "@/lib/site/types";
import { sectionsSchema } from "@/lib/website/sections.schema";

export const metadata: Metadata = { title: "Site preview (dev)" };

// TEMP dev harness (plan §8.3) — renders every section component through the ONE
// shared renderer with sample data so we can eyeball the W3 building blocks and
// theme presets before the public (site) route + loader land (W4). Delete once
// the live builder preview exists. Behind the dashboard auth layout.

const IMG = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`;

// Stable uuids per section (the schema requires id: uuid).
const ID = {
  hero: "a0000000-0000-4000-8000-000000000001",
  intro: "a0000000-0000-4000-8000-000000000002",
  highlights: "a0000000-0000-4000-8000-000000000003",
  gallery: "a0000000-0000-4000-8000-000000000004",
  rooms: "a0000000-0000-4000-8000-000000000005",
  location: "a0000000-0000-4000-8000-000000000006",
  reviews: "a0000000-0000-4000-8000-000000000007",
  cta: "a0000000-0000-4000-8000-000000000008",
  hostBio: "a0000000-0000-4000-8000-000000000009",
  values: "a0000000-0000-4000-8000-00000000000a",
  blog: "a0000000-0000-4000-8000-00000000000b",
  richText: "a0000000-0000-4000-8000-00000000000c",
  faq: "a0000000-0000-4000-8000-00000000000d",
};

// Raw section docs → validated (defaults applied) by the W1 schema, proving the
// renderer only ever sees schema-valid sections.
const sections = sectionsSchema.parse([
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
    id: ID.location,
    type: "location",
    props: { heading: "Where you'll be", show_map: false },
  },
  {
    id: ID.reviews,
    type: "reviews",
    props: { heading: "What guests say", max: 4 },
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
    id: ID.values,
    type: "values",
    props: {
      heading: "How we host",
      items: [
        {
          title: "Low-impact",
          body: "Solar hot water, borehole irrigation, no single-use plastics.",
        },
        {
          title: "Local first",
          body: "We stock the kitchens from the village market.",
        },
      ],
    },
  },
  {
    id: ID.blog,
    type: "blog_preview",
    props: { heading: "From the journal", max: 3 },
  },
  {
    id: ID.richText,
    type: "rich_text",
    props: {
      html: "<h2>House rules</h2><p>Check-in from <strong>2pm</strong>, checkout by <strong>10am</strong>. Quiet hours after 10pm.</p><ul><li>No smoking indoors</li><li>Dogs on leads near the dam</li></ul>",
    },
  },
  {
    id: ID.faq,
    type: "faq",
    props: {
      heading: "Good to know",
      items: [
        {
          q: "Is there Wi-Fi?",
          a: "Yes — uncapped fibre in all three cottages.",
        },
        {
          q: "Can I pay by EFT?",
          a: "Absolutely. You'll get banking details on the booking page.",
        },
      ],
    },
  },
]);

const data: SiteData = {
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
          bookHref: "/property/stillwater/book?room=r1",
        },
        {
          id: "r2",
          name: "Dam View",
          price: 2200,
          currency: "ZAR",
          description: "Sleeps 4 · full kitchen · water views.",
          imageUrl: IMG("r2"),
          bookHref: "/property/stillwater/book?room=r2",
        },
        {
          id: "r3",
          name: "The Loft",
          price: 1500,
          currency: "ZAR",
          description: "Sleeps 2 · cosy · pet friendly.",
          imageUrl: IMG("r3"),
          bookHref: "/property/stillwater/book?room=r3",
        },
      ],
    },
  },
  [ID.location]: {
    type: "location",
    data: {
      address: "12 Mill Road, Nieu-Bethesda, Eastern Cape",
      mapEmbedUrl: null,
      pois: [
        { name: "Owl House Museum", category: "Culture", distance: "400 m" },
        { name: "Village bakery", category: "Food", distance: "600 m" },
        {
          name: "Compassberg trailhead",
          category: "Outdoors",
          distance: "8 km",
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
          href: "/blog/five-walks",
          excerpt: "From gentle riverside strolls to the Compassberg summit.",
          coverUrl: IMG("b1"),
          date: "Apr 2026",
        },
        {
          title: "What to pack for the Karoo",
          href: "/blog/packing",
          excerpt: "It's hot by day and properly cold by night.",
          coverUrl: IMG("b2"),
          date: "Mar 2026",
        },
        {
          title: "Our favourite village suppers",
          href: "/blog/suppers",
          excerpt: "Where the locals actually eat.",
          coverUrl: IMG("b3"),
          date: "Feb 2026",
        },
      ],
    },
  },
};

export default async function SitePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; accent?: string }>;
}) {
  const sp = await searchParams;
  const theme: SiteThemeConfig = {
    preset: sp.preset ?? "warm",
    accent: sp.accent || undefined,
  };

  const nav = [
    { label: "Home", href: "#" },
    { label: "Rooms", href: "#rooms" },
    { label: "About", href: "#" },
    { label: "Journal", href: "#" },
  ];

  return (
    <div className="-m-4 md:-m-6">
      {/* Dev toolbar (app-themed, outside the site theme root) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-line bg-brand-light px-4 py-2 text-xs">
        <span className="font-semibold text-brand-ink">Site preview</span>
        <span className="text-brand-mute">— theme:</span>
        {SITE_PRESET_KEYS.map((key) => (
          <Link
            key={key}
            href={`/dashboard/website/preview?preset=${key}`}
            className={`rounded px-2 py-0.5 font-medium ${
              theme.preset === key
                ? "bg-brand-primary text-white"
                : "bg-white text-brand-ink hover:bg-brand-accent"
            }`}
          >
            {key}
          </Link>
        ))}
      </div>

      <SiteThemeRoot theme={theme}>
        <SiteChrome
          brand={{ name: "Stillwater Cottage", tagline: "Karoo escape" }}
          nav={nav}
          darkChrome={siteSurfaceIsDark(theme)}
          bookHref="/property/stillwater/book"
          header={theme.header}
          footer={theme.footer}
        >
          <div id="rooms" />
          <SectionRenderer sections={sections} data={data} />
        </SiteChrome>
      </SiteThemeRoot>
    </div>
  );
}
