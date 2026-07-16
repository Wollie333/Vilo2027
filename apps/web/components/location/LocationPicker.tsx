"use client";

import "leaflet/dist/leaflet.css";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

// Address picker backed by Google (Places Autocomplete + Geocoding) through our
// own /api/geo server proxy — the API key stays server-side. The interactive map
// is Leaflet on OSM tiles (free, no token). Three ways to set the pin:
//   1. Type an address → Google suggestions appear → pick one (fills every field).
//   2. Click the map → drops the pin and reverse-geocodes the address.
//   3. Drag the pin → same as a click at the new spot.
// latitude/longitude flow up via onSelect so "Suggest nearby places" has
// coordinates to work with.

// Only lat/lng are guaranteed; a result may omit some address parts, so the rest
// are optional and the parent only overwrites a field when present.
export type LocationSelection = {
  latitude: number;
  longitude: number;
  address_line1?: string;
  city?: string;
  municipality?: string;
  province?: string;
  postal_code?: string;
};

type Suggestion = { placeId: string; main: string; secondary: string };
type GeoAddress = Partial<LocationSelection>;

// Inline SVG pin as a Leaflet divIcon — avoids Leaflet's broken default marker
// image assets (they 404 under bundlers) and keeps the map asset-free.
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
  radiusKm,
}: {
  latitude: number | null;
  longitude: number | null;
  onSelect: (s: LocationSelection) => void;
  // When set (and a pin exists), draws a search-radius circle around the pin.
  // Undefined/null = no circle (the default for address-only consumers).
  radiusKm?: number | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  // Flips true once Leaflet has loaded and the map exists. Included in the
  // marker/circle effect deps so they re-run after the async map init (a ref
  // mutation alone wouldn't re-trigger them, so the circle never drew on load).
  const [mapReady, setMapReady] = useState(false);
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
  const circleRef = useRef<import("leaflet").Circle | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const coordsRef = useRef({ lat: latitude, lng: longitude });
  coordsRef.current = { lat: latitude, lng: longitude };
  // Set when the next coord change should fly the map to it (a search pick), as
  // opposed to a local map click/drag where the view should stay put.
  const recenterRef = useRef(false);
  const mapId = useId();

  function emit(addr: GeoAddress, lat: number, lng: number) {
    onSelect({ ...addr, latitude: lat, longitude: lng });
  }

  // Reverse-geocode a clicked/dragged point, then push it up. Coords always flow
  // up even if the lookup fails, so the map stays the source of truth.
  async function emitFromPoint(lat: number, lng: number) {
    onSelect({ latitude: lat, longitude: lng });
    try {
      const res = await fetch(`/api/geo?op=reverse&lat=${lat}&lng=${lng}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { address?: GeoAddress };
      if (data.address) emit(data.address, lat, lng);
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

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        void emitFromPoint(e.latlng.lat, e.latlng.lng);
      });

      // Signal readiness so the marker/circle effects run against the live map.
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
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
    if (recenterRef.current) {
      map.setView(pos, Math.max(map.getZoom(), 16));
      recenterRef.current = false;
    } else if (!map.getBounds().contains(pos)) {
      map.setView(pos, Math.max(map.getZoom(), 14));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, mapReady]);

  // ── Draw / update the search-radius circle when radius or coords change. ──
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const km = radiusKm ?? 0;
    const hasPin = latitude != null && longitude != null;
    if (!hasPin || km <= 0) {
      circleRef.current?.remove();
      circleRef.current = null;
      return;
    }
    const center: [number, number] = [latitude, longitude];
    const meters = km * 1000;
    if (circleRef.current) {
      circleRef.current.setLatLng(center);
      circleRef.current.setRadius(meters);
    } else {
      circleRef.current = L.circle(center, {
        radius: meters,
        color: "#10B981",
        weight: 1.5,
        fillColor: "#10B981",
        fillOpacity: 0.12,
      }).addTo(map);
    }
    // Fit the map to the circle so the whole radius is visible.
    map.fitBounds(circleRef.current.getBounds(), { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, latitude, longitude, mapReady]);

  // ── Debounced type-ahead (Google Places via /api/geo) — 220ms after a key. ──
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
        const res = await fetch(
          `/api/geo?op=autocomplete&q=${encodeURIComponent(query.trim())}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        if (!res.ok) throw new Error(`geo ${res.status}`);
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        const list = data.suggestions ?? [];
        setResults(list);
        setActiveIdx(-1);
        setShowResults(list.length > 0);
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

  async function handlePick(s: Suggestion) {
    justPickedRef.current = true; // don't re-search the text we set below
    setQuery([s.main, s.secondary].filter(Boolean).join(", "));
    setResults([]);
    setShowResults(false);
    setActiveIdx(-1);
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/geo?op=place&id=${encodeURIComponent(s.placeId)}`,
        {
          headers: { Accept: "application/json" },
        },
      );
      const data = (await res.json()) as { address?: GeoAddress };
      const a = data.address ?? {};
      if (a.latitude != null && a.longitude != null) {
        recenterRef.current = true; // fly the map to the chosen place
        emit(a, a.latitude, a.longitude);
      }
    } catch {
      // Leave the typed text; the host can click the map to set a pin.
    } finally {
      setIsSearching(false);
    }
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
      void handlePick(results[activeIdx]);
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
            // z above Leaflet's panes/controls (z-index up to 1000), or the
            // suggestions render hidden behind the map.
            className="absolute left-0 right-0 top-full z-[1100] mt-1 max-h-72 overflow-y-auto rounded border border-brand-line bg-white py-1 shadow-lift"
          >
            {results.map((s, i) => {
              const active = i === activeIdx;
              return (
                <li key={`${s.placeId}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => void handlePick(s)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                      active ? "bg-brand-light" : "hover:bg-brand-light"
                    }`}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-mute" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-brand-ink">
                        {s.main}
                      </span>
                      {s.secondary ? (
                        <span className="block truncate text-xs text-brand-mute">
                          {s.secondary}
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
