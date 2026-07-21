import "./oceansSpecials.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";
import type { GalleryImage, SpecialCard } from "@/lib/site/types";

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

/**
 * Oceans View OFFERS page — the founder's bespoke reference design, wired to the
 * host's LIVE specials (`specials_preview`). Each renders as a card with the
 * host's badge, live now/was price, savings and a real deep-link into the
 * booking engine. Empty → the design's "no offers yet" placeholder rather than
 * demo cards. Renders inside the themed chrome. Scoped under `.ovspecials`.
 */
export function OceansViewSpecials({
  brandName,
  contactHref = "/contact",
  roomsHref = "/rooms",
  subheadline,
  heroImageUrl,
  specials,
  gallery,
}: {
  brandName: string;
  contactHref?: string;
  roomsHref?: string;
  subheadline?: string | null;
  heroImageUrl?: string | null;
  specials?: SpecialCard[] | null;
  gallery?: GalleryImage[] | null;
}) {
  const shots = (gallery ?? []).filter((g) => g.url);
  const list = (specials ?? []).filter((s) => s.title);
  const headImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=2200&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=2000&q=80";

  const sub =
    subheadline?.trim() ||
    "A handful of direct-only rates for the unhurried, the spontaneous and the long-stayers. Every one booked direct — the price you see is the price you pay.";

  return (
    <div className="ovspecials">
      {/* PAGE HEAD */}
      <section className="phead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={siteImageUrl(headImg, { width: 2560 })}
          alt={`Offers at ${brandName}`}
        />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Offers</span>
          </div>
          <h1>Offers &amp; seasons</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* SPECIALS GRID — live */}
      <section className="section">
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty">
              <h2 className="lg">No offers running right now</h2>
              <p className="muted" style={{ marginTop: 14 }}>
                When {brandName} launches a special it appears here
                automatically. In the meantime, the everyday direct rate is
                already the best you&apos;ll find.
              </p>
              <div className="hero-cta" style={{ justifyContent: "center" }}>
                <a href={roomsHref} className="btn btn-primary btn-lg">
                  See the rooms
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Say hello
                </a>
              </div>
            </div>
          ) : (
            <div className="spx">
              {list.map((s, i) => {
                const now = money(s.price, s.currency);
                const was = money(s.wasPrice, s.currency);
                const per = s.priceMode === "flat" ? "package" : "/ night";
                const save =
                  s.savingsPct != null && s.savingsPct > 0
                    ? `Save ${s.savingsPct}%`
                    : s.savingsAmount != null && s.savingsAmount > 0
                      ? `Save ${money(s.savingsAmount, s.currency)}`
                      : null;
                const img =
                  s.imageUrl ||
                  shots[0]?.url ||
                  "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&q=80";
                return (
                  <article
                    className="spcard"
                    key={s.id}
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 3) * 90}ms` } as CSSProperties
                    }
                  >
                    <div className="spi">
                      {s.badge ? (
                        <span className="sp-badge">{s.badge}</span>
                      ) : null}
                      {s.remaining != null && s.remaining <= 5 ? (
                        <span className="sp-left">Only {s.remaining} left</span>
                      ) : null}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={siteImageUrl(img, { width: 800 })}
                        alt={s.title}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="spb">
                      <h3>{s.title}</h3>
                      {s.description ? (
                        <p className="spd">{s.description}</p>
                      ) : null}
                      {now ? (
                        <div className="sp-px">
                          <span className="sp-now">{now}</span>
                          <span className="sp-per">{per}</span>
                          {was && s.savingsAmount ? (
                            <span className="sp-was">{was}</span>
                          ) : null}
                          {save ? (
                            <span className="sp-save">{save}</span>
                          ) : null}
                        </div>
                      ) : null}
                      <a
                        href={s.detailHref ?? s.bookHref}
                        className="btn btn-primary btn-block"
                      >
                        View offer
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ paddingTop: 0 }}>
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
              <span className="hero-chip">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>{" "}
                Booked direct
              </span>
              <h2 style={{ marginTop: 18 }}>Be first to hear the next offer</h2>
              <p>
                Our best rates rarely last. Say hello and we&apos;ll let you
                know the moment one opens.
              </p>
              <div className="hero-cta">
                <a href={contactHref} className="btn btn-white btn-lg">
                  Get in touch
                </a>
                <a href={roomsHref} className="btn btn-on-img btn-lg">
                  See the rooms
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
