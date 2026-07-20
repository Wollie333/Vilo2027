import "./sabelaExperiences.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";
import type { NearbyPlace } from "@/lib/site/nearby";

import { SiteNearbyExperiences } from "../sections/SiteNearbyExperiences";

/**
 * Sabela Lodge EXPERIENCES page — the founder's bespoke dark-editorial "Lodge"
 * reference design (docs/themes/sabela/pages/Experiences.html), wired to the
 * host's LIVE experiences. A full-bleed hero, then each experience rendered as a
 * dark image-tile card (image-backed items get the photo; image-less items fall
 * back to a themed gold monogram tile rather than a broken box; body clamped to 2
 * lines), a tasteful "coming soon" empty-state (never fabricated), and a closing
 * gold-glow CTA band. The reference's static, demo-only icon-feature grid is
 * omitted — it has no backing data (as MarmaladeExperiences does). Renders inside
 * the `.sbchrome` themed chrome (`hotel` preset). Scoped under `.sbexp`.
 */
export function SabelaExperiences({
  brandName,
  heading,
  intro,
  experiences,
  nearby,
  roomsHref = "/rooms",
  contactHref = "/contact",
  asset,
}: {
  brandName: string;
  heading?: string | null;
  intro?: string | null;
  experiences: {
    title: string;
    body: string | null;
    imageUrl: string | null;
  }[];
  nearby?: NearbyPlace[] | null;
  roomsHref?: string;
  contactHref?: string;
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const list = experiences.filter((e) => e.title);
  const withImg = list.filter((e) => e.imageUrl);

  const brandInitial = (brandName.trim()[0] || "S").toUpperCase();

  const heroImg =
    (withImg[0]?.imageUrl && asset(withImg[0].imageUrl)) ||
    withImg[0]?.imageUrl ||
    "https://images.unsplash.com/photo-1547970810-dc1eac37d174?w=2000&q=80";

  const sub =
    intro?.trim() ||
    "Unhurried days, shaped around you. Everything worth doing is close at hand — from first light to the last coal of the fire.";

  return (
    <div className="sbexp">
      {/* HERO — full-bleed */}
      <section className="hero" data-section="hero">
        <div className="hero-full">
          <div
            className="hero-img"
            style={{ backgroundImage: `url('${heroImg}')` }}
          />
          <div className="wrap hero-content">
            <span className="eyebrow">A day at {brandName}</span>
            <h1>{heading?.trim() || "From first light to the last coal"}</h1>
            <p className="hero-sub">{sub}</p>
            <div className="hero-cta-row">
              <a href={roomsHref} className="btn btn-primary btn-lg">
                Explore the suites
              </a>
              <a href={contactHref} className="btn btn-on-dark btn-lg">
                Talk to us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* EXPERIENCES — live */}
      <section className="section" data-section="experiences">
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty">
              <span className="badge" aria-hidden>
                {brandInitial}
              </span>
              <h2>Experiences are on the way</h2>
              <p className="muted">
                {brandName} is putting together the best of what there is to do
                — the drives, the walks, the long, quiet afternoons. Check back
                soon, or speak to us and we&apos;ll shape the days around you.
              </p>
              <div className="ecta">
                <a href={roomsHref} className="btn btn-primary btn-lg">
                  Explore the suites
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Talk to us
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="sec-head center" data-reveal>
                <span className="eyebrow center no-rule">
                  What there is to do
                </span>
                <h2>The experiences, up close</h2>
              </div>
              <div className="exp-grid">
                {list.map((e, i) => {
                  const img = e.imageUrl
                    ? (asset(e.imageUrl) ?? e.imageUrl)
                    : null;
                  return (
                    <article
                      className="ec"
                      key={`${e.title}-${i}`}
                      data-reveal
                      style={
                        {
                          "--reveal-delay": `${(i % 3) * 90}ms`,
                        } as CSSProperties
                      }
                    >
                      {img ? (
                        <div className="ec-img">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={siteImageUrl(img, { width: 800 })}
                            alt={e.title}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : (
                        <div className="ec-img ec-ph">
                          <span className="mono" aria-hidden>
                            {(e.title[0] ?? brandInitial).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="ec-body">
                        <h3>{e.title}</h3>
                        {e.body ? <p>{e.body}</p> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* NEARBY — "beyond the lodge" cards (placeholder → Google Places) */}
      <SiteNearbyExperiences
        eyebrow="Beyond the lodge"
        title="Worth the short drive"
        places={nearby ?? undefined}
      />

      {/* CTA band */}
      <section className="section-sm" data-section="cta">
        <div className="wrap">
          <div className="cta-band" data-reveal>
            <span className="glow" />
            <h2>Build your perfect day</h2>
            <p>
              Tell us what you came for — and what you&apos;d rather leave
              behind — and we&apos;ll shape the stay around it. Booked direct,
              the rate you see is the rate you pay.
            </p>
            <div className="hero-cta-row">
              <a href={roomsHref} className="btn btn-light btn-lg">
                Check availability
              </a>
              <a href={contactHref} className="btn btn-on-dark btn-lg">
                Talk to us
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
