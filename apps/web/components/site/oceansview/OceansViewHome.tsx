import "./oceansHome.css";
// Lightbox slider styles (.ovroom-lightbox / .ovlb-*) live in oceansRoom.css.
import "./oceansRoom.css";

import { siteImageUrl } from "@/lib/site/image";
import type {
  GalleryImage,
  ReviewsData,
  RoomCard,
  BookingFunnelData,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { BookingSearchSection } from "../sections/BookingSearchSection";
import { OceansMosaicGallery } from "./OceansMosaicGallery";

type BookingSearchProps = Extract<
  WebsiteSection,
  { type: "booking_search" }
>["props"];

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

export type OceansHomeExperience = {
  title: string;
  body?: string | null;
  imageUrl?: string | null;
};

const Arrow = (
  <svg
    width="17"
    height="17"
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

// Branded, always-true value props for the direct-booking model (not host data).
const VALUE_TILES = [
  {
    title: "No booking fees",
    body: "Book direct and pay exactly what you see — no agents, no surcharges.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12.5 10 17l9-9" />
      </svg>
    ),
  },
  {
    title: "Best-rate guarantee",
    body: "The lowest price is always right here — never cheaper anywhere else.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
      </svg>
    ),
  },
  {
    title: "Flexible plans",
    body: "Free cancellation up to 48 hours before arrival on direct bookings.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    title: "Instant confirmation",
    body: "Reserve now and your stay is confirmed in seconds — no waiting.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="M22 4 12 14.01l-3-3" />
      </svg>
    ),
  },
];

/**
 * Oceans View home page — the founder's bespoke reference design, wired to the
 * host's content (hero copy, story, experiences from content_profile) + live
 * listing data (rooms, reviews, gallery), with the design's demo copy as a
 * fallback only when a slot is empty. Renders inside the themed chrome.
 */
