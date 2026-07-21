import "./safariSpecials.css";

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
function pad2(n: number): string {
  return String(n + 1).padStart(2, "0");
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

/**
 * Safari (NenGama Lodge) OFFERS page (preset `safari`) — its own component +
 * stylesheet (`.sfspecials` / safariSpecials.css). An editorial "collection"
 * grid (matching the Safari rooms treatment — full-bleed left-aligned page head,
 * tall editorial cards with index numerals + floating badge/price), deliberately
 * distinct from the OceansView resort offers. Wired to the host's LIVE specials
 * (`specials_preview`): each card carries the host's badge, live now/was price,
 * savings and a real deep-link into the booking engine. Empty → the design's "no
 * offers yet" placeholder rather than demo cards. Renders inside the shared
 * themed chrome. Phase C (theme differentiation — subpages).
 */
export function SafariSpecials({
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
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=2560&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?w=2000&q=80";

  const sub =
    subheadline?.trim() ||
    "A handful of direct-only rates for the unhurried, the spontaneous and the long-stayers. Every one booked direct — the price you see is the price you pay.";

  return (
    <div className="sfspecials">
      {/* PAGE HEAD */}
      <section className="sf-phead">
        <div className="sf-phead-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(headImg, { width: 2560 })}
            alt={`Offers at ${brandName}`}
          />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-phead-in">
          <div className="sf-coverline on-photo">
            <span>{brandName}</span>
            <span className="sf-folio">The Field Journal · Offers</span>
          </div>
          <nav className="sf-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <span>Specials</span>
          </nav>
          <h1>Offers &amp; seasons</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* OFFERS — editorial collection grid (live) */}
      {list.length === 0 ? (
        <section className="sf-sec">
          <div className="wrap">
            <div className="sf-empty" data-reveal>
              <h2>No offers running right now</h2>
              <p>
                When {brandName} launches a special it appears here
                automatically. In the meantime, the everyday direct rate is
                already the best you&apos;ll find.
              </p>
              <div className="sf-empty-cta">
                <a href={roomsHref} className="sf-btn sf-btn-solid sf-btn-lg">
                  See the rooms
                </a>
                <a href={contactHref} className="sf-btn sf-btn-ghost sf-btn-lg">
                  Say hello {Arrow}
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="sf-sec">
          <div className="wrap">
            <div className="sf-grid">
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
                const scarce = s.remaining != null && s.remaining <= 5;
                const img =
                  s.imageUrl ||
                  shots[i]?.url ||
                  "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80";
                return (
                  <article
                    className="sf-card"
                    key={s.id}
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 2) * 90}ms` } as CSSProperties
                    }
                  >
                    <a
                      href={s.detailHref ?? s.bookHref}
                      className="sf-card-fig"
                      aria-label={s.title}
                    >
                      <span className="sf-card-idx" aria-hidden>
                        {pad2(i)}
                      </span>
                      <div className="sf-card-tags">
                        {s.badge ? (
                          <span className="sf-card-badge">{s.badge}</span>
                        ) : null}
                        {scarce ? (
                          <span className="sf-card-left">
                            Only {s.remaining} left
                          </span>
                        ) : null}
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={siteImageUrl(img, { width: 1000 })}
                        alt={s.title}
                        loading="lazy"
                        decoding="async"
                      />
                      {now ? (
                        <span className="sf-card-price">
                          {now}
                          <em>{per}</em>
                        </span>
                      ) : null}
                    </a>
                    <div className="sf-card-body">
                      <h3>{s.title}</h3>
                      {s.description ? <p>{s.description}</p> : null}
                      {(was && s.savingsAmount) || save ? (
                        <div className="sf-card-save">
                          {was && s.savingsAmount ? (
                            <span className="sf-was">{was}</span>
                          ) : null}
                          {save ? (
                            <span className="sf-save">{save}</span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="sf-card-cta">
                        <a
                          href={s.detailHref ?? s.bookHref}
                          className="sf-btn sf-btn-solid sf-btn-block"
                        >
                          View offer {Arrow}
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

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
          <span className="sf-eyebrow on-dark">Booked direct</span>
          <h2>Be first to hear the next offer</h2>
          <p>
            Our best rates rarely last. Say hello and we&apos;ll let you know
            the moment one opens.
          </p>
          <div className="sf-cta-row">
            <a href={contactHref} className="sf-btn sf-btn-solid sf-btn-lg">
              Get in touch
            </a>
            <a href={roomsHref} className="sf-btn sf-btn-line sf-btn-lg">
              See the rooms {Arrow}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
