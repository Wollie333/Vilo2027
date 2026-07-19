import "./sabelaSuites.css";

import type { GalleryImage, RoomCard } from "@/lib/site/types";
import { siteImageUrl } from "@/lib/site/image";

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

/**
 * Sabela Lodge SUITES page — the founder's bespoke dark-editorial "Lodge"
 * reference design (docs/themes/sabela/pages/Suites.html body), wired to the
 * host's LIVE rooms (`rooms_preview`). Each suite renders as an editorial media
 * row (image + copy + rate + view/book actions). Empty → the design's "your
 * suites will appear here" note rather than demo rooms. Renders inside the
 * `.sbchrome` themed chrome (`hotel` preset). Scoped under `.sbsuites`.
 */
export function SabelaSuites({
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
    "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2000&q=80";

  return (
    <div className="sbsuites">
      {/* PAGE HEAD (full-bleed editorial hero) */}
      <section className="phead" data-section="intro">
        <div
          className="phead-img"
          style={{ backgroundImage: `url('${headImg}')` }}
        />
        <div className="wrap phead-in">
          <span className="crumb">
            <a href="/">Home</a>
            <span aria-hidden>/</span>
            <span className="cur">Suites</span>
          </span>
          <h1>The suites</h1>
          <p className="lead mx-auto">
            Each suite is its own private world — design-led, unhurried, and
            booked straight with {brandName}, with zero added fees.
          </p>
        </div>
      </section>

      {/* SUITES (editorial rows) — live */}
      <section
        className="section"
        style={{ paddingTop: "clamp(56px,7vw,96px)" }}
        data-section="rooms_preview"
      >
        <div className="wrap">
          {list.length === 0 ? (
            <div className="sb-empty">
              <span className="eyebrow center no-rule">Suites</span>
              <h2>Your suites will appear here</h2>
              <p className="muted">
                Add suites to {brandName} and they&apos;ll show up here
                automatically — each with its own photos, rate and booking link.
              </p>
              <div
                className="hero-cta-row"
                style={{ justifyContent: "center" }}
              >
                <a href={bookHref} className="btn btn-primary btn-lg">
                  Check availability
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="room-rows">
                {list.map((r) => {
                  const price = money(r.price, r.currency);
                  const facts = (r.facts ?? []).filter(Boolean);
                  const tag =
                    r.badge || facts.find((f) => /sleep/i.test(f)) || null;
                  const chips = facts.filter((f) => f !== tag).slice(0, 4);
                  const href = r.detailHref || r.bookHref || bookHref;
                  return (
                    <article className="room-row" key={r.id}>
                      <div className="rr-media">
                        {tag ? <span className="rc-tag">{tag}</span> : null}
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
                      <div className="rr-body">
                        <h3>{r.name}</h3>
                        {chips.length ? (
                          <div className="rr-meta">
                            {chips.map((c, i) => (
                              <span className="chip" key={i}>
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {r.description ? (
                          <p className="rr-desc">{r.description}</p>
                        ) : null}
                        <div className="rr-foot">
                          {price ? (
                            <div className="price">
                              {price} <small>/ night</small>
                            </div>
                          ) : null}
                          <a href={href} className="btn btn-ghost">
                            View suite
                          </a>
                          <a
                            href={r.bookHref || bookHref}
                            className="btn btn-primary"
                          >
                            Check dates
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* by-request enquiry strip (generic, contact-driven) */}
              <a href={contactHref} className="by-request">
                <span className="zero-badge">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                  </svg>
                  By request
                </span>
                <div className="br-copy">
                  <div className="br-title">Something more private?</div>
                  <div className="muted">
                    Tell us who&apos;s coming and when, and we&apos;ll suggest
                    the suite that suits you best — or hold the whole lodge.
                  </div>
                </div>
                <span className="link-arrow">
                  Enquire <i>{ArrowSm}</i>
                </span>
              </a>
            </>
          )}
        </div>
      </section>

      {/* CTA band */}
      <section className="section-sm" data-section="cta">
        <div className="wrap">
          <div className="cta-band">
            <span className="glow" />
            <span className="zero-badge on-dark">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Book direct · 0% booking fees
            </span>
            <h2>Ready when you are</h2>
            <p>
              Tell us your dates and we&apos;ll hold a suite — booked direct
              with the lodge, the rate you see is the rate you pay.
            </p>
            <div className="hero-cta-row">
              <a href={bookHref} className="btn btn-light btn-lg">
                Check availability
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
