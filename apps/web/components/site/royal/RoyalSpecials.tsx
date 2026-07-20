import "./royalSpecials.css";

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
 * Royal Hotel OFFERS page (preset `royal`) — the founder's bespoke GRAND-HOTEL
 * design, forked from OceansViewSpecials into Royal's own component + stylesheet
 * (`.rspecials` / royalSpecials.css): a centred, champagne-ruled formal page head
 * over a framed editorial hero, the host's LIVE specials as a refined card grid
 * (champagne badge/scarcity + live now/was/save + a real deep-link into the
 * booking engine), and a closing CTA banner. Wired to the host's real specials
 * (`specials_preview`) with the SAME data contract as every theme — the live
 * `.filter` + empty-state logic is preserved exactly (empty → the design's "no
 * offers yet" placeholder, never demo cards). Colour/type/shape come from the
 * `.wielo-royal` skin's `--site-*` tokens (champagne accent, espresso secondary,
 * charcoal navy, Archivo headings). Renders inside the shared themed chrome.
 */
export function RoyalSpecials({
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
    <div className="rspecials">
      {/* PAGE HEAD — centred, formal, champagne-ruled */}
      <section className="rhead">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span className="sep">·</span>
            <span>Offers</span>
          </nav>
          <span className="tag">Direct-only rates</span>
          <h1 className="xl">Offers &amp; seasons</h1>
          <p className="lead">{sub}</p>
        </div>
      </section>

      {/* EDITORIAL HERO — framed grand-hotel band */}
      <section className="wrap">
        <div className="rhero" data-reveal>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(headImg, { width: 2560 })}
            alt={`Offers at ${brandName}`}
          />
        </div>
      </section>

      {/* SPECIALS GRID — live */}
      <section className="section">
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty" data-reveal>
              <h2 className="lg">No offers running right now</h2>
              <p className="muted" style={{ marginTop: 14 }}>
                When {brandName} launches a special it appears here
                automatically. In the meantime, the everyday direct rate is
                already the best you&apos;ll find.
              </p>
              <div className="hero-cta" style={{ justifyContent: "center" }}>
                <a href={roomsHref} className="btn btn-coral btn-lg">
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
                Booked direct · 0% booking fees
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
