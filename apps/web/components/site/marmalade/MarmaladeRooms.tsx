import "./marmaladeRooms.css";

import { siteImageUrl } from "@/lib/site/image";

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

// Direct-booking truths — brand-agnostic, always true for a Wielo host, so the
// "what's included" strip never fabricates a property-specific inclusion.
const INCLUDED = [
  "Book direct with the house",
  "The price you see is the price you pay",
  "0% booking fees",
  "Secure payment",
];

/**
 * Marmalade House ROOMS page — the founder's bespoke "Postcards" reference design,
 * wired to the host's LIVE rooms (`rooms_preview`). Each room renders as a tilted,
 * taped postcard with a floating price, live facts and a real detail/book link.
 * Empty → the design's "your rooms will appear here" note rather than demo rooms.
 * Renders inside the themed chrome. Scoped under `.mmrooms`.
 */
export function MarmaladeRooms({
  brandName,
  bookHref,
  contactHref,
  heroImageUrl,
  rooms,
  gallery,
}: {
  brandName: string;
  bookHref: string;
  contactHref: string;
  heroImageUrl?: string | null;
  rooms?: RoomCard[] | null;
  gallery?: GalleryImage[] | null;
}) {
  const shots = (gallery ?? []).filter((g) => g.url);
  const list = (rooms ?? []).filter((r) => r.name);
  const headImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=2000&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=2000&q=80";

  return (
    <div className="mmrooms">
      {/* PAGE HEAD (postcard) */}
      <section className="phero compact">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(headImg, { width: 2000 })}
            alt={`Rooms at ${brandName}`}
          />
        </div>
        <div className="postcard sm">
          <span className="stamp">✦</span>
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Rooms</span>
          </div>
          <h1>Rooms &amp; suites</h1>
          <p className="sub">
            Each one named, each its own colour and quirk — and every one with a
            key that&apos;s yours for the stay, booked straight with the house.
          </p>
        </div>
      </section>

      {/* INCLUDED */}
      <section
        className="section-sm"
        style={{ paddingTop: "clamp(40px, 5vw, 60px)" }}
      >
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

      {/* ROOMS (postcards) — live */}
      <section
        className="section"
        style={{ paddingTop: "clamp(28px, 3vw, 48px)" }}
      >
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty">
              <span className="hand">no rooms yet</span>
              <h2 className="lg" style={{ marginTop: 4 }}>
                Your rooms will appear here
              </h2>
              <p className="muted" style={{ marginTop: 14 }}>
                Add rooms to {brandName} and they&apos;ll show up here
                automatically — each with its own photo, rate and booking link.
              </p>
              <div className="pcta" style={{ justifyContent: "center" }}>
                <a href={bookHref} className="btn btn-accent btn-lg">
                  Check availability
                </a>
              </div>
            </div>
          ) : (
            <div className="pcgrid">
              {list.map((r) => {
                const price = money(r.price, r.currency);
                const facts = (r.facts ?? []).filter(Boolean);
                const meta = facts.slice(0, 2).join(" · ");
                const tagChips = facts.slice(2, 4);
                return (
                  <a
                    href={r.detailHref || r.bookHref || bookHref}
                    className="pc"
                    key={r.id}
                  >
                    <div className="pi">
                      {price ? <span className="pcprice">{price}</span> : null}
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
                    <div className="cap">{r.name}</div>
                    {meta ? <div className="meta">{meta}</div> : null}
                    {tagChips.length ? (
                      <div className="chips">
                        {tagChips.map((c, i) => (
                          <span className="chip" key={i}>
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {r.description ? (
                      <div className="pcbody">
                        <p>{r.description}</p>
                      </div>
                    ) : null}
                  </a>
                );
              })}
              {/* "not sure?" — help card, faithful to the reference */}
              <a href={contactHref} className="pc pc-help">
                <div className="hand">not sure?</div>
                <h3>We&apos;ll pick for you</h3>
                <p>
                  Tell us who&apos;s coming and we&apos;ll suggest the room that
                  suits you best.
                </p>
                <span className="btn btn-accent btn-sm">Ask the house</span>
              </a>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="section soft">
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
                the kettle&apos;s on
              </span>
              <h2 style={{ marginTop: 6 }}>Not sure which room?</h2>
              <p>
                Tell us who&apos;s coming and when, and we&apos;ll pick the
                right one and hold it for you.
              </p>
              <div className="pcta">
                <a href={bookHref} className="btn btn-accent btn-lg">
                  Check availability
                </a>
                <a href={contactHref} className="btn btn-light btn-lg">
                  Ask the house
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
