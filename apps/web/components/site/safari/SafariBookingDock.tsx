"use client";

import { useState } from "react";

import { SiteLoadingOverlay } from "../SiteLoadingOverlay";
import { ThemedDateRange } from "../ThemedDateRange";

/** Thousands-spaced integer (no Intl — hydration-safe). 14500 → "14 500". */
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
 * The Safari room booking card — the design's `.bk-card` (sticky right rail of
 * the room-detail `.room-layout`). Dates + guests → deep-links into the on-site
 * checkout where the price is recalculated server-side. Inert in the builder
 * preview. Scoped to `.wielo-safari`.
 */
export function SafariBookingDock({
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
    <aside className="bk-card" data-section="room_rate" data-live="true">
      <SiteLoadingOverlay
        show={navigating}
        message="Opening your booking…"
        sub="Taking you to checkout."
      />
      <div className="bk-rate">
        {rate ? (
          <>
            <span
              className="display"
              style={{ fontSize: "2rem", color: "var(--gold)" }}
            >
              {rate}
            </span>
            <span className="muted" style={{ fontSize: 14 }}>
              {" "}
              / night
            </span>
          </>
        ) : (
          <span className="display" style={{ fontSize: "1.8rem" }}>
            Enquire
          </span>
        )}
      </div>
      <div className="bk-grid" style={{ display: "block" }}>
        <ThemedDateRange
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          accent="var(--site-accent, var(--accent))"
          ink="var(--site-ink, var(--ink))"
          mute="var(--site-mute, var(--ink-soft))"
          line="var(--site-line, var(--line))"
          surface="var(--site-surface, var(--bg-2, #fff))"
          radius="var(--site-radius-sm, var(--site-radius, 8px))"
        />
      </div>
      <div className="field">
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "14px 0",
            borderTop: "1px solid var(--line)",
            marginBottom: 6,
          }}
        >
          <span className="muted">
            {nights} {nights === 1 ? "night" : "nights"}
          </span>
          <b>
            {sym}
            {groupThousands(subtotal ?? 0)}
          </b>
        </div>
      ) : null}
      <button
        type="button"
        onClick={book}
        disabled={!datesReady}
        className="btn btn-primary btn-lg"
        style={{
          width: "100%",
          justifyContent: "center",
          ...(datesReady ? {} : { opacity: 0.6 }),
        }}
      >
        <span>{datesReady ? "Continue to book" : "Select your dates"}</span>
      </button>
      <p
        className="muted"
        style={{ fontSize: 12.5, marginTop: 12, textAlign: "center" }}
      >
        Book direct · your final price is confirmed at checkout.
      </p>
    </aside>
  );
}
