"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";

/**
 * Keyless OpenStreetMap (Leaflet) map centred on the listing's approximate
 * location. Shows a privacy circle rather than an exact pin — the precise
 * address is only shared after booking. Leaflet is imported lazily inside the
 * effect so it never touches the server bundle.
 */
export function LocationMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      map = L.map(ref.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView([lat, lng], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      L.circle([lat, lng], {
        radius: 750,
        color: "#10B981",
        weight: 2,
        fillColor: "#10B981",
        fillOpacity: 0.15,
      }).addTo(map);
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [lat, lng]);

  return <div ref={ref} className="h-full w-full" aria-label="Map" />;
}
