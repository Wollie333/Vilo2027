"use client";

import "leaflet/dist/leaflet.css";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

// Keyless OpenStreetMap location picker — no API token, no paid service.
// Type-ahead search uses Photon (komoot's free OSM geocoder, built for
// autocomplete); the interactive map is Leaflet on OSM tiles (already a repo
// dependency, see app/listing/[slug]/LocationMap). Three ways to set the pin:
//   1. Type an address → suggestions appear → pick one (fills every field).
//   2. Click the map → drops the pin and reverse-geocodes the address.
//   3. Drag the pin → same as a click at the new spot.
// Only when the host PICKS a suggestion do the fields + coordinates fill — just
// like Google. The latitude/longitude flow up via onSelect so "Suggest nearby
// places" has coordinates to work with.

// Only lat/lng are guaranteed; the geocoder may not return every address part,
// so the rest are optional and the parent only overwrites a field when present.
export type LocationSelection = {
  latitude: number;
  longitude: number;
  address_line1?: string;
  city?: string;
  province?: string;
  postal_code?: string;
};

type PhotonProps = {
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  postcode?: string;
  countrycode?: string;
  osm_id?: number;
  osm_type?: string;
};
type PhotonFeature = {
  geometry: { coordinates: [number, number] }; // [lon, lat]
  properties: PhotonProps;
};

// Photon returns SA provinces under `state` already matching our labels.
const SA_PROVINCES = new Set([
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
]);

const PHOTON = "https://photon.komoot.io";
// South Africa bounding box (minLon,minLat,maxLon,maxLat) — keeps suggestions
// local so half-typed queries surface SA places, not lookalikes abroad.
const SA_BBOX = "16.3,-35.0,33.1,-22.0";

function cityOf(p: PhotonProps): string | undefined {
  return p.city || p.district || p.county || undefined;
}

function flatten(f: PhotonFeature): LocationSelection {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ").trim();
  const city = cityOf(p);
  const province = p.state && SA_PROVINCES.has(p.state) ? p.state : undefined;
  // A named POI with no street (e.g. a guesthouse) → use its name as line 1.
  const line1 = street || (p.name && p.name !== city ? p.name : undefined);
  return {
    latitude: lat,
    longitude: lng,
    address_line1: line1,
    city,
    province,
    postal_code: p.postcode || undefined,
  };
}

// Two-line label, Google-style: a bold primary line + a muted secondary line.
function label(p: PhotonProps): { main: string; secondary: string } {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ").trim();
  const city = cityOf(p) ?? "";
  const main = p.name || street || city || p.state || "Location";
  const seen = new Set([main]);
  const secondary = [street, city, p.state, p.postcode]
    .filter((x): x is string => !!x && !seen.has(x) && (seen.add(x), true))
    .join(", ");
  return { main, secondary };
}