export function OceansViewHome({
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
  experiences?: OceansHomeExperience[] | null;
  rooms?: RoomCard[] | null;
  reviews?: ReviewsData | null;
  gallery?: GalleryImage[] | null;
  bookingData?: BookingFunnelData;
}) {
  const roomList = (rooms ?? []).slice(0, 3);
  const shots = (gallery ?? []).filter((g) => g.url);
  const heroImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=2400&q=80";

  // Hero copy — content_profile first, demo fallback.
  const h1 = heroHeadline?.trim() || "Wake up to the whole ocean";
  const sub =
    heroSubheadline?.trim() ||
    "A bright beachfront escape where the water starts at your door — sea-view rooms, a slower pace, and a stay you book direct.";

  // Rating for the hero chip + reviews.
  const avg = reviews?.average ?? null;
  const count = reviews?.count ?? reviews?.items?.length ?? 0;

  // Story split into a lead + the rest.
  const storyParas = (story ?? "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const lead =
    storyParas[0] ||
    `Set right where the land meets the sea, ${brandName} is a sun-drenched escape built for slow mornings and long, golden evenings.`;
  const leadRest = storyParas.slice(1).join("\n\n");
  const introImg =
    shots[1]?.url ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1100&q=80";

  // Stats — derived from live data. "Sleeps up to" reads the largest number out
  // of any "Sleeps N" fact across the rooms (facts are free-text strings).
  const maxSleeps = (rooms ?? []).reduce((m, r) => {
    for (const f of r.facts ?? []) {
      const n = /sleeps?\s*(\d+)/i.exec(f);
      if (n) m = Math.max(m, Number(n[1]));
    }
    return m;
  }, 0);
  const stats: { b: string; s: string }[] = [];
  if (roomList.length)
    stats.push({
      b: String((rooms ?? []).length),
      s: (rooms ?? []).length === 1 ? "Room" : "Rooms & suites",
    });
  if (avg != null) stats.push({ b: avg.toFixed(1), s: "Guest rating" });
  if (count) stats.push({ b: commas(count), s: "Verified reviews" });
  if (maxSleeps > 0) stats.push({ b: String(maxSleeps), s: "Sleeps up to" });
  // Pad to an even 3-up when we only have two live stats.
  if (stats.length === 2) stats.push({ b: "0%", s: "Booking fees" });

  const exps = (experiences ?? []).filter((e) => e.title);

  // Reviews — star distribution (live) for the category bars.
  const items = reviews?.items ?? [];
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    pct: items.length
      ? Math.round(
          (items.filter((r) => Math.round(r.rating) === star).length /
            items.length) *
            100,
        )
      : 0,
  }));
  const hasBars = items.length >= 3;
  const ctaImg =
    shots[shots.length - 1]?.url ||
    heroImg ||
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=2000&q=80";

  const availbarProps = {
    ctaLabel: "Check availability",
  } as unknown as BookingSearchProps;

  return (
    <div className="ovhome">
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(heroImg, { width: 2560 })}
            alt={`${brandName}`}
          />
        </div>
        <div className="hero-in">
          <div className="wrap">
            {avg != null ? (
              <span className="hero-chip">
                <span className="star">★★★★★</span> {avg.toFixed(1)}
                {count ? ` · loved by ${commas(count)} guests` : ""}
              </span>
            ) : null}
            <h1>{h1}</h1>
            <p className="hero-sub">{sub}</p>
            <div className="hero-cta">
              <a href={roomsHref} className="btn btn-coral btn-lg">
                Explore rooms
              </a>
              <a href="#experiences" className="btn btn-on-img btn-lg">
                Take a look
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* AVAILABILITY BAR (floats over the hero) */}
      <section className="availbar">
        <BookingSearchSection
          props={availbarProps}
          data={bookingData}
          interactive={interactive}
        />
      </section>

      {/* INTRO */}
      <section className="section">
        <div className="wrap">
          <div className="split w-left">
            <div>
              <span className="tag">Welcome to {brandName}</span>
              <h2 className="lg" style={{ marginTop: 20 }}>
                {h1}
              </h2>
              <p className="lead" style={{ marginTop: 24 }}>
                {lead}
              </p>
              {leadRest ? (
                <p
                  className="muted"
                  style={{
                    marginTop: 18,
                    maxWidth: "54ch",
                    whiteSpace: "pre-line",
                  }}
                >
                  {leadRest}
                </p>
              ) : null}
              <div
                style={{
                  marginTop: 32,
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <a href="/about" className="btn btn-ghost">
                  Our story
                </a>
                <a href={roomsHref} className="alink">
                  View rooms {Arrow}
                </a>
              </div>
            </div>
            <div className="frame-wrap">
              <div className="frame ar-45">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={siteImageUrl(introImg, { width: 1600 })}
                  alt={`${brandName}`}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      {stats.length >= 2 ? (
        <section className="section-sm sand">
          <div className="wrap">
            <div className="stats">
              {stats.slice(0, 4).map((st, i) => (
                <div className="stat" key={i}>
                  <b>{st.b}</b>
                  <span>{st.s}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ROOMS */}
      {roomList.length > 0 ? (
        <section className="section">
          <div className="wrap">
            <div
              className="sec-head"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                maxWidth: "none",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div style={{ maxWidth: 540 }}>
                <span className="tag">Where you&apos;ll stay</span>
                <h2 className="lg" style={{ marginTop: 18 }}>
                  Rooms made for the view
                </h2>
              </div>
              <a href={roomsHref} className="alink">
                All rooms &amp; rates {Arrow}
              </a>
            </div>
            <div className="rooms">
              {roomList.map((r) => (
                <a
                  href={r.detailHref || r.bookHref || roomsHref}
                  className="room"
                  key={r.id}
                >
                  <div className="room-img">
                    {money(r.price, r.currency) ? (
                      <span className="room-price">
                        {money(r.price, r.currency)}
                        <small>/night</small>
                      </span>
                    ) : null}
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
                  <div className="room-body">
                    <h3>{r.name}</h3>
                    {r.facts?.length ? (
                      <div className="room-feat">
                        {r.facts.slice(0, 3).map((f, j) => (
                          <span className="chip" key={j}>
                            {f}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {r.description ? <p>{r.description}</p> : null}
                    <div className="room-foot">
                      <span className="alink">View room {Arrow}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* EXPERIENCES */}
      {exps.length > 0 ? (
        <section className="section sand" id="experiences">
          <div className="wrap">
            <div className="sec-head">
              <span className="tag">The experience</span>
              <h2 className="lg" style={{ marginTop: 18 }}>
                Days you won&apos;t want to end
              </h2>
            </div>
            <div className="exps">
              {exps.map((e, i) => (
                <div className="exp" key={i}>
                  {e.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteImageUrl(e.imageUrl, { width: 800 })}
                      alt={e.title}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                  <div className="exp-b">
                    <h3>{e.title}</h3>
                    {e.body ? <p>{e.body}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* VALUE / AMENITIES */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="tag" style={{ justifyContent: "center" }}>
              Good to know
            </span>
            <h2 className="lg" style={{ marginTop: 18 }}>
              Everything taken care of
            </h2>
          </div>
          <div className="tiles">
            {VALUE_TILES.map((t, i) => (
              <div className="tile" key={i}>
                <div className="ic">{t.icon}</div>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      {shots.length > 0 ? (
        <section className="section sand">
          <div className="wrap">
            <div className="sec-head">
              <span className="tag">A look around</span>
              <h2 className="lg" style={{ marginTop: 18 }}>
                Take a look inside
              </h2>
            </div>
            <OceansMosaicGallery images={shots} brandName={brandName} />
          </div>
        </section>
      ) : null}

      {/* REVIEWS (navy) */}
      {avg != null || items.length > 0 ? (
        <section className="section navy">
          <div className="wrap">
            <div
              className="split"
              style={{ alignItems: "center", marginBottom: 54 }}
            >
              <div>
                <span className="tag">Guest love</span>
                <h2 className="lg" style={{ marginTop: 18 }}>
                  The reviews say it best
                </h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <div
                  style={{
                    fontFamily: "var(--site-font-heading)",
                    fontWeight: 800,
                    fontSize: "clamp(3rem,6vw,4.4rem)",
                    color: "var(--site-secondary, #ff6b57)",
                    lineHeight: 1,
                  }}
                >
                  {avg != null ? avg.toFixed(1) : "—"}
                </div>
                <div>
                  <div className="stars" style={{ fontSize: 18 }}>
                    ★★★★★
                  </div>
                  <p
                    className="muted"
                    style={{
                      marginTop: 6,
                      color: "var(--site-navy-mute, #9fbcc4)",
                    }}
                  >
                    {count
                      ? `${commas(count)} verified reviews`
                      : "Verified reviews"}
                  </p>
                </div>
              </div>
            </div>

            {hasBars ? (
              <div className="hcats">
                {dist.map((d) => (
                  <div className="hcat" key={d.star}>
                    <div className="hct">
                      <span>
                        {d.star} star{d.star === 1 ? "" : "s"}
                      </span>
                      <b>{d.pct}%</b>
                    </div>
                    <div className="htrack">
                      <div className="hfill" style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {items.length > 0 ? (
              <div className="quotes">
                {items.slice(0, 3).map((r, i) => (
                  <div className="quote" key={i}>
                    <span className="qm">&ldquo;</span>
                    <p>{r.body}</p>
                    <div className="who">
                      <span className="av">{initials(r.author)}</span>
                      <div>
                        <div className="nm">{r.author}</div>
                        {r.date ? <div className="loc">{r.date}</div> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* CTA BANNER */}
      <section className="section">
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteImageUrl(ctaImg, { width: 1600 })}
              alt={`${brandName}`}
              loading="lazy"
              decoding="async"
            />
            <div className="banner-in">
              <span
                className="hero-chip"
                style={{ background: "rgba(255,255,255,.16)" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Book direct · the price you see is the price you pay
              </span>
              <h2 style={{ marginTop: 20 }}>Your stay is waiting</h2>
              <p>
                Check the calendar, pick your room, and reserve straight with us
                — no agents, no booking fees.
              </p>
              <div className="hero-cta">
                <a href={bookHref} className="btn btn-white btn-lg">
                  Check availability
                </a>
                <a href="/contact" className="btn btn-on-img btn-lg">
                  Talk to us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
