import "./safariRooms.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";
import type { GalleryImage, RoomCard } from "@/lib/site/types";

// ── helpers (server-rendered) ────────────────────────────────────────────────
function commas(n: number): string {
  const s = String(Math.round(n));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return out;
}
function money(n?: number | null, currency?: string | null): string | null {
  if (n == null) return null;
  const ccy = currency ?? "ZAR";
  const sym = ccy === "ZAR" ? "R" : `${ccy} `;
  return `${sym}${commas(n)}`;
}
function pad2(n: number): string {
  return String(n + 1).padStart(2, "0");
}

const Arrow = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// Direct-booking truths — brand-agnostic, always true for a Wielo host.
const INCLUDED = [
  "Book direct with the lodge",
  "The price you see is the price you pay",
  "Secure payment",
];

/**
 * Safari (NenGama Lodge) ROOMS page (preset `safari`) — its own component +
 * stylesheet (`.sfrooms` / safariRooms.css). An editorial "collection" GRID
 * (deliberately different from the home page's full-bleed story bands AND from
 * the OceansView alternating splits): a full-bleed left-aligned page head, a
 * ruled "included" row, then each live room as a tall editorial card with an
 * index numeral, a floating rate badge and hover-zoom imagery. Wired to the
 * host's LIVE rooms (`rooms_preview`); demo placeholder when empty. Renders
 * inside the shared themed chrome. Phase B (theme differentiation).
 */
export function SafariRooms({
  brandName,
  bookHref,
  contactHref = "/contact",
  subheadline,
  heroImageUrl,
  rooms,
  gallery,
}: {
  brandName: string;
  bookHref: string;
  contactHref?: string;
  subheadline?: string | null;
  heroImageUrl?: string | null;
  rooms?: RoomCard[] | null;
  gallery?: GalleryImage[] | null;
}) {
  const shots = (gallery ?? []).filter((g) => g.url);
  const list = (rooms ?? []).filter((r) => r.name);
  const headImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=2400&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?w=2000&q=80";

  const sub =
    subheadline?.trim() ||
    "A handful of rooms, each open to the light and the plain beyond. Choose your view — a breezy room, a tent under the trees, or the quiet suite at the end of the deck.";

  return (
    <div className="sfrooms">
      {/* PAGE HEAD */}
      <section className="sf-phead">
        <div className="sf-phead-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(headImg, { width: 2400 })}
            alt={`Rooms at ${brandName}`}
          />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-phead-in">
          <div className="sf-coverline on-photo">
            <span>{brandName}</span>
            <span className="sf-folio">The Field Journal · The Rooms</span>
          </div>
          <nav className="sf-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <span>Rooms</span>
          </nav>
          <h1>Rooms &amp; tents</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* INCLUDED — ruled editorial row */}
      <section className="sf-included-sec">
        <div className="wrap">
          <div className="sf-included">
            {INCLUDED.map((c, i) => (
              <div className="sf-inc" key={i}>
                <span aria-hidden>{pad2(i)}</span>
                <b>{c}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROOMS — editorial collection grid */}
      {list.length === 0 ? (
        <section className="sf-sec">
          <div className="wrap">
            <div className="sf-empty">
              <h2>Your rooms will appear here</h2>
              <p>
                Add rooms to {brandName} and they&apos;ll show up here
                automatically — each with its own photos, rate and booking link.
              </p>
              <a href={bookHref} className="sf-btn sf-btn-solid sf-btn-lg">
                Check availability
              </a>
            </div>
          </div>
        </section>
      ) : (
        <section className="sf-sec">
          <div className="wrap">
            <div className="sf-grid">
              {list.map((r, i) => {
                const price = money(r.price, r.currency);
                const facts = (r.facts ?? []).filter(Boolean).slice(0, 3);
                const badge = r.badge?.trim();
                const img =
                  r.imageUrl ||
                  shots[i]?.url ||
                  "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80";
                return (
                  <article
                    className="sf-card"
                    key={r.id}
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 2) * 90}ms` } as CSSProperties
                    }
                  >
                    <a
                      href={r.detailHref || r.bookHref}
                      className="sf-card-fig"
                      aria-label={r.name}
                    >
                      <span className="sf-card-idx" aria-hidden>
                        {pad2(i)}
                      </span>
                      {badge ? (
                        <span className="sf-card-badge">{badge}</span>
                      ) : null}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={siteImageUrl(img, { width: 1000 })}
                        alt={r.name}
                        loading="lazy"
                        decoding="async"
                      />
                      {price ? (
                        <span className="sf-card-price">
                          <small>from</small>
                          {price}
                          <em>/ night</em>
                        </span>
                      ) : null}
                    </a>
                    <div className="sf-card-body">
                      <h2>{r.name}</h2>
                      {facts.length ? (
                        <div className="sf-card-facts">
                          {facts.map((f, j) => (
                            <span key={j}>{f}</span>
                          ))}
                        </div>
                      ) : null}
                      {r.description ? <p>{r.description}</p> : null}
                      <div className="sf-card-cta">
                        {r.detailHref ? (
                          <a href={r.detailHref} className="sf-alink">
                            View room {Arrow}
                          </a>
                        ) : (
                          <span />
                        )}
                        <a
                          href={r.bookHref}
                          data-wielo-book
                          className="sf-btn sf-btn-solid"
                        >
                          {price ? `Book · ${price}` : "Book now"}
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="sf-cta">
        <div className="sf-cta-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(ctaImg, { width: 2000 })}
            alt={brandName}
            loading="lazy"
            decoding="async"
          />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-cta-in" data-reveal>
          <span className="sf-eyebrow on-dark">Not sure which room?</span>
          <h2>Tell us who&apos;s coming</h2>
          <p>
            Let us know your dates and party and we&apos;ll suggest the right
            fit — then hold it for you while you decide.
          </p>
          <div className="sf-cta-row">
            <a href={contactHref} className="sf-btn sf-btn-solid sf-btn-lg">
              Ask the lodge
            </a>
            <a href={bookHref} className="sf-btn sf-btn-line sf-btn-lg">
              Check availability {Arrow}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
