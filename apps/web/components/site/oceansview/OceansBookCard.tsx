"use client";

import { useState } from "react";

import { SiteLoadingOverlay } from "../SiteLoadingOverlay";
import { ThemedDateRange } from "../ThemedDateRange";

/** Thousands-space an integer WITHOUT Intl (SSR/client hydration-safe). */
function groupThousands(n: number): string {
  const s = String(Math.round(n));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += " ";
    out += s[i];
  }
  return out;
}

/**
 * Oceans View sticky booking card — the reference `.bkcard`: trust line, big
 * rate, check-in/out + guests, a live subtotal, and a coral "Reserve" that
 * deep-links to the on-site checkout (price re-confirmed server-side). Same
 * booking contract as RoomBookingDock; bespoke markup for the Oceans design.
 */
export function OceansBookCard({
  price,
  currency,
  bookHref,
  maxGuests,
  ratingLabel,
}: {
  price?: number | null;
  currency?: string | null;
  bookHref: string;
  maxGuests?: number | null;
  /** e.g. "4.9 · 410 verified stays" — shown above the rate when available. */
  ratingLabel?: string | null;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guests, setGuests] = useState(2);
  const [navigating, setNavigating] = useState(false);

  const ccy = currency ?? "ZAR";
  const sym = ccy === "ZAR" ? "R" : `${ccy} `;
  const rate = price ?? null;
  const rateLabel = rate != null ? `${sym}${groupThousands(rate)}` : null;

  const nights = (() => {
    if (!from || !to) return 0;
    const a = Date.parse(`${from}T00:00:00`);
    const b = Date.parse(`${to}T00:00:00`);
    if (Number.isNaN(a) || Number.isNaN(b)) return 0;
    const n = Math.round((b - a) / 86400000);
    return n > 0 ? n : 0;
  })();
  const subtotal = nights > 0 && rate != null ? nights * rate : null;
  const guestMax = Math.min(30, Math.max(1, maxGuests ?? 8));
  const datesReady = Boolean(from && to && nights > 0);

  function reserve() {
    if (!datesReady) return;
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    params.set("guests", String(guests));
    const sep = bookHref.includes("?") ? "&" : "?";
    setNavigating(true);
    window.location.href = `${bookHref}${sep}${params.toString()}`;
  }

  return (
    <div className="bkcard">
      <SiteLoadingOverlay
        show={navigating}
        message="Opening your booking…"
        sub="Taking you to checkout."
      />
      {ratingLabel ? (
        <div className="bktrust">
          <span className="stars">★★★★★</span> {ratingLabel}
        </div>
      ) : null}

      {rateLabel ? (
        <div className="bkrate">
          <span className="amt">{rateLabel}</span>
          <span className="muted">/ night</span>
        </div>
      ) : null}

      {/* Bespoke themed calendar (a portaled popover, NOT the browser's native
          date modal) so the picker matches the design and can't be clipped. */}
      <div className="field">
        <label>Your dates</label>
        <ThemedDateRange
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          accent="var(--site-accent, #12a5b5)"
          ink="var(--site-ink, #0e2c3a)"
          mute="var(--site-mute, #5e7884)"
          line="var(--site-line, #e9e1d1)"
          surface="var(--site-surface, #ffffff)"
          radius="var(--site-radius-sm, 11px)"
        />
      </div>
      <div className="field">
        <label>Guests</label>
        <select
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
        >
          {Array.from({ length: guestMax }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </div>

      {subtotal != null ? (
        <>
          <div
            className="sline"
            style={{ borderTop: "1px solid var(--site-line)", paddingTop: 14 }}
          >
            <span>
              {rateLabel} × {nights} night{nights === 1 ? "" : "s"}
            </span>
            <b>
              {sym}
              {groupThousands(subtotal)}
            </b>
          </div>
          <div className="sline">
            <span>Taxes &amp; service</span>
            <b>Included</b>
          </div>
          <div className="stotal" style={{ marginTop: 2 }}>
            <span className="l">Total</span>
            <span className="amt">
              {sym}
              {groupThousands(subtotal)}
            </span>
          </div>
        </>
      ) : null}

      <div className="nofee">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>No booking fees, ever</span>
      </div>

      <button
        type="button"
        className="btn btn-coral btn-lg btn-block"
        onClick={reserve}
        disabled={!datesReady}
        style={{
          marginTop: 20,
          ...(datesReady ? {} : { opacity: 0.55, cursor: "default" }),
        }}
      >
        {datesReady ? "Reserve this room" : "Select your dates"}
      </button>
      <p className="muted center" style={{ fontSize: 12.5, marginTop: 12 }}>
        You won&apos;t be charged yet — review your stay on the next step.
      </p>
    </div>
  );
}