// Inline SVG pin as a Leaflet divIcon — avoids Leaflet's broken default marker
// image assets (they 404 under bundlers) and keeps the picker keyless/asset-free.
function pinIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "",
    html: `<svg width="30" height="40" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z" fill="#10B981"/>
      <circle cx="12" cy="12" r="4.5" fill="#fff"/>
    </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
  });
}

export function LocationPicker({
  latitude,
  longitude,
  onSelect,
}: {
  latitude: number | null;
  longitude: number | null;
  onSelect: (s: LocationSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  // True for one render after a pick, so re-setting the input text doesn't
  // immediately re-search and re-open the dropdown.
  const justPickedRef = useRef(false);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  // Latest props for the init effect + search bias, without re-running effects.
  const coordsRef = useRef({ lat: latitude, lng: longitude });
  coordsRef.current = { lat: latitude, lng: longitude };
  // Set when the next coord change should fly the map to it (a search pick), as
  // opposed to a local map click/drag where the view should stay put.
  const recenterRef = useRef(false);
  const mapId = useId();

  // Reverse-geocode a clicked/dragged point, then push it up. Coords always
  // flow up even if the lookup fails, so the map stays the source of truth.
  async function emitFromPoint(lat: number, lng: number) {
    onSelect({ latitude: lat, longitude: lng });
    try {
      const url = new URL(`${PHOTON}/reverse`);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("lang", "en");
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { features?: PhotonFeature[] };
      const f = data.features?.[0];
      if (f) onSelect(flatten(f));
    } catch {
      // Offline / rate-limited — the raw coords are already set, that's fine.
    }
  }

  // ── Initialise the Leaflet map once (browser only — leaflet touches DOM). ──
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapElRef.current || mapRef.current) return;
      leafletRef.current = L;

      const { lat, lng } = coordsRef.current;
      const hasPin = lat != null && lng != null;
      const map = L.map(mapElRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView(hasPin ? [lat, lng] : [-29, 24.5], hasPin ? 15 : 5);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      if (hasPin) {
        const m = L.marker([lat, lng], {
          draggable: true,
          icon: pinIcon(L),
        }).addTo(map);
        m.on("dragend", () => {
          const p = m.getLatLng();
          void emitFromPoint(p.lat, p.lng);
        });
        markerRef.current = m;
      }

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        void emitFromPoint(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep the marker in sync when coords change (search pick, manual edit). ──
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (latitude == null || longitude == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const pos: [number, number] = [latitude, longitude];
    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      const m = L.marker(pos, { draggable: true, icon: pinIcon(L) }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        void emitFromPoint(p.lat, p.lng);
      });
      markerRef.current = m;
    }
    // Fly to the pin after a search pick (or whenever it would be off-screen);
    // leave the view alone for local clicks/drags so the map doesn't jump.
    if (recenterRef.current) {
      map.setView(pos, Math.max(map.getZoom(), 16));
      recenterRef.current = false;
    } else if (!map.getBounds().contains(pos)) {
      map.setView(pos, Math.max(map.getZoom(), 14));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  // ── Debounced type-ahead search (Photon) — fires 220ms after a keystroke. ──
  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    if (!query || query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSearching(true);
      try {
        const url = new URL(`${PHOTON}/api`);
        url.searchParams.set("q", query.trim());
        url.searchParams.set("limit", "6");
        url.searchParams.set("lang", "en");
        url.searchParams.set("bbox", SA_BBOX);
        // Bias toward the existing pin so nearby matches rank first.
        if (coordsRef.current.lat != null && coordsRef.current.lng != null) {
          url.searchParams.set("lat", String(coordsRef.current.lat));
          url.searchParams.set("lon", String(coordsRef.current.lng));
        }
        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Photon ${res.status}`);
        const data = (await res.json()) as { features?: PhotonFeature[] };
        const feats = (data.features ?? []).filter(
          (f) => f.geometry?.coordinates,
        );
        setResults(feats);
        setActiveIdx(-1);
        setShowResults(feats.length > 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
          setShowResults(false);
        }
      } finally {
        setIsSearching(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [query]);

  function handlePick(f: PhotonFeature) {
    recenterRef.current = true; // fly the map to the chosen place
    justPickedRef.current = true; // and don't re-search the text we set below
    onSelect(flatten(f));
    setQuery(label(f.properties).main);
    setResults([]);
    setShowResults(false);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showResults || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handlePick(results[activeIdx]);
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => results.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            placeholder="Start typing an address, suburb, or place…"
            aria-label="Search location"
            autoComplete="off"
            role="combobox"
            aria-expanded={showResults}
            aria-controls={`${mapId}-listbox`}
            className="w-full rounded border border-brand-line bg-white py-2.5 pl-9 pr-9 text-sm text-brand-ink transition placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
          />
          {isSearching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-mute" />
          ) : null}
        </div>

        {showResults && results.length > 0 ? (
          <ul
            id={`${mapId}-listbox`}
            role="listbox"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded border border-brand-line bg-white py-1 shadow-lift"
          >
            {results.map((f, i) => {
              const { main, secondary } = label(f.properties);
              const active = i === activeIdx;
              return (
                <li key={`${f.properties.osm_type}${f.properties.osm_id}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => handlePick(f)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                      active ? "bg-brand-light" : "hover:bg-brand-light"
                    }`}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-mute" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-brand-ink">
                        {main}
                      </span>
                      {secondary ? (
                        <span className="block truncate text-[12px] text-brand-mute">
                          {secondary}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-card border border-brand-line">
        <div
          id={mapId}
          ref={mapElRef}
          className="h-64 w-full bg-brand-light"
          aria-label="Map — click to drop the location pin"
        />
      </div>

      {latitude == null || longitude == null ? (
        <p className="text-xs text-brand-mute">
          Start typing above and pick a suggestion — it fills the address fields
          below and drops the pin. You can also click the map to set it.
        </p>
      ) : (
        <p className="text-xs text-brand-mute">
          Pin at{" "}
          <span className="font-mono text-brand-ink">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
          . Search again, click the map, or drag the pin to move it.
        </p>
      )}
    </div>
  );
}
