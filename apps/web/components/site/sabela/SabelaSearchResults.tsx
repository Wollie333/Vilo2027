"use client";

import { useEffect, useMemo, useState } from "react";

import type { BookableProperty, BookingFunnelData } from "@/lib/site/types";

type Match = {
  property: BookableProperty;
  available: boolean;
  nights: number;
  total: number | null;
  currency: string;
  bookHref: string;
};

const STOCK = [
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=700&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=700&q=80",
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=700&q=80",
];

function money(total: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(total);
  } catch {
    return `${currency} ${total}`;
  }
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The Sabela search-results page (the design's `.sr-bar` + `.sr-list` /
 * `.sr-card`). Self-contained search (dates + guests, pre-filled from the URL)
 * that quotes EVERY bookable property in parallel via /api/website-quote
 * (server-recalculated price) and lists the matches. Inert in the builder
 * preview. Scoped to `.wielo-sabela`.
 */
export function SabelaSearchResults({
  data,
  interactive = false,
}: {
  data?: BookingFunnelData;
  interactive?: boolean;
}) {
  const properties = useMemo(() => data?.properties ?? [], [data]);
  const websiteId = data?.websiteId;

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState("");

  const live = interactive && Boolean(websiteId) && properties.length > 0;

  async function runSearch(ci = checkIn, co = checkOut, g = Number(guests)) {
    if (!live || !ci || !co || co <= ci) return;
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        properties.map(async (p) => {
          try {
            const res = await fetch("/api/website-quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                website_id: websiteId,
                property_id: p.id,
                check_in: ci,
                check_out: co,
                guests: g,
              }),
            });
            const json = (await res.json()) as
              | {
                  ok: true;
                  available: boolean;
                  nights: number;
                  total: number | null;
                  currency: string;
                }
              | { ok: false };
            if (!json.ok) return null;
            return {
              property: p,
              available: json.available,
              nights: json.nights,
              total: json.total,
              currency: json.currency,
              bookHref: `${p.bookBase}&from=${ci}&to=${co}&guests=${g}`,
            } satisfies Match;
          } catch {
            return null;
          }
        }),
      );
      setMatches(results.filter((m): m is Match => m !== null));
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const ci = q.get("from") ?? "";
    const co = q.get("to") ?? "";
    const g = Number(q.get("guests"));
    if (ci) setCheckIn(ci);
    if (co) setCheckOut(co);
    if (Number.isFinite(g) && g > 0) setGuests(String(g));
    if (live && ci && co && co > ci) {
      void runSearch(ci, co, Number.isFinite(g) && g > 0 ? g : 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const available = matches.filter((m) => m.available);

  return (
    <section className="section" data-section="search_results" data-live="true">
      <div className="wrap">
        <form
          className="sr-bar"
          style={{ marginBottom: "clamp(28px,4vw,44px)" }}
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <div className="bw-field" style={{ borderBottom: 0 }}>
            <label>Check in</label>
            <input
              type="date"
              min={todayIso()}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div className="bw-field" style={{ borderBottom: 0 }}>
            <label>Check out</label>
            <input
              type="date"
              min={checkIn || todayIso()}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
          <div className="bw-field" style={{ borderBottom: 0 }}>
            <label>Guests</label>
            <select value={guests} onChange={(e) => setGuests(e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={String(n)}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ borderRadius: 0, height: "auto", padding: "0 28px" }}
            disabled={!live || !checkIn || !checkOut || loading}
          >
            <span>{loading ? "Searching…" : "Search"}</span>
          </button>
        </form>

        {error ? (
          <p className="muted" style={{ textAlign: "center" }}>
            {error}
          </p>
        ) : !searched ? (
          <p className="muted" style={{ textAlign: "center" }}>
            {live
              ? "Enter your dates to see what's available."
              : "Live availability appears here on your published site."}
          </p>
        ) : available.length === 0 ? (
          <div className="sr-empty">
            <h2>No availability for those dates</h2>
            <p className="muted">Try different dates and search again.</p>
          </div>
        ) : (
          <div className="sr-list">
            {available.map((m, i) => (
              <article key={m.property.id} className="sr-card">
                <div className="sr-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={STOCK[i % STOCK.length]} alt={m.property.name} />
                </div>
                <div className="sr-b">
                  <h3>{m.property.name}</h3>
                  <div className="rr-meta" style={{ marginBottom: 12 }}>
                    <span className="chip">
                      Up to {m.property.maxGuests} guests
                    </span>
                    <span className="chip">
                      {m.nights} {m.nights === 1 ? "night" : "nights"}
                    </span>
                  </div>
                  <p
                    className="muted"
                    style={{
                      fontSize: "1rem",
                      lineHeight: 1.6,
                      maxWidth: "48ch",
                    }}
                  >
                    Book direct for the best rate — your final price is
                    confirmed at checkout.
                  </p>
                </div>
                <div className="sr-price">
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      from
                    </div>
                    <div className="price" style={{ fontSize: "1.5rem" }}>
                      {m.total != null ? money(m.total, m.currency) : "—"}
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: "12.5px", marginTop: 4 }}
                    >
                      {m.nights} {m.nights === 1 ? "night" : "nights"}
                    </div>
                  </div>
                  <a
                    href={m.bookHref}
                    data-wielo-book
                    className="btn btn-primary"
                  >
                    <span>Book</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
