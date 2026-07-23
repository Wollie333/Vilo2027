"use client";

import { useState } from "react";
import { Loader2, MapPin, RefreshCw } from "lucide-react";

import { refreshNearbyExperiencesAction } from "../../actions";
import type { NearbyPlace } from "@/lib/site/nearby";

/**
 * "Nearby experiences" curation card (website Overview). One click fetches real
 * places near the property from OpenStreetMap (free — no API key) and caches them
 * into the site's content profile, where the Experiences page renders them. The
 * host reviews the list here; nothing is auto-published silently. Re-fetch any
 * time (e.g. after moving the listing or fixing its address).
 */
export function NearbyExperiencesCard({ websiteId }: { websiteId: string }) {
  const [busy, setBusy] = useState(false);
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ERROR_MSG: Record<string, string> = {
    no_property:
      "Add a property (listing) first — that's where we look around.",
    none_found:
      "No taggable places found near this listing yet. Check the listing's address or map pin, then try again.",
    service_unavailable:
      "The places service (OpenStreetMap) is busy right now — this isn't about your listing. Give it a minute and try again.",
    not_found: "Couldn't find this website.",
    save_failed: "Couldn't save the places just now. Please try again.",
    locked: "The website builder isn't enabled on your plan yet.",
  };

  async function run() {
    setBusy(true);
    setError(null);
    const res = await refreshNearbyExperiencesAction(websiteId);
    setBusy(false);
    if (res.ok) {
      setPlaces(res.places);
    } else {
      setError(
        ERROR_MSG[res.error] ?? "Couldn't fetch nearby places just now.",
      );
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
            <MapPin className="h-4.5 w-4.5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-brand-ink">
              Nearby experiences
            </h3>
            <p className="mt-0.5 max-w-md text-[13px] leading-snug text-brand-mute">
              Pull real places around your listing — food, nature, viewpoints
              and things to do, with accurate distances — onto your Experiences
              page. Sourced from OpenStreetMap; review them below before you
              publish.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : places ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          {busy ? "Finding…" : places ? "Refresh" : "Find nearby places"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] leading-snug text-amber-800">
          {error}
        </p>
      ) : null}

      {places ? (
        places.length ? (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold text-brand-mute">
              {places.length} place{places.length === 1 ? "" : "s"} saved — live
              on your Experiences page:
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {places.map((p, i) => (
                <li
                  key={`${p.name}-${i}`}
                  className="rounded-full border border-brand-line bg-white px-2.5 py-1 text-[12px] text-brand-ink"
                  title={`${p.category} · ${p.distance}`}
                >
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-brand-mute">
            No places found nearby.
          </p>
        )
      ) : null}
    </section>
  );
}
