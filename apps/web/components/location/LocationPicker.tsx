"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// Lightweight Mapbox location picker — uses the Geocoding v5 API for search
// + the Static Maps API for the preview. Zero npm deps, just `fetch`.
// Gated by NEXT_PUBLIC_MAPBOX_TOKEN — when missing, the parent should hide
// the picker and fall back to plain address inputs.

type Selection = {
  address_line1: string;
  city: string;
  province: string;
  postal_code: string;
  latitude: number;
  longitude: number;
};

type MapboxFeature = {
  id: string;
  place_name: string;
  text: string;
  address?: string;
  center: [number, number]; // [lng, lat]
  context?: { id: string; text: string }[];
};

const SA_PROVINCE_BY_REGION_NAME: Record<string, string> = {
  "Eastern Cape": "Eastern Cape",
  "Free State": "Free State",
  Gauteng: "Gauteng",
  "KwaZulu-Natal": "KwaZulu-Natal",
  Limpopo: "Limpopo",
  Mpumalanga: "Mpumalanga",
  "Northern Cape": "Northern Cape",
  "North West": "North West",
  "Western Cape": "Western Cape",
};

function pickFromContext(
  feature: MapboxFeature,
  prefix: string,
): string | undefined {
  return feature.context?.find((c) => c.id.startsWith(prefix))?.text;
}

function flattenToSelection(feature: MapboxFeature): Selection {
  // Mapbox returns a hierarchical address. Build a one-line street address
  // from the feature's text + house number when present.
  const streetParts: string[] = [];
  if (feature.address) streetParts.push(feature.address);
  if (feature.text) streetParts.push(feature.text);

  const provinceRaw = pickFromContext(feature, "region") ?? "";
  const province = SA_PROVINCE_BY_REGION_NAME[provinceRaw] ?? "";

  return {
    address_line1: streetParts.join(" "),
    city:
      pickFromContext(feature, "place") ??
      pickFromContext(feature, "locality") ??
      "",
    province,
    postal_code: pickFromContext(feature, "postcode") ?? "",
    longitude: feature.center[0],
    latitude: feature.center[1],
  };
}

export function LocationPicker({
  latitude,
  longitude,
  onSelect,
  token,
}: {
  latitude: number | null;
  longitude: number | null;
  onSelect: (s: Selection) => void;
  token: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapboxFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search — fires 300ms after the user stops typing.
  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSearching(true);
      try {
        const url = new URL(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query.trim(),
          )}.json`,
        );
        url.searchParams.set("country", "za");
        url.searchParams.set("limit", "5");
        url.searchParams.set("types", "address,place,postcode,locality");
        url.searchParams.set("access_token", token);

        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error(`Mapbox ${res.status}`);
        const data = (await res.json()) as { features?: MapboxFeature[] };
        setResults(data.features ?? []);
        setShowResults(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, token]);

  function handlePick(feature: MapboxFeature) {
    const sel = flattenToSelection(feature);
    onSelect(sel);
    setQuery(feature.place_name);
    setShowResults(false);
  }

  // Static map URL. Centred on the saved coords with a red pin; falls back
  // to Cape Town at country zoom when nothing's set yet.
  const staticMapSrc = useMemo(() => {
    const hasPin = latitude != null && longitude != null;
    const lng = hasPin ? longitude : 24.5;
    const lat = hasPin ? latitude : -29;
    const zoom = hasPin ? 14 : 4;
    const pin = hasPin ? `pin-l+10b981(${lng},${lat})/` : "";
    return (
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
      `${pin}${lng},${lat},${zoom},0/720x320@2x?access_token=${encodeURIComponent(token)}`
    );
  }, [latitude, longitude, token]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            placeholder="Search an address, suburb, or landmark…"
            aria-label="Search location"
            className="w-full rounded border border-brand-line bg-white py-2.5 pl-9 pr-9 text-sm text-brand-ink transition placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
          />
          {isSearching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-mute" />
          ) : null}
        </div>

        {showResults && results.length > 0 ? (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded border border-brand-line bg-white py-1 shadow-lift"
          >
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(r)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-brand-ink transition-colors hover:bg-brand-light"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-mute" />
                  <span className="line-clamp-2">{r.place_name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-card border border-brand-line bg-brand-light">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={staticMapSrc}
          alt={
            latitude != null && longitude != null
              ? "Map showing the listing location"
              : "Map placeholder — search an address to set the pin"
          }
          className="block h-auto w-full"
          loading="lazy"
        />
      </div>

      {latitude == null || longitude == null ? (
        <p className="text-xs text-brand-mute">
          Search for an address above — picking a result fills the rest of this
          form and drops the pin.
        </p>
      ) : (
        <p className="text-xs text-brand-mute">
          Pin at{" "}
          <span className="font-mono text-brand-ink">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
          . Search again to move it, or edit the fields below to fine-tune.
        </p>
      )}
    </div>
  );
}
