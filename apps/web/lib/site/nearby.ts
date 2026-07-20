/**
 * Nearby experiences — "things to do around the host's property".
 *
 * The shape mirrors the fields Google Places (Places API v1) returns, so wiring
 * real data later is a straight swap for the placeholder set below:
 *   name       ← place.displayName.text
 *   category   ← place.primaryTypeDisplayName.text
 *   distance   ← computed from place.location vs the property's lat/lng
 *   rating     ← place.rating
 *   reviews    ← place.userRatingCount
 *   price      ← place.priceLevel  (mapped to "$".."$$$$" | "Free" | null)
 *   openNow    ← place.currentOpeningHours.openNow
 *   blurb      ← place.editorialSummary.text
 *   imageUrl   ← place.photos[0]  (via the Places Photo endpoint)
 *   mapsUri    ← place.googleMapsUri  (used for the "Directions" link)
 *
 * Until the Google Places fetch is wired, pages render NEARBY_PLACEHOLDER so the
 * design is visible. The UI flags it as a "sample" via `isPlaceholder`, and the
 * real fetch will replace this array (and drop the flag).
 */
export type NearbyPlace = {
  name: string;
  category: string;
  /** Pre-formatted "3.4 km · 6 min" (distance + rough drive time). */
  distance: string;
  rating: number;
  reviews: number;
  /** "$".."$$$$", "Free", or null when unknown. */
  price: string | null;
  openNow: boolean | null;
  blurb: string | null;
  imageUrl: string | null;
  mapsUri: string | null;
  /** Coarse type bucket for the filter row (maps from Google place types). */
  group: "eat" | "nature" | "see" | "shop";
};

/** Rounded 0–5 star count for the star glyph run. */
export function nearbyStars(rating: number): number {
  return Math.max(0, Math.min(5, Math.round(rating)));
}

/** Coarse filter buckets, in display order. */
export const NEARBY_GROUPS: {
  key: NearbyPlace["group"] | "all";
  label: string;
}[] = [
  { key: "all", label: "All" },
  { key: "eat", label: "Eat & drink" },
  { key: "nature", label: "Nature" },
  { key: "see", label: "See & do" },
  { key: "shop", label: "Shop" },
];

/**
 * Placeholder set (design only — replaced by the Google Places fetch). Generic,
 * clearly-sample entries; the UI labels the section as a sample so nothing here
 * reads as a verified claim about a specific property's surroundings.
 */
export const NEARBY_PLACEHOLDER: NearbyPlace[] = [
  {
    name: "Riverside Canyon Viewpoint",
    category: "Scenic lookout",
    distance: "12 km · 16 min",
    rating: 4.8,
    reviews: 6120,
    price: "Free",
    openNow: true,
    blurb:
      "A short drive to one of the region's most photographed viewpoints — best at golden hour.",
    imageUrl:
      "https://images.unsplash.com/photo-1504870712357-65ea720d6078?w=800&q=80",
    mapsUri: null,
    group: "nature",
  },
  {
    name: "The Riverside Grill",
    category: "Restaurant",
    distance: "3.4 km · 6 min",
    rating: 4.6,
    reviews: 842,
    price: "$$",
    openNow: true,
    blurb:
      "Slow-cooked local fare and long views. Book ahead for the deck at sunset.",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    mapsUri: null,
    group: "eat",
  },
  {
    name: "Panorama Route Loop",
    category: "Scenic drive",
    distance: "18 km · 22 min",
    rating: 4.9,
    reviews: 3410,
    price: "Free",
    openNow: true,
    blurb:
      "A morning loop of the area's most dramatic cliffs, waterfalls and lookouts.",
    imageUrl:
      "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80",
    mapsUri: null,
    group: "nature",
  },
  {
    name: "Wildlife Rehabilitation Centre",
    category: "Wildlife",
    distance: "9 km · 12 min",
    rating: 4.7,
    reviews: 2180,
    price: "$$",
    openNow: false,
    blurb:
      "Guided tours meet rescued raptors and big cats up close. Two tours daily.",
    imageUrl:
      "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?w=800&q=80",
    mapsUri: null,
    group: "see",
  },
  {
    name: "Highlands Wine Estate",
    category: "Winery",
    distance: "14 km · 19 min",
    rating: 4.5,
    reviews: 560,
    price: "$$$",
    openNow: true,
    blurb:
      "Cool-climate tastings on a working farm, with a cheese board and a long view over the vines.",
    imageUrl:
      "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=80",
    mapsUri: null,
    group: "eat",
  },
  {
    name: "Village Craft Market",
    category: "Shopping",
    distance: "22 km · 25 min",
    rating: 4.3,
    reviews: 1290,
    price: "$",
    openNow: true,
    blurb:
      "Local beadwork, carvings and ground coffee — the best spot to pick up something made nearby.",
    imageUrl:
      "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80",
    mapsUri: null,
    group: "shop",
  },
];
