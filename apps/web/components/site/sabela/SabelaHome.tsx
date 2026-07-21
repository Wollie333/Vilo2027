import "./sabelaHome.css";

import type { CSSProperties, ReactNode } from "react";
import type {
  GalleryImage,
  ReviewsData,
  RoomCard,
  BookingFunnelData,
  LocationData,
} from "@/lib/site/types";
import { siteImageUrl } from "@/lib/site/image";

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
function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "★";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export type SabelaHomeExperience = {
  title: string;
  body?: string | null;
  imageUrl?: string | null;
};

const ArrowSm = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const PinIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// Branded, always-true value props for the direct-booking model (not host data),
// styled in Sabela's editorial "feature" language with a gold icon tile.
const HIGHLIGHTS: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
    title: "Booked direct with us",
    body: "Reserve straight with the lodge — no agents, no marketplace between you and your stay.",
  },
  {
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9z" />
        <circle cx="7.5" cy="7.5" r="1.4" />
      </svg>
    ),
    title: "The rate you see is the rate you pay",
    body: "No hidden surcharges — every cent goes to your stay.",
  },
  {
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v3M16 3v3M9 14l2 2 4-4" />
      </svg>
    ),
    title: "Flexible when plans change",
    body: "Speak to a real person, hold your dates, and enjoy fair, flexible cancellation on every booking.",
  },
];

/**
 * Sabela Lodge home page — the founder's bespoke dark-editorial "Lodge" reference
 * design, wired to the host's content (hero copy, story from content_profile) +
 * live listing data (suites, reviews, gallery, location), with the design's demo
 * copy as a fallback only when a slot is empty. Renders inside the `.sbchrome`
 * themed chrome (SiteChrome, `hotel` preset).
 */
