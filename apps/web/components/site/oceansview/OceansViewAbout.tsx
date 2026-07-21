import "./oceansAbout.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";
import type { GalleryImage, ReviewsData, RoomCard } from "@/lib/site/types";

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

// Static "how we run it" values — brand-agnostic, always true for a direct-booking
// host, so they never fabricate a specific claim about this property.
const VALUES = [
  {
    title: "Book direct, always",
    body: "Reserve straight with us and the price never moves — no agents, no resort fees, no surprises at checkout.",
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
    title: "Genuinely local",
    body: "The people who look after you know the area by heart — the best coffee, the quiet coves, the sunset spots.",
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
        <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" />
        <circle cx="12" cy="10" r="2.4" />
      </svg>
    ),
  },
  {
    title: "Nothing hidden",
    body: "The rate you see is the rate you pay, and we say exactly what's included before you ever book.",
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
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.7-.9 1.4v.4" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
  {
    title: "Here when you need us",
    body: "A real person answers, before your stay and during it. Ask us anything — we'd rather you did.",
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

/**
 * Oceans View ABOUT page — the founder's bespoke reference design, wired to the
 * host's content (story + host bio from content_profile) with live stats and the
 * design's demo copy as fallback only. The sections that would need data we don't
 * collect (a multi-year timeline, a full team roster) are intentionally omitted
 * rather than fabricated; the host adds real content via the wizard. Renders
 * inside the themed chrome. Scoped under `.ovabout`.
 */
export function OceansViewAbout({
  brandName,
  roomsHref,
  contactHref = "/contact",
  heroImageUrl,
  tagline,
  story,
  hostBioBody,
  hostPhotoUrl,
  rooms,
  reviews,
  gallery,
}: {
  brandName: string;
  roomsHref: string;
  contactHref?: string;
  heroImageUrl?: string | null;
  tagline?: string | null;
  story?: string | null;
  hostBioBody?: string | null;
  hostPhotoUrl?: string | null;
  rooms?: RoomCard[] | null;
  reviews?: ReviewsData | null;
  gallery?: GalleryImage[] | null;
}) {
  const shots = (gallery ?? []).filter((g) => g.url);
  const headImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=2200&q=80";
  const storyImg =
    shots[1]?.url ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1100&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=2000&q=80";

  const sub =
    tagline?.trim() ||
    "The people, the place, and why we do it this way — a quick introduction before you come to stay.";

  // Story → lead + supporting paragraphs (demo fallback keeps the design intact
  // until the host writes their own in the wizard).
  const storyParas = (story ?? "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const demoStory = [
    `${brandName} began the way the best places do — with people who loved this spot long before it had a name over the door, and couldn't bear to see it become anything less than it deserved.`,
    "We rebuilt it slowly, by hand, keeping the good bones and opening up every wall we could to the light. The idea was simple: somewhere that feels less like a hotel and more like the house of a friend who happens to have the best address in town.",
    "It's still run by the same people who started it, with a team who mostly grew up nearby. That's the whole secret, really — we actually live here, and we'd love for you to feel like you do too.",
  ];
  const paras = storyParas.length ? storyParas : demoStory;
  const lead = paras[0];
  const rest = paras.slice(1);

  // Host bio — only rendered when the host has actually written one.
  const bio = (hostBioBody ?? "").trim();

  // Derived stats (live). Mirrors the home page's rule.
  const avg = reviews?.average ?? null;
  const count = reviews?.count ?? reviews?.items?.length ?? 0;
  const roomCount = (rooms ?? []).length;
  const stats: { b: string; s: string }[] = [];
  if (roomCount)
    stats.push({
      b: String(roomCount),
      s: roomCount === 1 ? "Room" : "Rooms & suites",
    });
  if (avg != null) stats.push({ b: avg.toFixed(1), s: "Guest rating" });
  if (count) stats.push({ b: commas(count), s: "Verified reviews" });

  return (
    <div className="ovabout">
      {/* PAGE HEAD */}
      <section className="phead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={siteImageUrl(headImg, { width: 2560 })} alt={brandName} />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>About</span>
          </div>
          <h1>The story behind {brandName}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* STORY */}
      <section className="section">
        <div className="wrap">
          <div className="split w-left" data-reveal>
            <div>
              <span className="tag">Our story</span>
              <h2 className="lg" style={{ marginTop: 18 }}>
                Why we do it this way
              </h2>
              <p className="lead" style={{ marginTop: 22 }}>
                {lead}
              </p>
              {rest.map((p, i) => (
                <p
                  key={i}
                  className="muted"
                  style={{ marginTop: 18, maxWidth: "56ch" }}
                >
                  {p}
                </p>
              ))}
            </div>
            <div className="frame-wrap" style={{ position: "relative" }}>
              <div className="frame ar-45">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={siteImageUrl(storyImg, { width: 1600 })}
                  alt={brandName}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      {stats.length >= 3 ? (
        <section className="section-sm navy">
          <div className="wrap">
            <div className="stats">
              {stats.slice(0, 4).map((st, i) => (
                <div
                  className="stat"
                  key={i}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 80}ms` } as CSSProperties}
                >
                  <b style={{ color: "var(--site-secondary, #ff6b57)" }}>
                    {st.b}
                  </b>
                  <span style={{ color: "var(--site-navy-mute, #9fbcc4)" }}>
                    {st.s}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* VALUES */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head center" data-reveal>
            <span className="tag" style={{ justifyContent: "center" }}>
              How we run it
            </span>
            <h2 className="lg" style={{ marginTop: 18 }}>
              What you can count on
            </h2>
          </div>
          <div className="tiles">
            {VALUES.map((v, i) => (
              <div
                className="tile"
                key={i}
                data-reveal
                style={{ "--reveal-delay": `${i * 80}ms` } as CSSProperties}
              >
                <div className="ic">{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOST BIO — real content only */}
      {bio ? (
        <section className="section sand">
          <div className="wrap">
            <div className="split" data-reveal>
              <div className="frame-wrap">
                <div className="frame ar-45">
                  {hostPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteImageUrl(hostPhotoUrl, { width: 1600 })}
                      alt={`Your host at ${brandName}`}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteImageUrl(storyImg, { width: 1600 })}
                      alt={brandName}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </div>
              </div>
              <div>
                <span className="tag">Your host</span>
                <h2 className="lg" style={{ marginTop: 18 }}>
                  The person behind the stay
                </h2>
                {bio.split(/\n{2,}/).map((p, i) => (
                  <p
                    key={i}
                    className={i === 0 ? "lead" : "muted"}
                    style={{ marginTop: i === 0 ? 22 : 18, maxWidth: "56ch" }}
                  >
                    {p.trim()}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA */}
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
              <h2>Come stay with us</h2>
              <p>
                Real rooms, real people, and a price that never moves.
                We&apos;ll keep a spot warm for you.
              </p>
              <div className="hero-cta">
                <a href={roomsHref} className="btn btn-white btn-lg">
                  View rooms
                </a>
                <a href={contactHref} className="btn btn-on-img btn-lg">
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
