import "./royalExperiences.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";

import { SiteNearbyExperiences } from "../sections/SiteNearbyExperiences";

/**
 * Royal Hotel EXPERIENCES page (preset `royal`) — its own component + stylesheet
 * (`.rexp` / royalExperiences.css): the formal, CENTRED grand-hotel treatment
 * (Archivo display via `--site-font-heading`, a champagne-ruled centred section
 * head, a refined tile grid) — a deliberate departure from the OceansView resort
 * overlay-grid it forked from. Wired to the host's LIVE experiences; image-less
 * items fall back to a charcoal panel with a champagne monogram rather than a
 * broken box, and an empty list shows a tasteful "on the way" placeholder instead
 * of fabricated things to do. Palette/type come from the `.wielo-royal` skin
 * (champagne accent, charcoal `--site-navy`). Renders inside the shared themed
 * chrome. Scoped under `.rexp`. Part of Phase C (theme differentiation).
 */
export function RoyalExperiences({
  brandName,
  heading,
  intro,
  experiences,
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
  roomsHref?: string;
  contactHref?: string;
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const list = experiences.filter((e) => e.title);

  const sub =
    intro?.trim() ||
    "The city at the door and a calm sense of arrival within — here's what fills the days. Do all of it, or none of it; the choice is yours to make.";

  // Decorative chrome only (page head + closing banner) — never a fabricated claim.
  const ctaImg =
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=2000&q=80";

  return (
    <div className="rexp">
      {/* PAGE HEAD — centred, formal (champagne/charcoal panel, no photo prop) */}
      <section className="phead">
        <div className="phead-bg" aria-hidden />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Experiences</span>
          </div>
          <h1>{heading?.trim() || "Experiences"}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* EXPERIENCES GRID — live */}
      <section className="section">
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty" data-reveal>
              <h2 className="lg">Experiences are on the way</h2>
              <p className="muted" style={{ marginTop: 14 }}>
                {brandName} is putting the finishing touches on things to see
                and do. Check back soon — or say hello and we&apos;ll shape the
                days around you.
              </p>
              <div className="hero-cta" style={{ justifyContent: "center" }}>
                <a href={roomsHref} className="btn btn-primary btn-lg">
                  View rooms
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Get in touch
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="sec-head center" data-reveal>
                <span className="tag" style={{ justifyContent: "center" }}>
                  The hotel
                </span>
                <h2 className="lg" style={{ marginTop: 18 }}>
                  On the property
                </h2>
              </div>
              <div className="exps">
                {list.map((e, i) => {
                  const img = e.imageUrl
                    ? (asset(e.imageUrl) ?? e.imageUrl)
                    : null;
                  return (
                    <article
                      className="exp"
                      key={`${e.title}-${i}`}
                      data-reveal
                      style={
                        {
                          "--reveal-delay": `${(i % 3) * 90}ms`,
                        } as CSSProperties
                      }
                    >
                      {img ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={siteImageUrl(img, { width: 800 })}
                            alt={e.title}
                            loading="lazy"
                            decoding="async"
                          />
                        </>
                      ) : (
                        <div className="exp-ph" aria-hidden>
                          <span>{(e.title[0] ?? "•").toUpperCase()}</span>
                        </div>
                      )}
                      <div className="exp-b">
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

      {/* NEARBY — "around the hotel" cards (placeholder → Google Places) */}
      <SiteNearbyExperiences
        eyebrow="Around the hotel"
        title="In the neighbourhood"
      />

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
              <h2>Plan it, or don&apos;t</h2>
              <p>
                Tell us what you&apos;re after — or nothing at all — and
                we&apos;ll shape the days around you. We&apos;ll handle the
                rest.
              </p>
              <div className="hero-cta">
                <a href={roomsHref} className="btn btn-white btn-lg">
                  View rooms
                </a>
                <a href={contactHref} className="btn btn-on-img btn-lg">
                  Talk to us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
