import "server-only";

// Server-side Google geocoding proxy. The API key NEVER reaches the browser —
// the LocationPicker calls our /api/geo route, which calls these. Uses:
//   • Places API (New)  — type-ahead autocomplete (restricted to South Africa)
//   • Geocoding API     — place-id details + reverse geocode (one parser)
// Enable BOTH "Places API (New)" and "Geocoding API" on the key's project, and
// set GOOGLE_MAPS_API_KEY. Without the key every call returns empty (graceful).

const KEY = process.env.GOOGLE_MAPS_API_KEY;

export type GeoSuggestion = {
  placeId: string;
  main: string;
  secondary: string;
};

export type GeoAddress = {
  latitude?: number;
  longitude?: number;
  address_line1?: string;
  city?: string;
  municipality?: string;
  province?: string;
  postal_code?: string;
};

export function geoConfigured(): boolean {
  return !!KEY;
}

// ── Autocomplete (Places API New), biased + restricted to South Africa ──
export async function placesAutocomplete(
  input: string,
): Promise<GeoSuggestion[]> {
  if (!KEY || input.trim().length < 2) return [];
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY },
        body: JSON.stringify({
          input: input.trim(),
          includedRegionCodes: ["za"],
          regionCode: "ZA",
          languageCode: "en",
        }),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }[];
    };
    return (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .map((p) => ({
        placeId: p.placeId as string,
        main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }));
  } catch {
    return [];
  }
}

// ── Geocoding API component parsing (one parser for place-id + reverse) ──
type GComponent = { long_name: string; short_name: string; types: string[] };
type GResult = {
  address_components?: GComponent[];
  geometry?: { location?: { lat: number; lng: number } };
};

function pick(comps: GComponent[], type: string): string | undefined {
  return comps.find((c) => c.types.includes(type))?.long_name;
}

function mapGeocode(result: GResult): GeoAddress {
  const comps = result.address_components ?? [];
  const line1 =
    [pick(comps, "street_number"), pick(comps, "route")]
      .filter(Boolean)
      .join(" ")
      .trim() || undefined;
  // SA: locality = town (e.g. "Sabie"); admin level 1 = province; level 2 =
  // district/municipality; postal_code = the real ZIP.
  const city =
    pick(comps, "locality") ??
    pick(comps, "postal_town") ??
    pick(comps, "sublocality") ??
    pick(comps, "administrative_area_level_2");
  return {
    latitude: result.geometry?.location?.lat,
    longitude: result.geometry?.location?.lng,
    address_line1: line1,
    city,
    municipality: pick(comps, "administrative_area_level_2"),
    province: pick(comps, "administrative_area_level_1"),
    postal_code: pick(comps, "postal_code"),
  };
}

async function geocode(params: Record<string, string>): Promise<GeoAddress> {
  if (!KEY) return {};
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("key", KEY);
    url.searchParams.set("region", "za");
    url.searchParams.set("language", "en");
    const res = await fetch(url.toString());
    if (!res.ok) return {};
    const data = (await res.json()) as { results?: GResult[] };
    const r = data.results?.[0];
    return r ? mapGeocode(r) : {};
  } catch {
    return {};
  }
}

export async function geocodeByPlaceId(placeId: string): Promise<GeoAddress> {
  return geocode({ place_id: placeId });
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeoAddress> {
  // The clicked point stays authoritative for coordinates; we only borrow the
  // resolved address fields.
  const addr = await geocode({ latlng: `${lat},${lng}` });
  return { ...addr, latitude: lat, longitude: lng };
}
