"use client";

import { useState } from "react";

/**
 * Sticky per-room booking form — a compact card that floats on the right of the
 * room-detail page (desktop) or docks to the bottom (mobile), always visible as
 * the guest scrolls. Collects dates + guests and deep-links to the on-site
 * checkout (`bookHref` + the chosen params), where the price is recalculated
 * server-side. Theme-agnostic: reads `--site-*` with `--accent/--ink` fallbacks
 * so it's on-theme on both the generic themes and the Safari design.
 */
export function RoomBookingDock({
  roomName,
  price,
  currency,
  bookHref,
  interactive = true,
}: {
  roomName: string;
  price?: number | null;
  currency?: string | null;
  bookHref: string;
  /** False in the builder canvas — the form is shown but inert. */
  interactive?: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guests, setGuests] = useState(2);

  const priceLabel =
    price != null
      ? new Intl.NumberFormat("en-ZA", {
          style: "currency",
          currency: currency ?? "ZAR",
          maximumFractionDigits: 0,
        }).format(price)
      : null;

  function book() {
    if (!interactive) return;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
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
        .room-book-dock{position:fixed;top:96px;right:20px;width:300px;z-index:40;}
        .room-book-dock .rbd-card{border:1px solid ${line};border-radius:${radius};background:${surface};padding:18px;box-shadow:0 18px 40px -28px rgba(6,40,28,.45);}
        .room-book-dock .rbd-row{display:flex;gap:8px;}
        .room-book-dock .rbd-row>div{flex:1;}
        .room-book-dock label{display:block;font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:${mute};margin:0 0 4px;}
        .room-book-dock .rbd-btn{width:100%;margin-top:12px;padding:12px;border:none;border-radius:9px;background:${accent};color:#fff;font-weight:700;font-size:14px;cursor:pointer;}
        .room-book-dock .rbd-btn:hover{filter:brightness(1.05);}
        @media (max-width:980px){
          .room-book-dock{position:fixed;left:0;right:0;bottom:0;top:auto;width:auto;z-index:50;}
          .room-book-dock .rbd-card{border-radius:14px 14px 0 0;display:flex;align-items:center;gap:14px;}
          .room-book-dock .rbd-fields{display:none;}
          .room-book-dock .rbd-btn{margin-top:0;width:auto;flex-shrink:0;padding:12px 22px;}
          .room-book-dock .rbd-price{flex:1;}
        }
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
          <div className="rbd-row">
            <div>
              <label>Check-in</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={fieldStyle}
                disabled={!interactive}
              />
            </div>
            <div>
              <label>Check-out</label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                style={fieldStyle}
                disabled={!interactive}
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label>Guests</label>
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              style={fieldStyle}
              disabled={!interactive}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="rbd-btn" onClick={book}>
          Book this room
        </button>
      </div>
    </aside>
  );
}