export function SabelaHome({
  brandName,
  roomsHref,
  bookHref,
  interactive = true,
  heroHeadline,
  heroSubheadline,
  heroImageUrl,
  story,
  experiences,
  rooms,
  reviews,
  gallery,
  location,
  bookingData,
}: {
  brandName: string;
  roomsHref: string;
  bookHref: string;
  interactive?: boolean;
  heroHeadline?: string | null;
  heroSubheadline?: string | null;
  heroImageUrl?: string | null;
  story?: string | null;
  experiences?: SabelaHomeExperience[] | null;
  rooms?: RoomCard[] | null;
  reviews?: ReviewsData | null;
  gallery?: GalleryImage[] | null;
  location?: LocationData | null;
  bookingData?: BookingFunnelData;
}) {
  // experiences / interactive / bookingData are part of the shared prop contract;
  // this faithful port of the reference home surfaces none of them (the reference
  // hero embeds no availability search).
  void experiences;
  void interactive;
  void bookingData;

  const shots = (gallery ?? []).filter((g) => g.url);
  const roomList = (rooms ?? []).slice(0, 3);

  const heroImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2000&q=80";

  const hasHeroHeadline = Boolean(heroHeadline?.trim());
  const heroSub =
    heroSubheadline?.trim() ||
    "An intimate, design-led lodge on a private reserve — a handful of suites, unhurried days, and nothing between you and the wild.";
  const heroEyebrow = location?.address?.trim() || "Book direct";

  // story is part of the contract; the reference home has no story block.
  void story;

  // Reviews.
  const avg = reviews?.average ?? null;
  const reviewItems = reviews?.items ?? [];
  const reviewCount = reviews?.count ?? null;

  // Stats — derived from live data only (never fabricated). "Sleeps up to" reads
  // the largest "Sleeps N" number across the rooms' free-text facts.
  const maxSleeps = (rooms ?? []).reduce((m, r) => {
    for (const f of r.facts ?? []) {
      const n = /sleeps?\s*(\d+)/i.exec(f);
      if (n) m = Math.max(m, Number(n[1]));
    }
    return m;
  }, 0);
  const roomCount = (rooms ?? []).length;
  const stats: { n: string; l: string }[] = [];
  if (roomCount)
    stats.push({
      n: String(roomCount),
      l: roomCount === 1 ? "Suite" : "Suites",
    });
  if (avg != null) stats.push({ n: avg.toFixed(1), l: "Guest rating" });
  if (reviewCount) stats.push({ n: commas(reviewCount), l: "Verified stays" });
  if (maxSleeps > 0) stats.push({ n: String(maxSleeps), l: "Sleeps up to" });

  const galShots = shots.slice(0, 6);
  const galSpan = (i: number): string => {
    if (i === 0) return "g span2 row2";
    if (i === 3) return "g span2";
    return "g";
  };

  const locHeading = location?.fullAddress || location?.address || "";
  const locPois = (location?.pois ?? []).slice(0, 4);
  const locPhoto = shots[2]?.url || shots[0]?.url || null;

  return (
    <div className="sbhome">
      {/* HERO */}
      <section className="hero" data-section="hero">
        <div className="hero-full">
          <div
            className="hero-img"
            style={{ backgroundImage: `url('${heroImg}')` }}
          />
          <div className="wrap hero-content">
            <span className="eyebrow">{heroEyebrow}</span>
            {hasHeroHeadline ? (
              <h1>{heroHeadline?.trim()}</h1>
            ) : (
              <h1>Where the wild still keeps its secrets</h1>
            )}
            <p className="hero-sub">{heroSub}</p>
            <div className="hero-cta-row">
              <a href={roomsHref} className="btn btn-primary btn-lg">
                Explore the suites
              </a>
              <a href={bookHref} className="btn btn-on-dark btn-lg">
                Check availability
              </a>
            </div>
          </div>
          <div className="hero-scroll">
            <span>Scroll</span>
            <span className="mouse" />
          </div>
        </div>
      </section>

      {/* HIGHLIGHTS (direct-booking value props) */}
      <section className="section" data-section="highlights">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <span className="eyebrow">Why book direct</span>
            <h2>Nothing between you and your stay</h2>
          </div>
          <div className="feature-grid">
            {HIGHLIGHTS.map((h, i) => (
              <div
                className="feature"
                key={i}
                data-reveal
                style={{ "--reveal-delay": `${i * 90}ms` } as CSSProperties}
              >
                <div className="f-ic">{h.icon}</div>
                <h3>{h.title}</h3>
                <p>{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      {galShots.length > 0 ? (
        <section className="section-sm soft-bg" data-section="gallery">
          <div className="wrap">
            <div className="sec-head center" data-reveal>
              <span className="eyebrow center no-rule">
                Moments at {brandName}
              </span>
              <h2>The place, in fragments</h2>
            </div>
            <div className="gallery">
              {galShots.map((g, i) => (
                <div
                  className={galSpan(i)}
                  key={i}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 70}ms` } as CSSProperties}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={siteImageUrl(g.url, { width: 1200 })}
                    alt={g.caption || brandName}
                    loading="lazy"
                    decoding="async"
                  />
                  {g.caption ? (
                    <span className="g-cap">{g.caption}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* SUITES PREVIEW */}
      {roomList.length > 0 ? (
        <section className="section" data-section="rooms_preview">
          <div className="wrap">
            <div
              className="sec-head between"
              data-reveal
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                maxWidth: "none",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div style={{ maxWidth: 560 }}>
                <span className="eyebrow">Where you&apos;ll stay</span>
                <h2>The suites</h2>
              </div>
              <a href={roomsHref} className="link-arrow">
                View all suites {ArrowSm}
              </a>
            </div>
            <div className="rooms-grid">
              {roomList.map((r, i) => (
                <a
                  href={r.detailHref || r.bookHref || roomsHref}
                  className="room-card"
                  key={r.id}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 90}ms` } as CSSProperties}
                >
                  <div className="rc-img">
                    {r.badge ? <span className="rc-tag">{r.badge}</span> : null}
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={siteImageUrl(r.imageUrl, { width: 800 })}
                        alt={r.name}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                  </div>
                  <div className="rc-body">
                    <h3>{r.name}</h3>
                    {r.facts?.length ? (
                      <div className="rc-meta">
                        {r.facts.slice(0, 2).map((f, i) => (
                          <span key={i}>{f}</span>
                        ))}
                      </div>
                    ) : null}
                    {r.description ? (
                      <p className="rc-desc">{r.description}</p>
                    ) : null}
                    <div className="rc-foot">
                      <div className="price">
                        {money(r.price, r.currency) ?? "Enquire"}
                        {money(r.price, r.currency) ? (
                          <small> / night</small>
                        ) : null}
                      </div>
                      <span className="link-arrow">View {ArrowSm}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* STATS */}
      {stats.length >= 2 ? (
        <section className="section-sm soft-bg" data-section="stats">
          <div className="wrap">
            <div className="stats">
              {stats.slice(0, 4).map((st, i) => (
                <div
                  className="stat"
                  key={i}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 80}ms` } as CSSProperties}
                >
                  <div className="n">{st.n}</div>
                  <div className="l">{st.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* REVIEWS */}
      {reviewItems.length > 0 || avg != null ? (
        <section className="section" data-section="reviews">
          <div className="wrap">
            <div className="rating-hero" data-reveal>
              {avg != null ? (
                <div className="score">
                  {avg.toFixed(2)}
                  {reviewCount ? (
                    <small>{commas(reviewCount)} verified stays</small>
                  ) : null}
                </div>
              ) : null}
              <div style={{ maxWidth: 460 }}>
                <div className="rating-inline">
                  <span className="stars" style={{ fontSize: 18 }}>
                    ★★★★★
                  </span>
                </div>
                <h2
                  style={{
                    fontSize: "clamp(1.8rem,3vw,2.6rem)",
                    marginTop: 14,
                  }}
                >
                  Guests arrive curious. They leave changed.
                </h2>
                <p className="muted" style={{ marginTop: 14 }}>
                  The place is the headline. The quiet, the people, and the
                  table are what they write home about.
                </p>
              </div>
            </div>
            {reviewItems.length > 0 ? (
              <div className="reviews-grid">
                {reviewItems.slice(0, 3).map((r, i) => (
                  <div
                    className="review"
                    key={i}
                    data-reveal
                    style={{ "--reveal-delay": `${i * 90}ms` } as CSSProperties}
                  >
                    <div className="stars">
                      {"★".repeat(
                        Math.max(1, Math.min(5, Math.round(r.rating))),
                      )}
                    </div>
                    <p>{r.body}</p>
                    <div className="who">
                      <span className="avatar">{initials(r.author)}</span>
                      <div>
                        <div className="nm">{r.author}</div>
                        {r.date ? <div className="dt">{r.date}</div> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* LOCATION */}
      {location?.address ? (
        <section className="section soft-bg" data-section="location">
          <div className="wrap">
            <div className="loc" data-reveal>
              <div>
                <span className="eyebrow">Getting here</span>
                <h2
                  style={{
                    fontSize: "clamp(1.9rem,3.2vw,2.8rem)",
                    marginTop: 16,
                  }}
                >
                  {locHeading || "Finding us"}
                </h2>
                <p
                  className="muted"
                  style={{ marginTop: 16, maxWidth: "46ch" }}
                >
                  We&apos;ll share directions and our favourite corners of the
                  area once you book direct with us.
                </p>
                {locPois.length > 0 ? (
                  <div className="loc-detail">
                    {locPois.map((p, i) => (
                      <div className="ld" key={i}>
                        <i>{PinIcon}</i>
                        <div>
                          <div className="t">{p.name}</div>
                          {p.distance || p.category ? (
                            <div className="d">
                              {[p.category, p.distance]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              {location.mapEmbedUrl ? (
                <div className="loc-frame">
                  <iframe
                    src={location.mapEmbedUrl}
                    title={`Map of ${brandName}`}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", border: 0 }}
                  />
                </div>
              ) : locPhoto ? (
                <div className="loc-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={siteImageUrl(locPhoto, { width: 1100 })}
                    alt={brandName}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="section-sm" data-section="cta">
        <div className="wrap">
          <div className="cta-band" data-reveal>
            <span className="glow" />
            <span className="zero-badge">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Book direct
            </span>
            <h2>Your stay begins with a single message</h2>
            <p>
              Tell us your dates and we&apos;ll hold a suite. Booked direct with
              the lodge — the rate you see is the rate you pay.
            </p>
            <div className="hero-cta-row">
              <a href={bookHref} className="btn btn-light btn-lg">
                Check availability
              </a>
              <a href="/contact" className="btn btn-on-dark btn-lg">
                Speak to us
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
