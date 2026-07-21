import "./safariAbout.css";

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

// Static "how we run it" values — brand-agnostic, always true for a direct-booking
// host, so they never fabricate a specific claim about this property. Shown as an
// editorial ruled roster (not a card grid), matching the Safari identity.
const VALUES: { k: string; title: string; body: string }[] = [
  {
    k: "01",
    title: "Book direct, always",
    body: "Reserve straight with the lodge and the price never moves — no agents, no resort fees, no surprises at checkout.",
  },
  {
    k: "02",
    title: "Genuinely local",
    body: "The people who look after you know this bush by heart — the best light, the quiet waterholes, where the game moves at dusk.",
  },
  {
    k: "03",
    title: "Nothing hidden",
    body: "The rate you see is the rate you pay, and we say exactly what's included before you ever book.",
  },
  {
    k: "04",
    title: "Here when you need us",
    body: "A real person answers, before your stay and during it. Ask us anything — we'd rather you did.",
  },
];

/**
 * Safari (NenGama Lodge) ABOUT page (preset `safari`) — its own component +
 * stylesheet (`.sfabout` / safariAbout.css): the warm, airy, editorial lodge
 * treatment (Fraunces display, hairline rules, asymmetric story split, inline
 * ruled stat numerals, an editorial values roster) — distinct from the OceansView
 * resort About. Wired to the host's content (story + host bio from
 * content_profile) with live stats; demo copy is fallback only, and sections that
 * would need data we don't collect are omitted rather than fabricated. Renders
 * inside the shared themed chrome. Phase B (theme differentiation — subpages).
 */
export function SafariAbout({
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
    "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2560&q=80";
  const storyImg =
    shots[1]?.url ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1547970810-dc1eac37d174?w=1100&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?w=2000&q=80";

  const sub =
    tagline?.trim() ||
    "The people, the place, and why we do it this way — a quick introduction before you come to stay.";

  // Story → lead + supporting paragraphs (demo fallback keeps the design intact).
  const storyParas = (story ?? "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const demoStory = [
    `${brandName} began the way the best places do — with people who loved this stretch of bush long before it had a name over the gate, and couldn't bear to see it become anything less than it deserved.`,
    "We built it slowly, keeping the land as we found it and opening every room to the light and the plain beyond. The idea was simple: somewhere that feels less like a hotel and more like a friend's camp — if that friend happened to wake to elephant at the waterhole.",
    "It's still run by the same people who started it, with a team who mostly grew up nearby. That's the whole secret, really — we actually live here, and we'd love for you to feel like you do too.",
  ];
  const paras = storyParas.length ? storyParas : demoStory;
  const lead = paras[0];
  const rest = paras.slice(1);

  const bio = (hostBioBody ?? "").trim();

  // Derived stats (live).
  const avg = reviews?.average ?? null;
  const count = reviews?.count ?? reviews?.items?.length ?? 0;
  const roomCount = (rooms ?? []).length;
  const stats: { b: string; s: string }[] = [];
  if (roomCount)
    stats.push({
      b: String(roomCount),
      s: roomCount === 1 ? "Room" : "Rooms & tents",
    });
  if (avg != null) stats.push({ b: avg.toFixed(1), s: "Guest rating" });
  if (count) stats.push({ b: commas(count), s: "Verified reviews" });

  return (
    <div className="sfabout">
      {/* PAGE HEAD */}
      <section className="sf-phead">
        <div className="sf-phead-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={siteImageUrl(headImg, { width: 2560 })} alt={brandName} />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-phead-in">
          <div className="sf-coverline on-photo">
            <span>{brandName}</span>
            <span className="sf-folio">The Field Journal · Our Story</span>
          </div>
          <nav className="sf-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <span>About</span>
          </nav>
          <h1>The story behind {brandName}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* STORY — asymmetric editorial split */}
      <section className="sf-sec">
        <div className="wrap">
          <div className="sf-story">
            <div className="sf-story-copy" data-reveal>
              <span className="sf-secnum" aria-hidden>
                I
              </span>
              <span className="sf-eyebrow">Our story</span>
              <h2 className="sf-h2">Why we do it this way</h2>
              <p className="sf-lead sf-drop">{lead}</p>
              {rest.map((p, i) => (
                <p className="sf-muted" key={i}>
                  {p}
                </p>
              ))}
            </div>
            <div className="sf-story-fig" data-reveal>
              <div className="sf-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={siteImageUrl(storyImg, { width: 1100 })}
                  alt={brandName}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS — inline oversized ruled numerals */}
      {stats.length >= 3 ? (
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

      {/* VALUES — editorial ruled roster */}
      <section className="sf-sec sf-sand">
        <div className="wrap">
          <div className="sf-sechead" data-reveal>
            <span className="sf-secnum" aria-hidden>
              II
            </span>
            <span className="sf-eyebrow">How we run it</span>
            <h2 className="sf-h2">What you can count on</h2>
          </div>
          <div className="sf-values">
            {VALUES.map((v, i) => (
              <div
                className="sf-value"
                key={i}
                data-reveal
                style={
                  { "--reveal-delay": `${(i % 2) * 80}ms` } as CSSProperties
                }
              >
                <span className="sf-value-k" aria-hidden>
                  {v.k}
                </span>
                <div>
                  <h3>{v.title}</h3>
                  <p>{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOST BIO — real content only */}
      {bio ? (
        <section className="sf-sec">
          <div className="wrap">
            <div className="sf-story rev">
              <div className="sf-story-fig" data-reveal>
                <div className="sf-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={siteImageUrl(hostPhotoUrl || storyImg, {
                      width: 1100,
                    })}
                    alt={`Your host at ${brandName}`}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
              <div className="sf-story-copy" data-reveal>
                <span className="sf-secnum" aria-hidden>
                  III
                </span>
                <span className="sf-eyebrow">Your host</span>
                <h2 className="sf-h2">The person behind the stay</h2>
                {bio.split(/\n{2,}/).map((p, i) =>
                  i === 0 ? (
                    <p className="sf-lead" key={i}>
                      {p.trim()}
                    </p>
                  ) : (
                    <p className="sf-muted" key={i}>
                      {p.trim()}
                    </p>
                  ),
                )}
              </div>
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
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-cta-in" data-reveal>
          <span className="sf-eyebrow on-dark">Come stay with us</span>
          <h2>Real rooms, real people</h2>
          <p>
            A price that never moves and a spot kept warm for you. Come see the
            plain wake up.
          </p>
          <div className="sf-cta-row">
            <a href={roomsHref} className="sf-btn sf-btn-solid sf-btn-lg">
              View the rooms
            </a>
            <a href={contactHref} className="sf-btn sf-btn-line sf-btn-lg">
              Say hello {Arrow}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
