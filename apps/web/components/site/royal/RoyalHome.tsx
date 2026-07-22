import "./royalHome.css";

import type { CSSProperties } from "react";

import { Money } from "@/components/currency/Money";
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
function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "★";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export type RoyalHomeExperience = {
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

const Check = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// The direct-booking promise — always-true guarantees (never host-specific
// claims), styled as the grand-hotel "featured" trust strip.
const PROMISE = [
  "Book direct, always",
  "Best-rate guarantee",
  "Free cancellation",
];

// Brand-agnostic "everything taken care of" tiles — true for any direct-booking
// host, so they never fabricate an amenity this property may not have.
const VALUE_TILES = [
  {
    title: "A direct line",
    body: "Reserve straight with the house — a real person answers, before your stay and during it.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
      </svg>
    ),
  },
  {
    title: "Stay flexible",
    body: "Free cancellation up to 48 hours before arrival on every direct booking.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

/**
 * Royal Hotel HOME — the founder's bespoke GRAND-HOTEL design (preset `royal`).
 * A distinct, formal composition from the OceansView resort layout: a centred
 * hero, a "promise" trust strip, a centred editorial welcome, a monogram heritage
 * band, and refined champagne-ruled section heads — its OWN `.rhome` stylesheet.
 * Same content-persistence contract as every theme: hero copy + story from
 * content_profile, live listing data (rooms/reviews/gallery/booking) with demo
 * copy as a fallback only. Renders inside the shared themed chrome.
 */
export function RoyalHome({
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
  experiences?: RoyalHomeExperience[] | null;
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
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=2560&q=80";

  const h1 = heroHeadline?.trim() || "Stay at the centre of it all";
  const sub =
    heroSubheadline?.trim() ||
    tagline?.trim() ||
    "A landmark address with refined rooms and suites, a calm sense of arrival, and a team that looks after every detail — booked direct.";

  const avg = reviews?.average ?? null;
  const count = reviews?.count ?? reviews?.items?.length ?? 0;

  // Story → a centred lead + supporting paragraph.
  const storyParas = (story ?? "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const lead =
    storyParas[0] ||
    `Set where the city is at its most composed, ${brandName} is a calm, contemporary retreat built for both business and long, unhurried weekends.`;
  const leadRest = storyParas.slice(1).join("\n\n");

  // Stats — derived from live data.
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

  const exps = (experiences ?? []).filter((e) => e.title);

  // Reviews — star distribution (live) for the refined breakdown bars.
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

  // The welcome (intro) block gets its OWN heading — never the hero H1 (there must
  // be exactly one H1 per page, and repeating the hero line reads poorly). Use the
  // host's tagline when it's genuinely distinct, else a warm theme default.
  const introHeading =
    tagline?.trim() && tagline.trim() !== h1 && tagline.trim() !== sub
      ? tagline.trim()
      : "A calm, considered stay";
  // A second, distinct image for the framed intro (falls back to what's available).
  const introImg = shots[1]?.url || shots[0]?.url || ctaImg;

  // A grand-hotel mosaic (static grid — no lightbox), the reference's w2/h2 lead.
  const mosaic = shots.slice(0, 6);
  const mCls = ["w2 h2", "", "", "", "", "w2"];

  const availbarProps = {
    ctaLabel: "Check availability",
  } as unknown as BookingSearchProps;

  const monogram = (brandName.trim()[0] || "R").toUpperCase();

  return (
    <div className="rhome">
      {/* HERO — left-aligned, formal (matches the reference Royal design) */}
      <section className="hero">
        <div className="hero-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={siteImageUrl(heroImg, { width: 2560 })} alt={brandName} />
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
                The hotel
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* AVAILABILITY BAR (live) */}
      <section className="availbar">
        <BookingSearchSection
          props={availbarProps}
          data={bookingData}
          interactive={interactive}
        />
      </section>

      {/* PROMISE — the grand-hotel trust strip (honest guarantees) */}
      <section className="acc-sec">
        <div className="wrap">
          <div className="acc" data-reveal>
            <span className="lbl">The {brandName} promise</span>
            <div className="row">
              {PROMISE.map((p, i) => (
                <span key={i}>
                  {Check}
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WELCOME — two-column editorial (text left, framed image + badge right) */}
      <section className="section">
        <div className="wrap">
          <div className="split w-left" data-reveal>
            <div className="wintro">
              <span className="tag">Welcome to {brandName}</span>
              <h2>{introHeading}</h2>
              <p className="lead">{lead}</p>
              {leadRest ? (
                <p className="muted" style={{ whiteSpace: "pre-line" }}>
                  {leadRest}
                </p>
              ) : null}
              <div className="rintro-cta">
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
                  src={siteImageUrl(introImg, { width: 1200 })}
                  alt={brandName}
                />
              </div>
              <div className="float-badge">
                <b>Direct</b>
                <span>Best rate, always</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS — refined bordered band */}
      {stats.length >= 2 ? (
        <section className="section-sm sand">
          <div className="wrap">
            <div className="stats">
              {stats.slice(0, 4).map((st, i) => (
                <div
                  className="stat"
                  key={i}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 80}ms` } as CSSProperties}
                >
                  <b>{st.b}</b>
                  <span>{st.s}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ROOMS & SUITES — centred head + refined grid */}
      {roomList.length > 0 ? (
        <section className="section">
          <div className="wrap">
            <div className="sec-head center" data-reveal>
              <span className="tag" style={{ justifyContent: "center" }}>
                Where you&apos;ll stay
              </span>
              <h2 className="lg" style={{ marginTop: 18 }}>
                Rooms &amp; suites
              </h2>
            </div>
            <div className="rooms">
              {roomList.map((r, i) => (
                <a
                  href={r.detailHref || r.bookHref || roomsHref}
                  className="room"
                  key={r.id}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 90}ms` } as CSSProperties}
                >
                  <div className="room-img">
                    {r.price != null ? (
                      <span className="room-price">
                        <Money amount={r.price} currency={r.currency} />
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
            <div className="rooms-all" data-reveal>
              <a href={roomsHref} className="btn btn-ghost btn-lg">
                All rooms &amp; rates
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {/* EXPERIENCES — only when the host has real ones */}
      {exps.length > 0 ? (
        <section className="section sand" id="experiences">
          <div className="wrap">
            <div className="sec-head center" data-reveal>
              <span className="tag" style={{ justifyContent: "center" }}>
                The resort
              </span>
              <h2 className="lg" style={{ marginTop: 18 }}>
                Days you won&apos;t want to end
              </h2>
            </div>
            <div className="exps">
              {exps.map((e, i) => (
                <div
                  className="exp"
                  key={i}
                  data-reveal
                  style={
                    { "--reveal-delay": `${(i % 3) * 80}ms` } as CSSProperties
                  }
                >
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

      {/* HERITAGE — monogram band (grand-hotel signature) */}
      <section className="section">
        <div className="wrap">
          <div className="heritage" data-reveal>
            <span className="mono" aria-hidden>
              {monogram}
            </span>
            <h2>A considered address</h2>
            <p>
              {tagline?.trim() ||
                `Everything at ${brandName} is built around one idea — a calm, well-run stay where the details are handled and the price never moves.`}
            </p>
          </div>
        </div>
      </section>

      {/* THE HOTEL — value tiles (centred) */}
      <section className="section sand">
        <div className="wrap">
          <div className="sec-head center" data-reveal>
            <span className="tag" style={{ justifyContent: "center" }}>
              Good to know
            </span>
            <h2 className="lg" style={{ marginTop: 18 }}>
              Everything taken care of
            </h2>
          </div>
          <div className="tiles">
            {VALUE_TILES.map((t, i) => (
              <div
                className="tile"
                key={i}
                data-reveal
                style={{ "--reveal-delay": `${i * 70}ms` } as CSSProperties}
              >
                <div className="ic">{t.icon}</div>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY — static grand-hotel mosaic */}
      {mosaic.length > 0 ? (
        <section className="section">
          <div className="wrap">
            <div className="sec-head center" data-reveal>
              <span className="tag" style={{ justifyContent: "center" }}>
                A look around
              </span>
              <h2 className="lg" style={{ marginTop: 18 }}>
                A look inside
              </h2>
            </div>
            <div className="mosaic" data-reveal>
              {mosaic.map((g, i) => (
                <div className={`m ${mCls[i] ?? ""}`.trim()} key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={siteImageUrl(g.url, {
                      width: mCls[i]?.includes("w2") ? 1200 : 800,
                    })}
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

      {/* REVIEWS (navy) — centred formal score + refined breakdown */}
      {avg != null || items.length > 0 ? (
        <section className="section navy">
          <div className="wrap">
            <div className="rev-head" data-reveal>
              <span className="tag">Guest love</span>
              <h2 className="lg" style={{ marginTop: 18 }}>
                The reviews say it best
              </h2>
              <div className="rev-score">
                <div className="rs-num">
                  {avg != null ? avg.toFixed(1) : "—"}
                </div>
                <div>
                  <div className="stars">★★★★★</div>
                  <p className="muted">
                    {count
                      ? `${commas(count)} verified reviews`
                      : "Verified reviews"}
                  </p>
                </div>
              </div>
            </div>

            {hasBars ? (
              <div className="hcats" data-reveal>
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
                  <div
                    className="quote"
                    key={i}
                    data-reveal
                    style={{ "--reveal-delay": `${i * 90}ms` } as CSSProperties}
                  >
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
          <div className="banner" data-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteImageUrl(ctaImg, { width: 1600 })}
              alt={brandName}
              loading="lazy"
              decoding="async"
            />
            <div className="banner-in">
              <span
                className="hero-chip"
                style={{ background: "rgba(255,255,255,.16)" }}
              >
                {Check} Book direct · the price you see is the price you pay
              </span>
              <h2 style={{ marginTop: 20 }}>
                Your room in the city is waiting
              </h2>
              <p>
                Check the calendar, pick your view, and reserve straight with us
                — no agents.
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
