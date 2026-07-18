import "./oceansRooms.css";

import type { GalleryImage, RoomCard } from "@/lib/site/types";

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

// A single, consistent fact icon — our live facts are plain strings ("Sleeps 4",
// "2 beds", "Ensuite"), so we don't fabricate a bespoke icon per fact.
const FactIcon = (
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
    <path d="M5 12.5 10 17l9-9" />
  </svg>
);

// Direct-booking truths — brand-agnostic, always true for a Wielo host, so the
// "what you get" bar never fabricates a property-specific inclusion.
const INCLUDED = [
  "Book direct with the host",
  "The price you see is the price you pay",
  "0% booking fees",
  "Secure payment",
];

/**
 * Oceans View ROOMS page — the founder's bespoke reference design, wired to the
 * host's LIVE rooms (`rooms_preview`). Each room renders as an alternating
 * image/detail split with a floating price badge, live facts and real book /
 * view links. Empty state shows the design's placeholder rather than demo rooms.
 * Renders inside the themed chrome. Scoped under `.ovrooms`.
 */
export function OceansViewRooms({
  brandName,
  bookHref,
  contactHref = "/contact",
  subheadline,
  heroImageUrl,
  rooms,
  gallery,
}: {
  brandName: string;
  bookHref: string;
  contactHref?: string;
  subheadline?: string | null;
  heroImageUrl?: string | null;
  rooms?: RoomCard[] | null;
  gallery?: GalleryImage[] | null;
}) {
  const shots = (gallery ?? []).filter((g) => g.url);
  const list = (rooms ?? []).filter((r) => r.name);
  const headImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=2200&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=2000&q=80";

  const sub =
    subheadline?.trim() ||
    "Every one of them faces the light. Choose your view — a breezy room, a suite to linger in, or the whole floor to yourself.";

  return (
    <div className="ovrooms">
      {/* PAGE HEAD */}
      <section className="phead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={headImg} alt={`Rooms at ${brandName}`} />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Rooms</span>
          </div>
          <h1>Rooms &amp; suites</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* INCLUDED BAR */}
      <section className="section-sm sand">
        <div className="wrap">
          <div className="included">
            {INCLUDED.map((c) => (
              <span className="chip" key={c}>
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ROOMS — live, alternating splits */}
      {list.length === 0 ? (
        <section className="section">
          <div className="wrap">
            <div className="empty">
              <h2 className="lg">Your rooms will appear here</h2>
              <p className="muted" style={{ marginTop: 14 }}>
                Add rooms to {brandName} and they&apos;ll show up here
                automatically — each with its own photos, rate and booking link.
              </p>
              <div className="hero-cta" style={{ justifyContent: "center" }}>
                <a href={bookHref} className="btn btn-primary btn-lg">
                  Check availability
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : (
        list.map((r, i) => {
          const reversed = i % 2 === 1;
          const price = money(r.price, r.currency);
          const facts = (r.facts ?? []).filter(Boolean);
          const badge = r.badge?.trim();
          const tag = badge || facts[0] || null;
          const amen = badge ? facts.slice(0, 4) : facts.slice(1, 5);
          const img =
            r.imageUrl ||
            shots[i]?.url ||
            "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80";

          const figure = (
            <div className="frame-wrap">
              <div className="frame ar-43">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={r.name} />
              </div>
              {price ? (
                <div
                  className="float-badge"
                  style={
                    reversed
                      ? { left: -14, bottom: -20 }
                      : { right: -14, bottom: -20 }
                  }
                >
                  <b>{price}</b>
                  <span>Per night</span>
                </div>
              ) : null}
            </div>
          );

          const detail = (
            <div>
              {tag ? <span className="tag">{tag}</span> : null}
              <h2 className="lg room-name">{r.name}</h2>
              {r.description ? (
                <p
                  className="muted"
                  style={{ marginTop: 18, maxWidth: "52ch" }}
                >
                  {r.description}
                </p>
              ) : null}
              {amen.length ? (
                <div className="amen">
                  {amen.map((a, j) => (
                    <div className="a" key={j}>
                      {FactIcon}
                      {a}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="room-cta">
                {r.detailHref ? (
                  <a href={r.detailHref} className="btn btn-ghost">
                    View room
                  </a>
                ) : null}
                <a
                  href={r.bookHref}
                  data-wielo-book
                  className="btn btn-primary"
                >
                  {price ? `Book · ${price}` : "Book now"}
                </a>
              </div>
            </div>
          );

          return (
            <section
              className={reversed ? "section sand" : "section"}
              key={r.id}
            >
              <div className="wrap">
                <div className={reversed ? "split w-left rev" : "split w-left"}>
                  {reversed ? (
                    <>
                      {detail}
                      {figure}
                    </>
                  ) : (
                    <>
                      {figure}
                      {detail}
                    </>
                  )}
                </div>
              </div>
            </section>
          );
        })
      )}

      {/* CTA */}
      <section className="section-sm" style={{ paddingBottom: 130 }}>
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ctaImg} alt={brandName} />
            <div className="banner-in">
              <h2>Not sure which room?</h2>
              <p>
                Tell us who&apos;s coming and when — we&apos;ll suggest the
                right fit and hold it for you.
              </p>
              <div className="hero-cta">
                <a href={contactHref} className="btn btn-white btn-lg">
                  Ask the team
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
