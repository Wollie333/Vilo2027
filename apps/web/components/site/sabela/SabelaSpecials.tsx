import "./sabelaSpecials.css";

import type { CSSProperties } from "react";

import type { GalleryImage, SpecialCard } from "@/lib/site/types";
import { siteImageUrl } from "@/lib/site/image";

// ── helpers (server-rendered — Intl-free, deterministic) ─────────────────────
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

const TagIcon = (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9z" />
    <circle cx="7.5" cy="7.5" r="1.4" />
  </svg>
);

/**
 * Sabela Lodge OFFERS page — the founder's bespoke dark-editorial "Lodge"
 * reference, wired to the host's LIVE specials (`specials_preview`). A full-bleed
 * photo page-head sets the tone, then each offer renders as an editorial suite
 * card carrying the host's badge, live now/was price + savings and a real
 * "View offer" deep-link. Empty → an on-brand "no offers yet" panel rather than
 * demo cards. Renders inside the `.sbchrome` themed chrome (`hotel` preset).
 * Scoped under `.sbspecials`.
 */
export function SabelaSpecials({
  brandName,
  contactHref,
  roomsHref,
  heroImageUrl,
  specials,
  gallery,
}: {
  brandName: string;
  contactHref: string;
  roomsHref: string;
  heroImageUrl?: string | null;
  specials?: SpecialCard[] | null;
  gallery?: GalleryImage[] | null;
}) {
  const shots = (gallery ?? []).filter((g) => g.url);
  const list = (specials ?? []).filter((s) => s.title);
  const headImg =
    heroImageUrl ||
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2000&q=80";

  return (
    <div className="sbspecials">
      {/* PAGE HEAD — full-bleed photo with editorial overlay */}
      <section className="phead" data-section="intro">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(headImg, { width: 2560 })}
            alt={`Offers at ${brandName}`}
          />
        </div>
        <div className="wrap phead-in">
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span className="sep">·</span>
            <span className="cur">Offers</span>
          </nav>
          <span className="eyebrow">Offers &amp; seasonal rates</span>
          <h1>Special offers</h1>
          <p className="lead">
            A handful of ways to make the stay go further — stay-longer rates,
            quiet-season value and the occasional last-minute suite. Every offer
            is booked direct with the lodge, with zero added fees.
          </p>
        </div>
      </section>

      {/* SPECIALS GRID — live */}
      <section
        className="section"
        style={{ paddingTop: "clamp(56px,7vw,96px)" }}
        data-section="specials_preview"
      >
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty">
              <span className="ico">{TagIcon}</span>
              <span className="eyebrow center no-rule">
                Nothing running yet
              </span>
              <h2>No offers open right now</h2>
              <p className="muted">
                When {brandName} opens a special it lands here automatically. In
                the meantime the everyday direct rate is already the best you
                will find — no agents on every stay.
              </p>
              <div className="pcta">
                <a href={roomsHref} className="btn btn-primary btn-lg">
                  Explore the suites
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Speak to us
                </a>
              </div>
            </div>
          ) : (
            <div className="specials-grid">
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
                  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900&q=80";
                const scarce = s.remaining != null && s.remaining <= 5;
                return (
                  <article
                    className="special-card"
                    key={s.id}
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 3) * 90}ms` } as CSSProperties
                    }
                  >
                    <div className="sp-img">
                      {s.badge ? (
                        <span className="sp-badge">{s.badge}</span>
                      ) : null}
                      {scarce ? (
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
                    <div className="sp-body">
                      <h3>{s.title}</h3>
                      {s.description ? (
                        <p className="sp-desc">{s.description}</p>
                      ) : null}
                      {now ? (
                        <div className="sp-price">
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
                        href={s.detailHref ?? s.bookHref ?? roomsHref}
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

      {/* CTA band */}
      <section
        className="section-sm"
        style={{ paddingTop: 0 }}
        data-section="cta"
      >
        <div className="wrap">
          <div className="cta-band" data-reveal>
            <span className="glow" />
            <span className="zero-badge">
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
              Book direct
            </span>
            <h2>Be first to hear the next offer</h2>
            <p>
              Our best rates rarely last a week. Tell us your dates and we will
              let you know the moment something opens.
            </p>
            <div className="hero-cta-row">
              <a href={contactHref} className="btn btn-light btn-lg">
                Register your dates
              </a>
              <a href={roomsHref} className="btn btn-on-dark btn-lg">
                Browse the suites
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
