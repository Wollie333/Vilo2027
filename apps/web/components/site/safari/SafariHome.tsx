import "./safariHome.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";
import type {
  GalleryImage,
  ReviewsData,
  RoomCard,
  BookingFunnelData,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { BookingSearchSection } from "../sections/BookingSearchSection";

type BookingSearchProps = Extract<
  WebsiteSection,
  { type: "booking_search" }
>["props"];

// ── helpers (server-rendered — Intl-free, deterministic) ─────────────────────
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
function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "—";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
/** "02" from index 1 — editorial two-digit index numerals. */
function pad2(n: number): string {
  return String(n + 1).padStart(2, "0");
}
/**
 * Split off the first sentence (keeping its terminal punctuation) so the welcome
 * heading reads as a clean statement and the rest flows into the lead paragraph.
 * Falls back to the whole string as the head when there's no sentence break.
 */
function firstSentence(text: string): { head: string; rest: string } {
  const m = text.match(/^(.+?[.!?])\s+(.*)$/s);
  if (m) return { head: m[1].trim(), rest: m[2].trim() };
  return { head: text.trim(), rest: "" };
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

// The direct-booking promise — always-true guarantees (never host-specific
// claims), shown as an editorial ruled row rather than a card grid.
const PROMISE: { k: string; v: string }[] = [
  { k: "Direct", v: "Book straight with the lodge — a real person answers." },
  {
    k: "Best rate",
    v: "The lowest price lives here. Never cheaper elsewhere.",
  },
  { k: "No fees", v: "Pay exactly what you see. No agents, no surcharges." },
  { k: "Flexible", v: "Free cancellation up to 48 hours before you arrive." },
];

export type SafariHomeExperience = {
  title: string;
  body?: string | null;
  imageUrl?: string | null;
};

/**
 * Safari (NenGama Lodge) HOME — bespoke EDITORIAL design (preset `safari`),
 * built from scratch (Safari has no reference design dir). A warm, airy,
 * daylight-savanna composition that is deliberately UNLIKE the OceansView resort
 * grid, the Royal grand-hotel centred formality, and the Sabela dark filmic
 * lodge: left-aligned editorial rhythm, oversized two-digit index numerals,
 * hairline rules, and full-bleed alternating STORY BANDS for the rooms
 * (photography-forward). Its own `.sfhome` stylesheet; all colour/type/shape
 * from the `.wielo-safari` `--site-*` tokens. Same content-persistence contract
 * as every theme (content_profile + live listing data; demo copy is fallback
 * only). Renders inside the shared themed chrome. Phase B — theme differentiation.
 */
export function SafariHome({
  brandName,
  roomsHref,
  bookHref,
  interactive = true,
  heroHeadline,
  heroSubheadline,
  heroImageUrl,
  tagline,
  story,
  experiences,
  rooms,
  reviews,
  gallery,
  bookingData,
}: {
  brandName: string;
  roomsHref: string;
  bookHref: string;
  interactive?: boolean;
  heroHeadline?: string | null;
  heroSubheadline?: string | null;
  heroImageUrl?: string | null;
  tagline?: string | null;
  story?: string | null;
  experiences?: SafariHomeExperience[] | null;
  rooms?: RoomCard[] | null;
  reviews?: ReviewsData | null;
  gallery?: GalleryImage[] | null;
  bookingData?: BookingFunnelData;
}) {
  const roomList = (rooms ?? []).filter((r) => r.name).slice(0, 3);
  const shots = (gallery ?? []).filter((g) => g.url);
  const heroImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2560&q=80";

  const h1 = heroHeadline?.trim() || "Wake to the wild, unfenced and unhurried";
  const sub =
    heroSubheadline?.trim() ||
    tagline?.trim() ||
    "A warm savanna lodge where the day begins with birdsong and ends around the fire — every room open to the light, every stay booked direct.";

  const avg = reviews?.average ?? null;
  const count = reviews?.count ?? reviews?.items?.length ?? 0;

  // Story → a lead + supporting paragraphs (left-aligned editorial welcome).
  const storyParas = (story ?? "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const lead =
    storyParas[0] ||
    `${brandName} sits where the bush opens onto a wide, quiet plain — a handful of rooms, long verandahs, and the kind of stillness you can only find far from the road.`;
  const leadRest = storyParas.slice(1).join("\n\n");

  // Stats — derived from live data (editorial inline numerals).
  const maxSleeps = (rooms ?? []).reduce((m, r) => {
    for (const f of r.facts ?? []) {
      const n = /sleeps?\s*(\d+)/i.exec(f);
      if (n) m = Math.max(m, Number(n[1]));
    }
    return m;
  }, 0);
  const stats: { b: string; s: string }[] = [];
  if ((rooms ?? []).length)
    stats.push({
      b: String((rooms ?? []).length),
      s: (rooms ?? []).length === 1 ? "Room" : "Rooms & tents",
    });
  if (avg != null) stats.push({ b: avg.toFixed(1), s: "Guest rating" });
  if (count) stats.push({ b: commas(count), s: "Verified reviews" });
  if (maxSleeps > 0) stats.push({ b: String(maxSleeps), s: "Sleeps up to" });
  if (stats.length === 2) stats.push({ b: "0%", s: "Booking fees" });

  const exps = (experiences ?? []).filter((e) => e.title);

  // Reviews — star distribution (live) for the editorial breakdown.
  const items = reviews?.items ?? [];
  const hasQuotes = items.length > 0;

  const introImg =
    shots[1]?.url ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1547970810-dc1eac37d174?w=1400&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    heroImg ||
    "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?w=2000&q=80";

  // Editorial daylight mosaic (static grid — the room-detail gallery has the
  // lightbox; the home mosaic stays a calm asymmetric grid).
  const mosaic = shots.slice(0, 5);

  const availbarProps = {
    ctaLabel: "Check availability",
  } as unknown as BookingSearchProps;

  return (
    <div className="sfhome">
      {/* HERO — full-bleed photo, left-aligned editorial */}
      <section className="sf-hero">
        <div className="sf-hero-bg" data-parallax>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={siteImageUrl(heroImg, { width: 2560 })} alt={brandName} />
          <span className="sf-hero-scrim" aria-hidden />
        </div>
        <div className="wrap sf-hero-in">
          <div className="sf-hero-meta">
            <span>{brandName}</span>
            <i aria-hidden />
            {avg != null ? (
              <span>
                <em className="star">★</em> {avg.toFixed(1)}
                {count ? ` · ${commas(count)} reviews` : ""}
              </span>
            ) : (
              <span>Direct-booking lodge</span>
            )}
          </div>
          <h1>{h1}</h1>
          <p className="sf-hero-sub">{sub}</p>
          <div className="sf-hero-cta">
            <a href={roomsHref} className="sf-btn sf-btn-solid sf-btn-lg">
              Explore the rooms
            </a>
            <a href="#story" className="sf-btn sf-btn-line sf-btn-lg">
              The lodge {Arrow}
            </a>
          </div>
        </div>
      </section>

      {/* AVAILABILITY BAR (live) */}
      <section className="sf-availbar">
        <BookingSearchSection
          props={availbarProps}
          data={bookingData}
          interactive={interactive}
        />
      </section>

      {/* WELCOME — asymmetric editorial: lead copy + framed photo */}
      <section className="sf-sec" id="story">
        <div className="wrap">
          <div className="sf-intro">
            <div className="sf-intro-copy" data-reveal>
              <span className="sf-eyebrow">Welcome to {brandName}</span>
              <h2 className="sf-h2">{firstSentence(lead).head}</h2>
              <p className="sf-lead">{firstSentence(lead).rest || sub}</p>
              {leadRest ? (
                <p className="sf-muted" style={{ whiteSpace: "pre-line" }}>
                  {leadRest}
                </p>
              ) : null}
              <div className="sf-intro-cta">
                <a href="/about" className="sf-alink">
                  Our story {Arrow}
                </a>
                <a href={roomsHref} className="sf-alink">
                  Where you&apos;ll stay {Arrow}
                </a>
              </div>
            </div>
            <div className="sf-intro-fig" data-reveal>
              <div className="sf-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={siteImageUrl(introImg, { width: 1000 })}
                  alt={brandName}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              {tagline?.trim() ? (
                <span className="sf-fig-cap">{tagline.trim()}</span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* STATS — inline oversized numerals, hairline-ruled */}
      {stats.length >= 2 ? (
        <section className="sf-stats-sec">
          <div className="wrap">
            <div className="sf-stats" data-reveal>
              {stats.slice(0, 4).map((st, i) => (
                <div className="sf-stat" key={i}>
                  <b>{st.b}</b>
                  <span>{st.s}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ROOMS — full-bleed alternating STORY BANDS (the Safari signature) */}
      {roomList.length > 0 ? (
        <section className="sf-sec sf-sand" id="rooms">
          <div className="wrap">
            <div className="sf-sechead" data-reveal>
              <span className="sf-eyebrow">Where you&apos;ll sleep</span>
              <h2 className="sf-h2">Rooms open to the plain</h2>
            </div>
          </div>
          <div className="sf-bands">
            {roomList.map((r, i) => {
              const reversed = i % 2 === 1;
              const price = money(r.price, r.currency);
              const facts = (r.facts ?? []).filter(Boolean).slice(0, 3);
              return (
                <article
                  className={reversed ? "sf-band rev" : "sf-band"}
                  key={r.id}
                  data-reveal
                >
                  <a
                    href={r.detailHref || r.bookHref || roomsHref}
                    className="sf-band-fig"
                    aria-label={r.name}
                  >
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={siteImageUrl(r.imageUrl, { width: 1400 })}
                        alt={r.name}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                  </a>
                  <div className="sf-band-body">
                    <span className="sf-idx" aria-hidden>
                      {pad2(i)}
                    </span>
                    <h3>{r.name}</h3>
                    {facts.length ? (
                      <div className="sf-band-facts">
                        {facts.map((f, j) => (
                          <span key={j}>{f}</span>
                        ))}
                      </div>
                    ) : null}
                    {r.description ? <p>{r.description}</p> : null}
                    <div className="sf-band-foot">
                      {price ? (
                        <span className="sf-price">
                          <small>from</small> {price} <small>/ night</small>
                        </span>
                      ) : null}
                      <a
                        href={r.detailHref || r.bookHref || roomsHref}
                        className="sf-alink"
                      >
                        View room {Arrow}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="wrap">
            <div className="sf-bands-all" data-reveal>
              <a href={roomsHref} className="sf-btn sf-btn-line sf-btn-lg">
                All rooms &amp; rates {Arrow}
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {/* FIELD NOTES — experiences as an editorial ruled list */}
      {exps.length > 0 ? (
        <section className="sf-sec" id="experiences">
          <div className="wrap">
            <div className="sf-sechead" data-reveal>
              <span className="sf-eyebrow">Field notes</span>
              <h2 className="sf-h2">Days worth waking early for</h2>
            </div>
            <div className="sf-notes">
              {exps.map((e, i) => (
                <div
                  className="sf-note"
                  key={i}
                  data-reveal
                  style={
                    { "--reveal-delay": `${(i % 3) * 70}ms` } as CSSProperties
                  }
                >
                  {e.imageUrl ? (
                    <div className="sf-note-fig">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={siteImageUrl(e.imageUrl, { width: 700 })}
                        alt={e.title}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ) : (
                    <span className="sf-note-idx" aria-hidden>
                      {pad2(i)}
                    </span>
                  )}
                  <div className="sf-note-body">
                    <h3>{e.title}</h3>
                    {e.body ? <p>{e.body}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* PROMISE — the direct-booking promise as a ruled editorial row */}
      <section className="sf-sec-sm sf-sand">
        <div className="wrap">
          <div className="sf-promise" data-reveal>
            <span className="sf-eyebrow">The {brandName} promise</span>
            <div className="sf-promise-row">
              {PROMISE.map((p, i) => (
                <div className="sf-promise-item" key={i}>
                  <b>{p.k}</b>
                  <span>{p.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY — daylight editorial mosaic */}
      {mosaic.length >= 3 ? (
        <section className="sf-sec">
          <div className="wrap">
            <div className="sf-sechead" data-reveal>
              <span className="sf-eyebrow">A look around</span>
              <h2 className="sf-h2">The lodge, in daylight</h2>
            </div>
            <div className="sf-mosaic" data-reveal>
              {mosaic.map((g, i) => (
                <div className={`sf-m sf-m${i}`} key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={siteImageUrl(g.url, { width: i === 0 ? 1400 : 800 })}
                    alt={g.caption || brandName}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* REVIEWS — warm-dark band, left-aligned editorial */}
      {avg != null || hasQuotes ? (
        <section className="sf-sec sf-dark">
          <div className="wrap">
            <div className="sf-rev">
              <div className="sf-rev-head" data-reveal>
                <span className="sf-eyebrow">Guest words</span>
                <div className="sf-rev-score">
                  <b>{avg != null ? avg.toFixed(1) : "—"}</b>
                  <div>
                    <span className="stars">★★★★★</span>
                    <span className="sf-rev-count">
                      {count
                        ? `${commas(count)} verified review${count === 1 ? "" : "s"}`
                        : "Verified reviews"}
                    </span>
                  </div>
                </div>
              </div>
              {hasQuotes ? (
                <div className="sf-quotes">
                  {items.slice(0, 3).map((r, i) => (
                    <figure
                      className="sf-quote"
                      key={i}
                      data-reveal
                      style={
                        { "--reveal-delay": `${i * 80}ms` } as CSSProperties
                      }
                    >
                      <blockquote>{r.body}</blockquote>
                      <figcaption>
                        <span className="sf-av">{initials(r.author)}</span>
                        <span>
                          <b>{r.author}</b>
                          {r.date ? <em>{r.date}</em> : null}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA — full-bleed closing banner */}
      <section className="sf-cta">
        <div className="sf-cta-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(ctaImg, { width: 2000 })}
            alt={brandName}
            loading="lazy"
            decoding="async"
          />
          <span className="sf-hero-scrim" aria-hidden />
        </div>
        <div className="wrap sf-cta-in" data-reveal>
          <span className="sf-eyebrow on-dark">Book direct</span>
          <h2 className="sf-h2">Your place by the plain is waiting</h2>
          <p>
            Check the calendar, pick your view, and reserve straight with us —
            the price you see is the price you pay, with no booking fees.
          </p>
          <div className="sf-hero-cta">
            <a href={bookHref} className="sf-btn sf-btn-solid sf-btn-lg">
              Check availability
            </a>
            <a href="/contact" className="sf-btn sf-btn-line sf-btn-lg">
              Talk to the lodge {Arrow}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
