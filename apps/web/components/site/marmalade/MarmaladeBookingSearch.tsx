"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { BookingFunnelData } from "@/lib/site/types";

import { ThemedDateRange } from "../ThemedDateRange";

const SEARCH_ICON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

/**
 * The Marmalade House availability bar (the design's `.availbar` under the hero).
 * Dates + guests → jumps to the live search-results page (multi-property) or the
 * property's checkout (single) with the chosen dates, where the price is quoted
 * server-side. In the builder/preview (`interactive=false`) it renders inert.
 * Markup matches the design (.availbar-in / .ab-field / .ab-go) scoped to
 * `.wielo-marmalade`.
 */
export function MarmaladeBookingSearch({
  data,
  interactive = false,
}: {
  data?: BookingFunnelData;
  interactive?: boolean;
}) {
  const properties = useMemo(() => data?.properties ?? [], [data]);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const maxGuests = properties[0]?.maxGuests ?? 6;
  const live = interactive && properties.length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!live) return;
    const qs = `from=${checkIn}&to=${checkOut}&guests=${guests}`;
    // Multi-property → the search-results page; single → straight to its checkout.
    if (data?.searchHref) {
      window.location.assign(
        `${data.searchHref}${data.searchHref.includes("?") ? "&" : "?"}${qs}`,
      );
      return;
    }
    const p = properties[0];
    if (p) window.location.assign(`${p.bookBase}&${qs}`);
  }

  // Nothing bookable yet — render nothing publicly (a hint only in the builder).
  if (properties.length === 0 && !interactive) return null;

  return (
    <section
      className="availbar"
      data-section="booking_search"
      data-live="true"
    >
      <div className="wrap">
        <form className="availbar-in" onSubmit={onSubmit}>
          <div className="ab-field ab-dates">
            <ThemedDateRange
              from={checkIn}
              to={checkOut}
              onChange={(f, t) => {
                setCheckIn(f);
                setCheckOut(t);
              }}
              accent="var(--site-accent)"
              ink="var(--site-ink)"
              mute="var(--site-mute)"
              line="var(--site-line)"
              surface="var(--site-surface)"
              radius="var(--site-radius-sm, var(--site-radius, 10px))"
              bare
            />
          </div>
          <div className="ab-field">
            <label>Guests</label>
            <select
              name="guests"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
            >
              {Array.from(
                { length: Math.max(1, maxGuests) },
                (_, i) => i + 1,
              ).map((n) => (
                <option key={n} value={String(n)}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
          </div>
          <div className="ab-go">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!live || !checkIn || !checkOut}
            >
              {SEARCH_ICON}
              <span>Check availability</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
