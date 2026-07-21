import "./royalAbout.css";

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

// Static "what you can count on" values — brand-agnostic, always true for a
// direct-booking host, so they never fabricate a specific claim about this
// property. Rendered as a formal, centred grand-hotel card set.
const VALUES = [
  {
    title: "Book direct, always",
    body: "Reserve straight with the house and the price never moves — no agents, no surprises at checkout.",
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
    title: "The rate you see",
    body: "The lowest price lives right here, and we say exactly what's included before you ever reserve — nothing hidden.",
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
    title: "Stay flexible",
    body: "Free cancellation up to 48 hours before arrival on every direct booking — plans change, and that's fine.",
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
 * Royal Hotel ABOUT page (preset `royal`) — its own component + stylesheet
 * (`.rabout` / royalAbout.css): the formal, CENTRED grand-hotel treatment
 * (Archivo display via `--site-font-heading`, a thin champagne rule under each
 * centred section head, a charcoal stats band with champagne numerals, a monogram
 * heritage mark) — distinct from the OceansView resort About it forked from.
 * Same content-persistence contract as every theme: story + host bio from
 * content_profile, live stats; demo copy is a fallback only, and sections that
 * would need data we don't collect are omitted rather than fabricated. Palette/
 * type come from the `.wielo-royal` skin (champagne accent, charcoal `--site-navy`).
 * Renders inside the shared themed chrome. Part of Phase C (theme differentiation).
 */
export function RoyalAbout({
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
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=2560&q=80";
  const storyImg =
    shots[1]?.url ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1600&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=2000&q=80";

  const sub =
    tagline?.trim() ||
    "The people, the address, and why we do it this way — a formal introduction before you come to stay.";

  // Story → lead + supporting paragraphs (demo fallback keeps the design intact
  // until the host writes their own in the wizard).
  const storyParas = (story ?? "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const demoStory = [
    `${brandName} began the way the best addresses do — with people who loved this corner of the city long before it had a name over the door, and couldn't bear to see it become anything less than it deserved.`,
    "We restored it slowly, keeping the good bones and the sense of arrival, and opening every room to the light. The idea was simple: a landmark that feels less like a hotel and more like the house of a friend who happens to have the best address in town.",
    "It's still run by the same people who started it, with a team who look after every detail so you don't have to. That's the whole secret, really — the stay is calm, well-run, and the price never moves.",
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

  const monogram = (brandName.trim()[0] || "R").toUpperCase();

  return (
    <div className="rabout">
      {/* PAGE HEAD — centred, formal */}
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

      {/* STORY — centred, formal */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head center" data-reveal>
            <span className="tag" style={{ justifyContent: "center" }}>
              Our story
            </span>
            <h2 className="lg" style={{ marginTop: 18 }}>
              Why we do it this way
            </h2>
          </div>
          <div className="story-col" data-reveal>
            <p className="lead">{lead}</p>
            {rest.map((p, i) => (
              <p className="muted" key={i}>
                {p}
              </p>
            ))}
          </div>
          <div className="story-fig" data-reveal>
            <div className="frame ar-32">
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
      </section>

      {/* STATS — charcoal band, champagne numerals */}
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
                  <b>{st.b}</b>
                  <span>{st.s}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* VALUES — centred head + formal card set (honest, always-true) */}
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

      {/* HERITAGE — monogram mark (grand-hotel signature) */}
      <section className="section sand">
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

      {/* HOST BIO — real content only */}
      {bio ? (
        <section className="section">
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
                Refined rooms, a team who looks after every detail, and a price
                that never moves. We&apos;ll keep a room ready for you.
              </p>
              <div className="hero-cta">
                <a href={roomsHref} className="btn btn-white btn-lg">
                  View rooms
                </a>
                <a href={contactHref} className="btn btn-on-img btn-lg">
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
