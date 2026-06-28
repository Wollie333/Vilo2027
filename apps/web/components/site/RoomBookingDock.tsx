"use client";

import { useState } from "react";

import { ThemedDateRange } from "./ThemedDateRange";

/**
 * Sticky per-room booking form — a compact card that floats on the right of the
 * room-detail page (desktop) or docks to the bottom (mobile), always visible as
 * the guest scrolls. Collects dates + guests and deep-links to the on-site
 * checkout (`bookHref` + the chosen params), where the price is recalculated
 * server-side. Theme-agnostic: reads `--site-*` with `--accent/--ink` fallbacks
 * so it's on-theme on both the generic themes and the Safari design.
 */
/** Group an integer's digits in threes with spaces (no regex/Intl — SWC-safe and
 *  deterministic across SSR + client). e.g. 1300 → "1 300". */
function groupThousands(n: number): string {
  const s = String(Math.round(n));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += " ";
    out += s[i];
  }
  return out;
}

export function RoomBookingDock({
  roomName,
  price,
  currency,
  bookHref,
  maxGuests,
  interactive = true,
}: {
  roomName: string;
  price?: number | null;
  currency?: string | null;
  bookHref: string;
  /** Caps the guest selector so a guest can't pick more than the room sleeps. */
  maxGuests?: number | null;
  /** False in the builder canvas — the form is shown but inert. */
  interactive?: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guests, setGuests] = useState(2);

  // Deterministic price format (NO Intl): Intl currency formatting differs between
  // the Node SSR and the browser (ICU version + the space/grouping chars it emits),
  // which trips a hydration mismatch in this client component. Plain thousands-
  // spaced text renders identically on both.
  const ccy = currency ?? "ZAR";
  const priceLabel =
    price != null
      ? `${ccy === "ZAR" ? "R" : ccy} ${groupThousands(price)}`
      : null;

  // Selected stay length + an estimated subtotal (nights × nightly). Final price
  // — incl. fees — is confirmed on the checkout. Hydration-safe: both dates start
  // empty so the summary is absent on the server render too.
  const nights = (() => {
    if (!from || !to) return 0;
    const a = Date.parse(`${from}T00:00:00`);
    const b = Date.parse(`${to}T00:00:00`);
    if (Number.isNaN(a) || Number.isNaN(b)) return 0;
    const n = Math.round((b - a) / 86400000);
    return n > 0 ? n : 0;
  })();
  const stayLabel =
    nights > 0 && price != null
      ? `${ccy === "ZAR" ? "R" : ccy} ${groupThousands(nights * price)}`
      : null;

  // Cap the guest selector at what the room sleeps (falls back to 8).
  const guestMax = Math.min(30, Math.max(1, maxGuests ?? 8));
  const datesReady = Boolean(from && to && nights > 0);

  function book() {
    // Require dates so the checkout never lands empty (it can't price without them).
    if (!interactive || !datesReady) return;
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    params.set("guests", String(guests));
    const sep = bookHref.includes("?") ? "&" : "?";
    window.location.href = `${bookHref}${sep}${params.toString()}`;
  }

  const ink = "var(--site-ink, var(--ink, #16241d))";
  const mute = "var(--site-mute, var(--ink-soft, #6b7a72))";
  const line = "var(--site-line, var(--line, #e3e8e5))";
  const surface = "var(--site-surface, var(--bg-2, #fff))";
  const accent = "var(--site-accent, var(--accent, #0a7d4b))";
  const radius = "var(--site-radius, 12px)";

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 11px",
    border: `1px solid ${line}`,
    borderRadius: 8,
    fontSize: 13,
    color: ink,
    background: "#fff",
    fontFamily: "inherit",
  };

  return (
    <aside className="room-book-dock" aria-label="Book this room">
      <style>{`
        .room-book-dock{width:100%;}
        .room-book-dock .rbd-card{border:1px solid ${line};border-radius:${radius};background:${surface};padding:18px;box-shadow:0 18px 40px -28px rgba(6,40,28,.45);}
        .room-book-dock .rbd-row{display:flex;gap:8px;}
        .room-book-dock .rbd-col{flex:1;}
        .room-book-dock label{display:block;font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:${mute};margin:0 0 4px;}
        .room-book-dock .rbd-btn{width:100%;margin-top:12px;padding:12px;border:none;border-radius:9px;background:${accent};color:#fff;font-weight:700;font-size:14px;cursor:pointer;}
        .room-book-dock .rbd-btn:hover{filter:brightness(1.05);}
      `}</style>
      <div className="rbd-card">
        <div className="rbd-price" style={{ marginBottom: 12 }}>
          {priceLabel ? (
            <div style={{ color: ink, fontWeight: 700, fontSize: 18 }}>
              {priceLabel}
              <span style={{ color: mute, fontWeight: 400, fontSize: 13 }}>
                {" "}
                / night
              </span>
            </div>
          ) : (
            <div style={{ color: ink, fontWeight: 700, fontSize: 16 }}>
              {roomName}
            </div>
          )}
        </div>
        <div className="rbd-fields">
          <ThemedDateRange
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
            }}
            accent={accent}
            ink={ink}
            mute={mute}
            line={line}
            surface={surface}
            radius={radius}
          />
          <div style={{ marginTop: 10 }}>
            <label>Guests</label>
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              style={fieldStyle}
              disabled={!interactive}
            >
              {Array.from({ length: guestMax }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
          </div>
        </div>
        {nights > 0 ? (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${line}`,
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              fontSize: 14,
            }}
          >
            <span style={{ color: mute }}>
              {nights} {nights === 1 ? "night" : "nights"}
            </span>
            {stayLabel ? (
              <span style={{ color: ink, fontWeight: 700 }}>{stayLabel}</span>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className="rbd-btn"
          onClick={book}
          disabled={!datesReady}
          style={datesReady ? undefined : { opacity: 0.55, cursor: "default" }}
        >
          {datesReady ? "Book this room" : "Select your dates"}
        </button>
      </div>
    </aside>
  );
}
