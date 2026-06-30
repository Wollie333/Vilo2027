"use client";

import { useState } from "react";

import { SiteLoadingOverlay } from "../SiteLoadingOverlay";

/** Thousands-spaced integer (no Intl — hydration-safe). 12500 → "12 500". */
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
 * The Marmalade House room booking card — the design's `.bkcard` (sticky right rail
 * on the room-detail page). Dates + guests → deep-links into the on-site
 * checkout where the price is recalculated server-side. Inert in the builder
 * preview. Scoped to `.wielo-marmalade`.
 */
export function MarmaladeBookingDock({
  price,
  currency,
  bookHref,
  maxGuests,
  interactive = true,
}: {
  price?: number | null;
  currency?: string | null;
  bookHref: string;
  maxGuests?: number | null;
  interactive?: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guests, setGuests] = useState(2);
  const [navigating, setNavigating] = useState(false);

  const ccy = currency ?? "ZAR";
  const sym = ccy === "ZAR" ? "R" : `${ccy} `;
  const rate = price != null ? `${sym}${groupThousands(price)}` : null;

  const nights = (() => {
    if (!from || !to) return 0;
    const a = Date.parse(`${from}T00:00:00`);
    const b = Date.parse(`${to}T00:00:00`);
    if (Number.isNaN(a) || Number.isNaN(b)) return 0;
    const n = Math.round((b - a) / 86_400_000);
    return n > 0 ? n : 0;
  })();
  const subtotal = nights > 0 && price != null ? nights * price : null;
  const guestMax = Math.min(30, Math.max(1, maxGuests ?? 8));
  const datesReady = Boolean(from && to && nights > 0);

  function book() {
    if (!interactive || !datesReady) return;
    const p = new URLSearchParams();
    p.set("from", from);
    p.set("to", to);
    p.set("guests", String(guests));
    setNavigating(true);
    window.location.href = `${bookHref}${bookHref.includes("?") ? "&" : "?"}${p.toString()}`;
  }

  return (
    <aside className="bkcard" data-section="room_rate" data-live="true">
      <SiteLoadingOverlay
        show={navigating}
        message="Opening your booking…"
        sub="Taking you to checkout."
      />
      <div className="bkrate">
        {rate ? (
          <>
            <span className="amt">{rate}</span>
            <span className="muted"> / night</span>
          </>
        ) : (
          <span className="amt">Enquire</span>
        )}
      </div>
      <div className="bkgrid">
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Check in</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={!interactive}
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Check out</label>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            disabled={!interactive}
          />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Guests</label>
        <select
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          disabled={!interactive}
        >
          {Array.from({ length: guestMax }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </div>
      {nights > 0 && rate ? (
        <>
          <div
            className="sline"
            style={{
              borderTop: "1px solid var(--site-line)",
              paddingTop: 14,
            }}
          >
            <span>
              {rate} × {nights} {nights === 1 ? "night" : "nights"}
            </span>
            <b>
              {sym}
              {groupThousands(subtotal ?? 0)}
            </b>
          </div>
          <div className="stotal" style={{ marginTop: 2 }}>
            <span className="l">Total</span>
            <span className="amt" data-total>
              {sym}
              {groupThousands(subtotal ?? 0)}
            </span>
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={book}
        disabled={!datesReady}
        className="btn btn-coral btn-block btn-lg"
        style={{ marginTop: 16, ...(datesReady ? {} : { opacity: 0.6 }) }}
      >
        <span>{datesReady ? "Continue to book" : "Select your dates"}</span>
      </button>
      <div className="nofee" style={{ justifyContent: "center" }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Book direct · 0% booking fees
      </div>
    </aside>
  );
}
