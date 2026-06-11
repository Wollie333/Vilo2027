/**
 * OpenStreetMap Overpass helpers for the "Suggest nearby places" feature.
 *
 * Given a listing's saved latitude/longitude we ask the free, keyless
 * Overpass API for real places around it and bucket them into the same
 * Eat / Do / Travel categories used by `listing_points_of_interest`.
 *
 * Pure, dependency-free, and runs server-side only (the action POSTs the
 * built query). Travel time is an estimate derived from straight-line
 * distance — we have no routing API — and is always editable by the host.
 */

export type PoiCategory = "eat" | "do" | "travel";

export type NearbyCandidate = {
  name: string;
  category: PoiCategory;
  /** Pre-filled, editable estimate e.g. "4 min". */
  travelTime: string;
  /** Straight-line distance in km, for muted context in the picker. */
  distanceKm: number;
};

export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

/** Search radius around the listing, in metres. ~5km covers a town. */
const RADIUS_M = 5000;
/** Max suggestions returned per bucket after sorting by distance. */
const PER_CATEGORY_CAP = 8;
/** Assumed town-driving speed (km/h) for the time estimate. */
const ASSUMED_SPEED_KMH = 40;

/**
 * OSM tag → our bucket. Each entry is one `key=value` pair we ask Overpass
 * for. Kept small and high-signal: a handful of well-known place types per
 * bucket beats a noisy long list.
 */
const TAG_BUCKETS: { key: string; values: string[]; category: PoiCategory }[] =
  [
    {
      key: "amenity",
      values: ["restaurant", "cafe", "fast_food", "bar", "pub"],
      category: "eat",
    },
    { key: "shop", values: ["bakery"], category: "eat" },
    {
      key: "tourism",
      values: [
        "attraction",
        "viewpoint",
        "museum",
        "gallery",
        "zoo",
        "theme_park",
      ],
      category: "do",
    },
    {
      key: "leisure",
      values: ["park", "nature_reserve", "golf_course"],
      category: "do",
    },
    { key: "natural", values: ["waterfall", "peak", "beach"], category: "do" },
    {
      key: "tourism",
      values: ["hotel", "guest_house", "information"],
      category: "travel",
    },
    {
      key: "amenity",
      values: ["fuel", "pharmacy", "hospital"],
      category: "travel",
    },
    { key: "aeroway", values: ["aerodrome"], category: "travel" },
    { key: "railway", values: ["station"], category: "travel" },
  ];

/**
 * Resolve a result's bucket from its OSM tags, honouring the order of
 * TAG_BUCKETS (first match wins). Returns null if no tracked tag matches.
 */
function categoryForTags(tags: Record<string, string>): PoiCategory | null {
  for (const bucket of TAG_BUCKETS) {
    const value = tags[bucket.key];
    if (value && bucket.values.includes(value)) return bucket.category;
  }
  return null;
}

/** Build the Overpass QL query for nodes+ways around the coordinate. */
export function buildOverpassQuery(lat: number, lng: number): string {
  const around = `around:${RADIUS_M},${lat},${lng}`;
  const lines: string[] = [];
  for (const { key, values } of TAG_BUCKETS) {
    const regex = values.join("|");
    // nwr = node/way/relation. "name" filter drops unnamed features early.
    lines.push(`  nwr["${key}"~"^(${regex})$"]["name"](${around});`);
  }
  return `[out:json][timeout:25];\n(\n${lines.join("\n")}\n);\nout center 200;`;
}

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough drive-time estimate from distance, floored at 1 min. */
export function estimateMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60));
}

type OverpassElement = {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Turn a raw Overpass JSON response into ranked candidates per bucket.
 *
 * @param json     parsed Overpass response
 * @param lat,lng  the listing coordinates (for distance)
 * @param existing lowercased names already on the listing, to skip duplicates
 */
export function parseOverpassResponse(
  json: unknown,
  lat: number,
  lng: number,
  existing: Set<string>,
): Record<PoiCategory, NearbyCandidate[]> {
  const elements = (json as { elements?: OverpassElement[] }).elements ?? [];

  const seen = new Set(existing);
  const buckets: Record<PoiCategory, NearbyCandidate[]> = {
    eat: [],
    do: [],
    travel: [],
  };

  for (const el of elements) {
    const tags = el.tags;
    const name = tags?.name?.trim();
    if (!name) continue;

    const category = categoryForTags(tags ?? {});
    if (!category) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (pLat == null || pLng == null) continue;

    const distanceKm = haversineKm(lat, lng, pLat, pLng);
    buckets[category].push({
      name,
      category,
      travelTime: `${estimateMinutes(distanceKm)} min`,
      distanceKm,
    });
  }

  for (const cat of Object.keys(buckets) as PoiCategory[]) {
    buckets[cat].sort((a, b) => a.distanceKm - b.distanceKm);
    buckets[cat] = buckets[cat].slice(0, PER_CATEGORY_CAP);
  }
  return buckets;
}
