// Shared types for the hosted micro-site renderer.
//
// Section components are PURE PRESENTATIONAL — they never fetch. Auto-populate
// sections (gallery, rooms_preview, location, reviews, blog_preview) receive
// their live data via a `SiteData` map keyed by section id, assembled
// server-side (W4 `loadSitePage.ts`). Free-form sections read everything from
// their own `props` and ignore this map.
import type { SectionType } from "@/lib/website/sections.schema";

export type SiteLogoStyle = "wordmark" | "mark" | "icon";

export type SiteSocials = {
  instagram?: string | null;
  facebook?: string | null;
  x?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  website?: string | null;
};

export type SiteBrand = {
  name: string;
  tagline?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  /** How the logo renders in chrome: wordmark (name), mark (logo+name), icon. */
  logoStyle?: SiteLogoStyle;
  contactEmail?: string | null;
  contactPhone?: string | null;
  socials?: SiteSocials;
};

export type SiteNavItem = {
  label: string;
  href: string; // path within the site (e.g. "/", "/about")
};

// ── Per-section live data (auto-populate sections only) ───────
export type GalleryImage = { url: string; caption?: string | null };
export type GalleryData = { images: GalleryImage[] };

export type RoomCard = {
  id: string;
  name: string;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  bookHref: string; // absolute deep-link into the existing booking engine
};
export type RoomsPreviewData = { rooms: RoomCard[] };

export type Poi = {
  name: string;
  category?: string | null;
  distance?: string | null;
};
export type LocationData = {
  address?: string | null;
  mapEmbedUrl?: string | null;
  pois: Poi[];
};

export type ReviewCard = {
  author: string;
  rating: number; // 1..5
  body: string;
  date?: string | null;
};
export type ReviewsData = {
  items: ReviewCard[];
  average?: number | null;
  count?: number | null;
};

export type BlogCard = {
  title: string;
  href: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  date?: string | null;
};
export type BlogPreviewData = { posts: BlogCard[] };

/** Live-data shape per auto-populate section type. */
export type SiteDataByType = {
  gallery: GalleryData;
  rooms_preview: RoomsPreviewData;
  location: LocationData;
  reviews: ReviewsData;
  blog_preview: BlogPreviewData;
};
export type AutoSectionType = keyof SiteDataByType;

/** A datum tagged with its section type (for the by-id map). */
export type SiteSectionDatum = {
  [K in AutoSectionType]: { type: K; data: SiteDataByType[K] };
}[AutoSectionType];

/** sectionId → live data for that section (only auto-populate sections appear). */
export type SiteData = Record<string, SiteSectionDatum>;

// ── Publish snapshot (W10) ───────────────────────────────────
/** One room's published channel state, captured into the publish snapshot. */
export type SnapshotRoom = {
  room_id: string;
  is_visible: boolean;
  display_name: string | null;
  display_price: number | null;
  display_currency: string | null;
  display_desc: string | null;
  sort_order: number;
};

/**
 * Frozen public-render config captured at publish time
 * (`host_websites.published_snapshot`). The public renderer reads chrome +
 * channel membership from here so unpublished edits never leak; preview mode
 * keeps reading the live columns.
 */
export type PublishSnapshot = {
  brand: Record<string, unknown>;
  theme: Record<string, unknown>;
  seo: Record<string, unknown>;
  nav: SiteNavItem[];
  propertyIds: string[];
  rooms: SnapshotRoom[];
};

export type SiteAssetResolver = (
  path: string | null | undefined,
) => string | undefined;

/** Narrow a SiteData entry to the datum for a given section type. */
export function dataFor<T extends AutoSectionType>(
  map: SiteData | undefined,
  id: string,
  type: T,
): SiteDataByType[T] | undefined {
  const entry = map?.[id];
  if (!entry || entry.type !== type) return undefined;
  // Runtime check guarantees the match; the flat lookup keeps the return type
  // narrow for call sites (which pass a literal `type`).
  return entry.data as SiteDataByType[T];
}

export type { SectionType };
