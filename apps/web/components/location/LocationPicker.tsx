"use client";

import "leaflet/dist/leaflet.css";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

// Keyless OpenStreetMap location picker — no API token, no paid service.
// Search uses the free Nominatim geocoder; the interactive map is Leaflet on
// OSM tiles (already a repo dependency, see app/listing/[slug]/LocationMap).
// Two ways to set the pin:
//   1. Search an address → pick a result (fills the address fields too).
//   2. Click or drag on the map → drops the pin and reverse-geocodes it.
// Either way the latitude/longitude flow back to the parent via onSelect so
// the "Suggest nearby places" feature has coordinates to work with.

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

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
};

// Nominatim returns SA provinces under `state` already matching our labels.
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

const NOMINATIM = "https://nominatim.openstreetmap.org";

function flatten(r: NominatimResult): LocationSelection {
  const a = r.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ").trim();
  const province = a.state && SA_PROVINCES.has(a.state) ? a.state : undefined;
  return {
    latitude: Number(r.lat),
    longitude: Number(r.lon),
    address_line1: street || a.neighbourhood || a.suburb || undefined,
    city:
      a.city || a.town || a.village || a.municipality || a.suburb || undefined,
    province,
    postal_code: a.postcode || undefined,
  };
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
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  // Latest props for the one-time init effect, without re-running it.
  const coordsRef = useRef({ lat: latitude, lng: longitude });
  coordsRef.current = { lat: latitude, lng: longitude };
  const mapId = useId();

  // Reverse-geocode a clicked/dragged point, then push it up. Coords always
  // flow up even if the lookup fails, so the map stays the source of truth.
  async function emitFromPoint(lat: number, lng: number) {
    onSelect({ latitude: lat, longitude: lng });
    try {
      const url = new URL(`${NOMINATIM}/reverse`);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as NominatimResult;
      if (data?.address) onSelect(flatten(data));
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
      }).setView(hasPin ? [lat, lng] : [-29, 24.5], hasPin ? 14 : 5);
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
    map.setView(pos, Math.max(map.getZoom(), 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  // ── Debounced address search (Nominatim) — fires 500ms after typing stops. ──
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
        const url = new URL(`${NOMINATIM}/search`);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("limit", "5");
        url.searchParams.set("countrycodes", "za");
        url.searchParams.set("q", query.trim());
        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const data = (await res.json()) as NominatimResult[];
        setResults(Array.isArray(data) ? data : []);
        setShowResults(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [query]);

  function handlePick(r: NominatimResult) {
    onSelect(flatten(r));
    setQuery(r.display_name);
    setShowResults(false);
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
              <li key={r.place_id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(r)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-brand-ink transition-colors hover:bg-brand-light"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-mute" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              </li>
            ))}
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
          Search an address above, or click the map to drop the pin — either
          fills the fields below and sets the coordinates.
        </p>
      ) : (
        <p className="text-xs text-brand-mute">
          Pin at{" "}
          <span className="font-mono text-brand-ink">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
          . Click the map or drag the pin to move it, or edit the fields below
          to fine-tune.
        </p>
      )}
    </div>
  );
}
