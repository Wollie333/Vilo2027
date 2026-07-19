import "./marmaladeAbout.css";

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

// Branded, always-true "house rules" for the direct-booking model (not host data,
// so they never fabricate a specific claim about this property). Styled as the
// reference's centred, photo-less postcard cards.
const VALUES: { title: string; body: string }[] = [
  {
    title: "Book direct, always",
    body: "Reserve straight with the house and the price never moves — no agents, no surcharges, no fee at checkout.",
  },
  {
    title: "Nothing hidden",
    body: "The rate you see is the rate you pay, and we say exactly what's included before you ever book.",
  },
  {
    title: "A real person answers",
    body: "Before your stay and during it — ask us anything, we'd honestly rather you did.",
  },
  {
    title: "Genuinely local",
    body: "The people who look after you know the village by heart — the best coffee, the quiet walks, the sunset spots.",
  },
];

/**
 * Marmalade House ABOUT page — the founder's bespoke "Postcards" reference design,
 * wired to the host's content (story + host bio from content_profile) with live
 * stats and imagery, and the design's demo copy as a fallback only. Sections that
 * would need data we don't collect (a multi-year timeline, a full team roster) are
 * intentionally omitted rather than fabricated; the host writes real content via
 * the wizard. Renders inside the themed chrome. Scoped under `.mmabout`.
 */
export function MarmaladeAbout({
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
  const brandInitial = (brandName.trim()[0] || "M").toUpperCase();

  const headImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=2000&q=80";
  const storyImg =
    shots[1]?.url ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=900&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    headImg ||
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=2000&q=80";

  const sub =
    tagline?.trim() ||
    "We didn't set out to run a guesthouse. We set out to save an old house — and couldn't bear to keep it to ourselves.";

  // Story → lead + supporting paragraphs (demo fallback keeps the design intact
  // until the host writes their own in the wizard).
  const storyParas = (story ?? "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const demoStory = [
    `${brandName} began the way the best places do — with people who loved this spot long before it had a name over the door, and couldn't bear to see it become anything less than it deserved.`,
    "We rebuilt it slowly, by hand, keeping the good bones and opening every wall we could to the light. The idea was simple: somewhere that feels less like a hotel and more like the house of a friend who happens to have the best address in town.",
    "It's still run by the same people who started it. That's the whole secret, really — we actually live here, and we'd love for you to feel like you do too.",
  ];
  const paras = storyParas.length ? storyParas : demoStory;
  const lead = paras[0];
  const rest = paras.slice(1);

  // Host bio — only rendered when the host has actually written one.
  const bio = (hostBioBody ?? "").trim();

  // Derived stats (live). Only shown when we have at least three real numbers.
  const avg = reviews?.average ?? null;
  const count = reviews?.count ?? reviews?.items?.length ?? 0;
  const roomCount = (rooms ?? []).length;
  const stats: { b: string; s: string }[] = [];
  if (roomCount)
    stats.push({
      b: String(roomCount),
      s: roomCount === 1 ? "Room" : "Rooms, all different",
    });
  if (avg != null) stats.push({ b: avg.toFixed(2), s: "Guest rating" });
  if (count) stats.push({ b: commas(count), s: "Verified reviews" });
  stats.push({ b: "0%", s: "Booking fees" });

  const galShots = shots.slice(0, 4);

  return (
    <div className="mmabout">
      {/* HERO (compact postcard) */}
      <section className="phero compact">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={siteImageUrl(headImg, { width: 2000 })} alt={brandName} />
        </div>
        <div className="postcard sm">
          <span className="stamp">{brandInitial}</span>
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>The House</span>
          </div>
          <h1>A house with stories</h1>
          <p className="sub">{sub}</p>
        </div>
      </section>

      {/* STORY (split) */}
      <section className="section">
        <div className="wrap">
          <div className="split w-left">
            <div>
              <span className="eyebrow">Our story</span>
              <h2 className="lg" style={{ marginTop: 16 }}>
                Why we do it this way
              </h2>
              <p className="lead" style={{ marginTop: 20 }}>
                {lead}
              </p>
              {rest.map((p, i) => (
                <p
                  key={i}
                  className="muted"
                  style={{ marginTop: 14, maxWidth: "54ch" }}
                >
                  {p}
                </p>
              ))}
              <div className="hand lg" style={{ marginTop: 22 }}>
                — see you at breakfast
              </div>
            </div>
            <div className="frame-wrap">
              <div className="frame photo ar-45">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={siteImageUrl(storyImg, { width: 1100 })}
                  alt={brandName}
                  loading="lazy"
                  decoding="async"
                />
                <span className="photo-cap">a corner of the house</span>
              </div>
              <span
                className="tape"
                style={{ left: 24, top: -12, transform: "rotate(-7deg)" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      {stats.length >= 3 ? (
        <section className="section-sm">
          <div className="wrap">
            <div className="statrow">
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

      {/* VALUES (postcards) */}
      <section className="section soft">
        <div className="wrap">
          <div className="sec-head center">
            <span className="hand">how we do things</span>
            <h2>A few house rules we keep</h2>
          </div>
          <div className="pcgrid two">
            {VALUES.map((v, i) => (
              <div className="pc pc-note" key={i}>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOST BIO — real content only */}
      {bio ? (
        <section className="section">
          <div className="wrap">
            <div className="split">
              <div className="frame-wrap">
                <div className="frame photo ar-45">
                  {hostPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteImageUrl(hostPhotoUrl, { width: 1100 })}
                      alt={`Your host at ${brandName}`}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteImageUrl(storyImg, { width: 1100 })}
                      alt={brandName}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <span className="photo-cap">the two of us</span>
                </div>
                <span
                  className="tape"
                  style={{ left: -14, top: 20, transform: "rotate(-8deg)" }}
                />
              </div>
              <div>
                <span className="eyebrow">Your hosts</span>
                <h2 className="lg" style={{ marginTop: 16 }}>
                  The people behind the stay
                </h2>
                {bio.split(/\n{2,}/).map((p, i) => (
                  <p
                    key={i}
                    className={i === 0 ? "lead" : "muted"}
                    style={{ marginTop: i === 0 ? 20 : 14, maxWidth: "54ch" }}
                  >
                    {p.trim()}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* GALLERY (taped) — live only */}
      {galShots.length > 0 ? (
        <section className="section soft">
          <div className="wrap">
            <div className="sec-head center">
              <span className="hand">around the house</span>
              <h2>Bits and pieces of home</h2>
            </div>
            <div className="gal">
              {galShots.map((g, i) => (
                <div className="g" key={i}>
                  <div className="im">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={siteImageUrl(g.url, { width: 800 })}
                      alt={g.caption || brandName}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  {g.caption ? <div className="cap">{g.caption}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA (banner) */}
      <section className="section">
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteImageUrl(ctaImg, { width: 1600 })}
              alt={brandName}
              loading="lazy"
              decoding="async"
            />
            <div className="banner-in">
              <span className="hand lg" style={{ color: "var(--site-note)" }}>
                come for breakfast
              </span>
              <h2 style={{ marginTop: 6 }}>
                There&apos;s a room with your name on it
              </h2>
              <p>
                Well — once you&apos;ve booked. Real rooms, real people, and a
                price that never moves, booked direct with the house.
              </p>
              <div className="pcta">
                <a href={roomsHref} className="btn btn-accent btn-lg">
                  See the rooms
                </a>
                <a href={contactHref} className="btn btn-light btn-lg">
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
