// Fetch real "nearby experiences" for a property from OpenStreetMap — free, no
// API key (Overpass for POIs + Nominatim as a geocode fallback). Returns
// NearbyPlace[] shaped for SiteNearbyExperiences. OSM has no ratings/photos/
// reviews, so those come back null and the card degrades gracefully; what OSM
// DOES give reliably is real places, their type, and coordinates → accurate
// distance + a working Directions link.
//
// Server-only (network fetch). Called from a host-triggered server action that
// caches the result into content_profile.experiences.nearby — never on every
// public request (Overpass is rate-limited + slow). Results are host-curated
// drafts, not silent auto-publish.
import type { NearbyPlace } from "./nearby";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "WieloSite/1.0 (nearby-experiences; +https://wielo.site)";

/** Haversine distance in km between two lat/lng points. */
function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** "800 m · 2 min" / "12.4 km · 14 min" — rough drive time at ~55 km/h. */
function formatDistance(km: number): string {
  const mins = Math.max(1, Math.round((km / 55) * 60));
  const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  return `${dist} · ${mins} min`;
}

// OSM tag → { group, category label }. Ordered by the tag key we read.
type Mapped = { group: NearbyPlace["group"]; category: string };
const TOURISM: Record<string, Mapped> = {
  attraction: { group: "see", category: "Attraction" },
  viewpoint: { group: "nature", category: "Viewpoint" },
  museum: { group: "see", category: "Museum" },
  gallery: { group: "see", category: "Gallery" },
  zoo: { group: "see", category: "Wildlife" },
  theme_park: { group: "see", category: "Theme park" },
  artwork: { group: "see", category: "Public art" },
  picnic_site: { group: "nature", category: "Picnic site" },
  wine_cellar: { group: "eat", category: "Wine cellar" },
};
const LEISURE: Record<string, Mapped> = {
  park: { group: "nature", category: "Park" },
  nature_reserve: { group: "nature", category: "Nature reserve" },
  garden: { group: "nature", category: "Garden" },
};
const NATURAL: Record<string, Mapped> = {
  peak: { group: "nature", category: "Peak" },
  waterfall: { group: "nature", category: "Waterfall" },
  beach: { group: "nature", category: "Beach" },
  cave_entrance: { group: "nature", category: "Cave" },
};
const HISTORIC: Record<string, Mapped> = {
  monument: { group: "see", category: "Monument" },
  memorial: { group: "see", category: "Memorial" },
  castle: { group: "see", category: "Castle" },
  ruins: { group: "see", category: "Ruins" },
  archaeological_site: { group: "see", category: "Heritage site" },
};
const AMENITY: Record<string, Mapped> = {
  restaurant: { group: "eat", category: "Restaurant" },
  cafe: { group: "eat", category: "Café" },
  bar: { group: "eat", category: "Bar" },
  pub: { group: "eat", category: "Pub" },
  winery: { group: "eat", category: "Winery" },
  marketplace: { group: "shop", category: "Market" },
};
const SHOP: Record<string, Mapped> = {
  craft: { group: "shop", category: "Craft shop" },
  gift: { group: "shop", category: "Gift shop" },
  art: { group: "shop", category: "Art shop" },
  farm: { group: "shop", category: "Farm shop" },
};

/** Resolve an OSM element's tags → its bucket + display category, or null to skip. */
function classify(tags: Record<string, string>): Mapped | null {
  return (
    (tags.tourism && TOURISM[tags.tourism]) ||
    (tags.leisure && LEISURE[tags.leisure]) ||
    (tags.natural && NATURAL[tags.natural]) ||
    (tags.historic && HISTORIC[tags.historic]) ||
    (tags.amenity && AMENITY[tags.amenity]) ||
    (tags.shop && SHOP[tags.shop]) ||
    null
  );
}

type OverpassEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Geocode an address string to lat/lng via Nominatim (usage-policy compliant:
 *  identifying UA, single request). Returns null when nothing matches. */
export async function geocodeAddress(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!query.trim()) return null;
  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      // Geocode result is stable; cache a day at the fetch layer.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string }[];
    const row = rows[0];
    if (!row) return null;
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/**
 * Fetch nearby POIs around a lat/lng from Overpass, mapped to NearbyPlace[],
 * de-duplicated by name, nearest-first, capped at `limit`. `radiusKm` defaults
 * to 30km (rural properties need a wide net). Returns [] on any failure.
 */
