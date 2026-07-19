import "./marmaladeSpecials.css";

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
 * Marmalade House OFFERS page — the founder's bespoke "Postcards" reference design,
 * wired to the host's LIVE specials (`specials_preview`). Each offer renders as a
 * tilted, taped postcard with the host's badge, live now/was price, savings and a
 * real "View offer" deep-link. Empty → the design's "no offers yet" postcard note
 * rather than demo cards. Renders inside the themed chrome. Scoped under
 * `.mmspecials`.
 */
export function MarmaladeSpecials({
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
    "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=2000&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    headImg ||
    "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=2000&q=80";

  const brandInitial = (brandName.trim()[0] || "M").toUpperCase();

  return (
    <div className="mmspecials">
      {/* PAGE HEAD — photo with an overlapping postcard */}
      <section className="phead">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={headImg} alt={`Offers at ${brandName}`} />
        </div>
        <div className="postcard">
          <span className="stamp">{brandInitial}</span>
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Offers</span>
          </div>
          <span className="hand">booked direct · 0% fees</span>
          <h1>
            A few good reasons
            <br />
            to stay longer
          </h1>
          <p className="sub">
            Small offers for the unhurried, the spontaneous and the midweek
            wanderers. Every one booked straight with the house — the price you
            see is the price you pay.
          </p>
        </div>
      </section>

      {/* SPECIALS GRID — live */}
      <section
        className="section"
        style={{ paddingTop: "clamp(56px,7vw,96px)" }}
      >
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty">
              <span className="stamp">✿</span>
              <h2>No offers running right now</h2>
              <p className="muted">
                When {brandName} opens a special it lands here automatically. In
                the meantime, the everyday direct rate is already the best
                you&apos;ll find — breakfast and 0% booking fees included.
              </p>
              <div className="pcta">
                <a href={roomsHref} className="btn btn-accent btn-lg">
                  See the rooms
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Say hello
                </a>
              </div>
            </div>
          ) : (
            <div className="spx">
              {list.map((s) => {
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
                  "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=900&q=80";
                const scarce = s.remaining != null && s.remaining <= 5;
                return (
                  <article className="spcard" key={s.id}>
                    <div className="sp-img">
                      {s.badge ? (
                        <span className="sp-badge">{s.badge}</span>
                      ) : null}
                      {scarce ? (
                        <span className="sp-left">Only {s.remaining} left</span>
                      ) : null}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
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
                        href={s.detailHref ?? s.bookHref ?? roomsHref}
                        className="btn btn-accent btn-block"
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

      {/* CTA (banner) */}
      <section className="section soft" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ctaImg} alt={brandName} loading="lazy" decoding="async" />
            <div className="banner-in">
              <span className="hand lg" style={{ color: "var(--site-note)" }}>
                first dibs
              </span>
              <h2 style={{ marginTop: 6 }}>Hear the next offer first</h2>
              <p>
                Our best rates rarely last a week. Say hello and we&apos;ll let
                you know the moment one opens.
              </p>
              <div className="pcta">
                <a href={contactHref} className="btn btn-accent btn-lg">
                  Join the list
                </a>
                <a href={roomsHref} className="btn btn-light btn-lg">
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
