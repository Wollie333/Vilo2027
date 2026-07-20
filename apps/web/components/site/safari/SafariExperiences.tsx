import "./safariExperiences.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";

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
 * Safari (NenGama Lodge) EXPERIENCES page (preset `safari`) — its own component +
 * stylesheet (`.sfexp` / safariExperiences.css): the warm, airy, editorial lodge
 * treatment (Fraunces display, full-bleed page head, an editorial RULED LIST of
 * numbered rows with a thumbnail + title + body and hairline dividers) — a
 * deliberate departure from the OceansView resort's overlay-tile grid. Wired to
 * the host's LIVE experiences; image-less items fall back to a tinted monogram
 * rather than a broken box, and an empty list shows a tasteful "on the way"
 * placeholder instead of fabricated things to do. Renders inside the shared
 * themed chrome. Scoped under `.sfexp`. Phase B (theme differentiation — subpages).
 */
export function SafariExperiences({
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
    "The plains, the water, and the long golden hours between waking to birdsong and the fire at dusk — here's what fills the days. Do all of it, or none of it.";

  // Decorative chrome only (page head + closing banner) — never a fabricated claim.
  const headImg =
    "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2560&q=80";
  const ctaImg =
    "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?w=2000&q=80";

  return (
    <div className="sfexp">
      {/* PAGE HEAD — full-bleed photo, left-aligned editorial */}
      <section className="sf-phead">
        <div className="sf-phead-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={siteImageUrl(headImg, { width: 2560 })} alt={brandName} />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-phead-top">
          <div className="sf-coverline on-photo">
            <span>{brandName}</span>
            <span className="sf-folio">The Field Journal · Field Notes</span>
          </div>
        </div>
        <div className="wrap sf-phead-in">
          <nav className="sf-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <span>Experiences</span>
          </nav>
          <h1>{heading?.trim() || "Experiences"}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* EXPERIENCES — editorial ruled list (live) */}
      <section className="sf-sec">
        <div className="wrap">
          {list.length === 0 ? (
            <div className="sf-empty" data-reveal>
              <span className="sf-secnum" aria-hidden>
                I
              </span>
              <span className="sf-eyebrow">Things to do</span>
              <h2 className="sf-h2">Experiences are on the way</h2>
              <p className="sf-lead sf-drop">
                {brandName} is still shaping the things to see and do out here.
                Check back soon — or say hello and we&apos;ll build the days
                around you.
              </p>
              <div className="sf-cta-row">
                <a href={roomsHref} className="sf-btn sf-btn-solid sf-btn-lg">
                  View the rooms
                </a>
                <a href={contactHref} className="sf-btn sf-btn-line sf-btn-lg">
                  Get in touch {Arrow}
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="sf-sechead" data-reveal>
                <span className="sf-secnum" aria-hidden>
                  II
                </span>
                <span className="sf-eyebrow">Things to do</span>
                <h2 className="sf-h2">Out on the land</h2>
              </div>
              <div className="sf-exps">
                {list.map((e, i) => {
                  const img = e.imageUrl
                    ? (asset(e.imageUrl) ?? e.imageUrl)
                    : null;
                  return (
                    <article
                      className="sf-exp"
                      key={`${e.title}-${i}`}
                      data-reveal
                      style={
                        {
                          "--reveal-delay": `${(i % 3) * 90}ms`,
                        } as CSSProperties
                      }
                    >
                      <span className="sf-exp-idx" aria-hidden>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="sf-exp-fig">
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
                          <div className="sf-exp-ph" aria-hidden>
                            <span>{(e.title[0] ?? "•").toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="sf-exp-body">
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
          <span className="sf-eyebrow on-dark">Plan it, or don&apos;t</span>
          <h2>Tell us what you&apos;re after</h2>
          <p>
            Or nothing at all — and we&apos;ll shape the days around you. The
            plain does the rest.
          </p>
          <div className="sf-cta-row">
            <a href={roomsHref} className="sf-btn sf-btn-solid sf-btn-lg">
              View the rooms
            </a>
            <a href={contactHref} className="sf-btn sf-btn-line sf-btn-lg">
              Say hello {Arrow}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