export async function fetchNearbyPlaces(opts: {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
}): Promise<NearbyPlace[]> {
  const { lat, lng } = opts;
  const radius = Math.round((opts.radiusKm ?? 30) * 1000);
  const limit = opts.limit ?? 9;
  // Value-filter every key to exactly the types classify() maps, so the capped
  // element budget isn't wasted on hotels/guesthouses/other tourism we discard.
  const filters = [
    "[tourism~'^(attraction|viewpoint|museum|gallery|zoo|theme_park|artwork|picnic_site|wine_cellar)$']",
    "[leisure~'^(park|nature_reserve|garden)$']",
    "[natural~'^(peak|waterfall|beach|cave_entrance)$']",
    "[historic~'^(monument|memorial|castle|ruins|archaeological_site)$']",
    "[amenity~'^(restaurant|cafe|bar|pub|winery|marketplace)$']",
    "[shop~'^(craft|gift|art|farm)$']",
  ];
  const body = filters
    .map((f) => `nwr(around:${radius},${lat},${lng})${f}["name"];`)
    .join("\n");
  const query = `[out:json][timeout:25];(${body});out center ${Math.max(
    limit * 6,
    60,
  )};`;

  let els: OverpassEl[];
  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: `data=${encodeURIComponent(query)}`,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { elements?: OverpassEl[] };
    els = json.elements ?? [];
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: (NearbyPlace & { _km: number })[] = [];
  for (const el of els) {
    const tags = el.tags;
    if (!tags?.name) continue;
    const mapped = classify(tags);
    if (!mapped) continue;
    const eLat = el.lat ?? el.center?.lat;
    const eLng = el.lon ?? el.center?.lon;
    if (typeof eLat !== "number" || typeof eLng !== "number") continue;
    const key = tags.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const km = distanceKm(lat, lng, eLat, eLng);
    out.push({
      name: tags.name.trim(),
      category: mapped.category,
      group: mapped.group,
      distance: formatDistance(km),
      rating: null,
      reviews: null,
      price: null,
      openNow: null,
      blurb: tags.description?.trim() || null,
      imageUrl: null,
      // Directions straight to the coordinates — always works, no place-id needed.
      mapsUri: `https://www.google.com/maps/dir/?api=1&destination=${eLat},${eLng}`,
      _km: km,
    });
  }

  // Diversify the default selection. OSM is density-weighted — a town centre is
  // thick with restaurants — so a pure nearest-first slice reads as "9 places to
  // eat". Round-robin across the four groups (each pass takes the nearest
  // not-yet-picked place from every group), so the capped set spans
  // eat/see/nature/shop while still favouring the closest places; empty groups
  // are skipped, so a sparse area just takes more from what's there. Final
  // display stays nearest-first (the card also offers a category filter).
  type Ranked = NearbyPlace & { _km: number };
  const byGroup = new Map<NearbyPlace["group"], Ranked[]>();
  for (const p of out.sort((a, b) => a._km - b._km)) {
    const arr = byGroup.get(p.group);
    if (arr) arr.push(p);
    else byGroup.set(p.group, [p]);
  }
  const order: NearbyPlace["group"][] = ["eat", "see", "nature", "shop"];
  const cursors = new Map<NearbyPlace["group"], number>();
  const picked: Ranked[] = [];
  let progressed = true;
  while (picked.length < limit && progressed) {
    progressed = false;
    for (const g of order) {
      if (picked.length >= limit) break;
      const arr = byGroup.get(g);
      const i = cursors.get(g) ?? 0;
      if (arr && i < arr.length) {
        picked.push(arr[i]);
        cursors.set(g, i + 1);
        progressed = true;
      }
    }
  }

  return picked
    .sort((a, b) => a._km - b._km)
    .map(({ _km, ...place }) => {
      void _km;
      return place;
    });
}

/**
 * High-level: resolve a property's coordinates (given lat/lng, else geocode the
 * address) and fetch its nearby places. Returns [] when neither coords nor a
 * geocodable address is available.
 */
export async function fetchNearbyForProperty(opts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  radiusKm?: number;
  limit?: number;
}): Promise<NearbyPlace[]> {
  let lat = opts.lat ?? null;
  let lng = opts.lng ?? null;
  if ((lat == null || lng == null) && opts.address) {
    const geo = await geocodeAddress(opts.address);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    }
  }
  if (lat == null || lng == null) return [];
  return fetchNearbyPlaces({
    lat,
    lng,
    radiusKm: opts.radiusKm,
    limit: opts.limit,
  });
}
