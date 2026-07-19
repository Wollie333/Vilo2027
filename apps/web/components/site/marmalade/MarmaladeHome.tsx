import "./marmaladeHome.css";

import type {
  GalleryImage,
  ReviewsData,
  RoomCard,
  BookingFunnelData,
  LocationData,
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

export type MarmaladeHomeExperience = {
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
// Styled as marmalade postcard `.pc` cards with a `.stamp` emoji badge.
const HIGHLIGHTS: {
  emoji: string;
  rot: number;
  title: string;
  body: string;
}[] = [
  {
    emoji: "☕",
    rot: 7,
    title: "Breakfast included",
    body: "Start every morning with breakfast on the house — and never a booking fee.",
  },
  {
    emoji: "✓",
    rot: -6,
    title: "Book direct",
    body: "Reserve straight with us: the price you see is the price you pay, no agents, no surcharges.",
  },
  {
    emoji: "✿",
    rot: 5,
    title: "Free to change plans",
    body: "Change of heart? Free cancellation right up to 48 hours before you arrive.",
  },
];

/**
 * Marmalade House home page — the founder's bespoke "Postcards" reference design,
 * wired to the host's content (hero copy, story from content_profile) + live
 * listing data (rooms, reviews, gallery, location), with the design's demo copy
 * as a fallback only when a slot is empty. Renders inside the themed chrome.
 */
export function MarmaladeHome({
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
  experiences?: MarmaladeHomeExperience[] | null;
  rooms?: RoomCard[] | null;
  reviews?: ReviewsData | null;
  gallery?: GalleryImage[] | null;
  location?: LocationData | null;
  bookingData?: BookingFunnelData;
}) {
  // experiences is part of the shared prop contract; not surfaced on this design.
  void experiences;

  const roomList = (rooms ?? []).slice(0, 3);
  const shots = (gallery ?? []).filter((g) => g.url);
  const heroImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=2000&q=80";

  const brandInitial = (brandName.trim()[0] || "M").toUpperCase();
  const hasHeroHeadline = Boolean(heroHeadline?.trim());
  const sub =
    heroSubheadline?.trim() ||
    "Five sunny rooms in a restored 1873 parsonage, a garden full of figs, and a breakfast worth setting an alarm for.";

  // Story split into a lead + the rest.
  const storyParas = (story ?? "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const lead =
    storyParas[0] ||
    "We're a small guesthouse in the old parsonage on Church Street — pressed ceilings, deep baths, a long table, and a garden the kitchen raids every morning.";
  const leadRest =
    storyParas.slice(1).join("\n\n") ||
    "There's no front desk, no piped music, and no fee for booking straight with us. Just a key, a cup of tea on arrival, and whichever room suits you best.";
  const introImg =
    shots[1]?.url ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1000&q=80";

  // Reviews.
  const items = reviews?.items ?? [];

  const galShots = shots.slice(0, 6);

  const ctaImg =
    shots[shots.length - 1]?.url ||
    heroImg ||
    "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=2000&q=80";

  const locHeading = location?.address || location?.fullAddress || "";
  const locPois = (location?.pois ?? []).slice(0, 4);

  const availbarProps = {
    ctaLabel: "Check dates",
  } as unknown as BookingSearchProps;

  return (
    <div className="mmhome">
      {/* HERO (postcard) */}
      <section className="phero">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImg} alt={brandName} />
        </div>
        <div className="postcard">
          <span className="stamp">{brandInitial}</span>
          <div className="eye">{brandName}</div>
          {hasHeroHeadline ? (
            <h1>{heroHeadline?.trim()}</h1>
          ) : (
            <h1>
              A little house that <em>feeds</em> you well.
            </h1>
          )}
          <div className="hand">wish you were here →</div>
          <p className="sub">{sub}</p>
          <div className="pcta">
            <a href={roomsHref} className="btn btn-accent btn-lg">
              See the rooms
            </a>
            <a href="/about" className="btn btn-ghost btn-lg">
              Meet the house
            </a>
          </div>
        </div>
      </section>

      {/* AVAILABILITY */}
      <section className="mmavail">
        <div className="wrap">
          <BookingSearchSection
            props={availbarProps}
            data={bookingData}
            interactive={interactive}
          />
        </div>
      </section>

      {/* INTRO (split) */}
      <section className="section">
        <div className="wrap">
          <div className="split w-left">
            <div>
              <span className="eyebrow">Welcome in</span>
              <h2 className="lg" style={{ marginTop: 16 }}>
                It&apos;s less a hotel,
                <br />
                more a home with
                <br />
                spare rooms.
              </h2>
              <p className="lead" style={{ marginTop: 20 }}>
                {lead}
              </p>
              <p
                className="muted"
                style={{
                  marginTop: 14,
                  maxWidth: "52ch",
                  whiteSpace: "pre-line",
                }}
              >
                {leadRest}
              </p>
              <div
                style={{
                  marginTop: 28,
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <a href="/about" className="btn btn-ghost">
                  Our story
                </a>
                <a href={roomsHref} className="alink">
                  See the rooms {Arrow}
                </a>
              </div>
            </div>
            <div className="frame-wrap">
              <div className="frame photo ar-45 tilt">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={introImg}
                  alt={brandName}
                  loading="lazy"
                  decoding="async"
                />
                <span className="photo-cap">a corner of the house</span>
              </div>
              <span
                className="tape"
                style={{ left: -14, top: 24, transform: "rotate(-8deg)" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ROOMS (postcards) */}
      {roomList.length > 0 ? (
        <section className="section soft">
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
              <div>
                <span className="hand">where you&apos;ll sleep</span>
                <h2 className="lg">Pick a room, any room</h2>
              </div>
              <a href={roomsHref} className="alink">
                All rooms {Arrow}
              </a>
            </div>
            <div className="pcgrid">
              {roomList.map((r) => (
                <a
                  href={r.detailHref || r.bookHref || roomsHref}
                  className="pc"
                  key={r.id}
                >
                  <div className="pi">
                    {money(r.price, r.currency) ? (
                      <span className="pcprice">
                        {money(r.price, r.currency)}
                      </span>
                    ) : null}
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.imageUrl}
                        alt={r.name}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                  </div>
                  <div className="cap">{r.name}</div>
                  {r.facts?.length ? (
                    <div className="meta">
                      {r.facts.slice(0, 2).join(" · ")}
                    </div>
                  ) : null}
                  {r.description ? (
                    <div className="pcbody">
                      <p>{r.description}</p>
                    </div>
                  ) : null}
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* HIGHLIGHTS (direct-booking value props, postcard cards) */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="hand">a few good reasons</span>
            <h2>Why book with us</h2>
          </div>
          <div className="pcgrid">
            {HIGHLIGHTS.map((h, i) => (
              <div className="pc pc-note" key={i}>
                <span
                  className="stamp"
                  style={{
                    position: "absolute",
                    right: 18,
                    top: -22,
                    transform: `rotate(${h.rot}deg)`,
                  }}
                >
                  {h.emoji}
                </span>
                <h3>{h.title}</h3>
                <p>{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY (taped) */}
      {galShots.length > 0 ? (
        <section className="section soft">
          <div className="wrap">
            <div className="sec-head center">
              <span className="hand">a look around</span>
              <h2>The house, in snapshots</h2>
            </div>
            <div className="gal">
              {galShots.map((g, i) => (
                <div className="g" key={i}>
                  <div className="im">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.url}
                      alt={g.caption || brandName}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* REVIEWS */}
      {items.length > 0 ? (
        <section className="section">
          <div className="wrap">
            <div className="sec-head center">
              <span className="hand">the guest book</span>
              <h2>What people write home</h2>
            </div>
            <div className="reviews">
              {items.slice(0, 3).map((r, i) => (
                <div className="review" key={i}>
                  <span
                    className={i === 1 ? "tape b" : "tape"}
                    style={{
                      left: "50%",
                      top: -12,
                      transform: "translateX(-50%) rotate(-3deg)",
                    }}
                  />
                  <div className="stars">
                    {"★".repeat(Math.max(1, Math.min(5, Math.round(r.rating))))}
                  </div>
                  <p>{r.body}</p>
                  <div className="who">
                    <span className="av">{initials(r.author)}</span>
                    <div>
                      <div className="nm">{r.author}</div>
                      {r.date ? <div className="lo">{r.date}</div> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* LOCATION (Finding us) */}
      {location?.address ? (
        <section className="section soft">
          <div className="wrap">
            <div className="split">
              <div>
                <span className="eyebrow">Finding us</span>
                <h2 className="lg" style={{ marginTop: 14 }}>
                  {locHeading}
                </h2>
                <p
                  className="muted"
                  style={{ marginTop: 16, maxWidth: "48ch" }}
                >
                  We&apos;ll send directions and a few of our favourites when
                  you book direct with us.
                </p>
                {locPois.length > 0 ? (
                  <div className="amen" style={{ marginTop: 24 }}>
                    {locPois.map((p, i) => (
                      <div className="a" key={i}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {p.name}
                        {p.distance ? ` · ${p.distance}` : ""}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              {location.mapEmbedUrl ? (
                <div className="frame-wrap">
                  <div className="frame photo ar-43">
                    <iframe
                      src={location.mapEmbedUrl}
                      title={`Map of ${brandName}`}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                </div>
              ) : shots[2]?.url || shots[0]?.url ? (
                <div className="frame-wrap">
                  <div className="frame photo ar-43">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shots[2]?.url || shots[0]?.url}
                      alt={brandName}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA (banner) */}
      <section className="section">
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ctaImg} alt={brandName} loading="lazy" decoding="async" />
            <div className="banner-in">
              <span className="hand lg" style={{ color: "var(--site-note)" }}>
                the kettle&apos;s on
              </span>
              <h2 style={{ marginTop: 6 }}>Come stay a night or three</h2>
              <p>
                Booked direct with the house — the price you see is the price
                you pay, with breakfast and 0% booking fees.
              </p>
              <div className="pcta">
                <a href={bookHref} className="btn btn-accent btn-lg">
                  Check availability
                </a>
                <a href="/contact" className="btn btn-light btn-lg">
                  Say hello
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
