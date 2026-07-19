import "./sabelaAbout.css";

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

// Branded, always-true commitments for the direct-booking model (not host data,
// so they never fabricate a specific claim about this property). Rendered in
// Sabela's numbered editorial "values" language.
const VALUES: { title: string; body: string }[] = [
  {
    title: "Booked direct with us",
    body: "Reserve straight with the lodge — no agents, no marketplace and no commission between you and your stay.",
  },
  {
    title: "The rate you see is the rate you pay",
    body: "Zero booking fees and no hidden surcharges. Every cent goes to your stay, not to a middleman.",
  },
  {
    title: "A real person, always",
    body: "Speak to someone who actually knows the place — before you arrive, and for anything you need while you're here.",
  },
];

/**
 * Sabela Lodge ABOUT page — the founder's bespoke dark-editorial "Lodge"
 * reference design, wired to the host's content (story + host bio from
 * content_profile) with live stats and imagery, and the design's demo copy as a
 * fallback only. The host_bio section ALWAYS renders: when the host has written a
 * bio we use it verbatim; when they haven't we fall back to an honest, generic
 * "you deal with us directly" block that fills the design's shape without
 * fabricating a named person, dates, or credentials. Sections that would need
 * data we don't collect (a multi-year timeline, conservation figures) are
 * intentionally omitted rather than invented. Renders inside the `.sbchrome`
 * themed chrome (`hotel` preset). Scoped under `.sbabout`.
 */
export function SabelaAbout({
  brandName,
  roomsHref,
  contactHref,
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
  contactHref: string;
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

  const introImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=900&q=80";
  const hostImg =
    hostPhotoUrl ||
    shots[1]?.url ||
    "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=800&q=80";

  const sub = tagline?.trim() || null;

  // Story → lead + supporting paragraphs (demo fallback keeps the design intact
  // until the host writes their own in the wizard).
  const storyParas = (story ?? "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const demoStory = [
    `${brandName} was built to disappear into its setting — a handful of rooms set lightly into the landscape, with nothing between you and the quiet.`,
    "We kept it small on purpose. Fewer rooms means unhurried days, real attention, and the sense that the place is yours for as long as you stay. The idea was never to compete with the surroundings, only to give you the best seat in front of them.",
  ];
  const paras = storyParas.length ? storyParas : demoStory;
  const lead = paras[0];
  const rest = paras.slice(1);

  // Host bio — the section ALWAYS renders. When the host has written a bio we
  // use it; otherwise an honest generic fallback about the direct-booking /
  // personally-hosted model (true for any host, invents no names or numbers).
  const bio = (hostBioBody ?? "").trim();
  const hasBio = bio.length > 0;
  const hostEyebrow = hasBio ? "Your hosts" : "The people behind the stay";
  const hostHeading = hasBio
    ? "The people behind the stay"
    : "You'll deal with us — directly";
  const hostParas = hasBio
    ? bio
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [
        `When you book ${brandName} you book straight with the people who run it — no agency, no call-centre, no queue. A real person reads your message and answers you directly, so every detail of your stay is handled by someone who actually knows the place.`,
        "We keep the team small on purpose. The same people who take your booking are the ones who greet you on arrival and look after you while you're here — which is exactly how a stay should feel.",
      ];

  // Derived stats (live) for the intro row. Only real numbers — never fabricated.
  const avg = reviews?.average ?? null;
  const count = reviews?.count ?? reviews?.items?.length ?? 0;
  const roomCount = (rooms ?? []).length;
  const stats: { n: string; l: string }[] = [];
  if (roomCount)
    stats.push({
      n: String(roomCount),
      l: roomCount === 1 ? "Suite only" : "Suites only",
    });
  if (avg != null) stats.push({ n: avg.toFixed(2), l: "Guest rating" });
  if (count) stats.push({ n: commas(count), l: "Verified stays" });
  stats.push({ n: "0%", l: "Booking fees" });

  const galShots = shots.slice(0, 3);
  const galSpan = (i: number): string => (i === 0 ? "g span2" : "g");

  return (
    <div className="sbabout">
      {/* PAGE HEAD (centred, interior-page convention) */}
      <section className="page-head" data-section="hero">
        <div className="wrap-narrow">
          <span className="eyebrow center">The lodge</span>
          <h1>The story behind the stay</h1>
          {sub ? <p className="lead mx-auto">{sub}</p> : null}
        </div>
      </section>

      {/* INTRO (split — media + story + live stats) */}
      <section className="section-tight" data-section="intro">
        <div className="wrap">
          <div className="split">
            <div className="split-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={introImg}
                alt={brandName}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div>
              <p className="lead ink">{lead}</p>
              {rest.map((p, i) => (
                <p key={i} className="muted intro-p">
                  {p}
                </p>
              ))}
              {stats.length >= 2 ? (
                <div className="stat-row">
                  {stats.slice(0, 3).map((st, i) => (
                    <div className="stat" key={i}>
                      <div className="n">{st.n}</div>
                      <div className="l">{st.l}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* HOST BIO — ALWAYS rendered (host's own bio, or an honest fallback) */}
      <section className="section soft-bg" data-section="host_bio">
        <div className="wrap">
          <div className="host">
            <div className="host-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hostImg}
                alt={`Your host at ${brandName}`}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div>
              <span className="eyebrow">{hostEyebrow}</span>
              <h2 className="host-h">{hostHeading}</h2>
              {hostParas.map((p, i) => (
                <p key={i} className="muted host-p">
                  {p}
                </p>
              ))}
              <a href={contactHref} className="link-arrow host-link">
                Say hello {ArrowSm}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES (numbered direct-booking commitments) */}
      <section className="section" data-section="values">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">What we stand for</span>
            <h2>Three commitments behind every stay</h2>
          </div>
          <div className="values">
            {VALUES.map((v, i) => (
              <div className="value" key={i}>
                <div className="vn">{`0${i + 1}`}</div>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY (mosaic) — live only */}
      {galShots.length > 0 ? (
        <section className="section-sm soft-bg" data-section="gallery">
          <div className="wrap">
            <div className="sec-head center">
              <span className="eyebrow center no-rule">
                Moments at {brandName}
              </span>
              <h2>The place, in fragments</h2>
            </div>
            <div className="gallery">
              {galShots.map((g, i) => (
                <div className={galSpan(i)} key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.url}
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

      {/* CTA band */}
      <section className="section-sm" data-section="cta">
        <div className="wrap">
          <div className="cta-band">
            <span className="glow" />
            <h2>Come see it for yourself</h2>
            <p>
              It&apos;s at its most generous when you have nowhere else to be.
              Find your dates and book direct — the rate you see is the rate you
              pay.
            </p>
            <div className="hero-cta-row">
              <a href={roomsHref} className="btn btn-light btn-lg">
                Explore the suites
              </a>
              <a href={contactHref} className="btn btn-on-dark btn-lg">
                Speak to us
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
