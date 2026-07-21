import "./safariJournal.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";
import type { BlogIndexPost } from "@/lib/site/loadSitePage";

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

function Cover({
  url,
  title,
  className,
  width,
}: {
  url: string | null;
  title: string;
  className: string;
  width: number;
}) {
  if (url) {
    return (
      <div className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={siteImageUrl(url, { width })}
          alt={title}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="sfj-ph" aria-hidden>
        <span>{(title?.[0] ?? "•").toUpperCase()}</span>
      </div>
    </div>
  );
}

/**
 * Safari (NenGama Lodge) JOURNAL index (preset `safari`) — its own component +
 * stylesheet (`.sfjournal` / safariJournal.css): the warm, airy, editorial lodge
 * treatment (Fraunces display, full-bleed left-aligned page head, a large lead
 * story followed by a hairline-ruled editorial list of the rest — date · title ·
 * excerpt · read-more) — distinct from the OceansView resort grid. Wired to the
 * site's LIVE published posts (`loadSiteBlogIndex`); the data + empty-state logic
 * is the same as the OceansView index. Cover-less posts fall back to a warm
 * monogram. Renders inside the shared themed chrome. Phase C (theme subpages).
 */
export function SafariJournal({
  brandName,
  heading,
  intro,
  posts,
  roomsHref = "/rooms",
  contactHref = "/contact",
  asset,
}: {
  brandName: string;
  heading?: string | null;
  intro?: string | null;
  posts: BlogIndexPost[];
  roomsHref?: string;
  contactHref?: string;
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const list = posts.filter((p) => p.title);
  const featured = list.find((p) => p.featured) ?? list[0] ?? null;
  const rest = list.filter((p) => p !== featured);
  const cover = (p: BlogIndexPost) =>
    p.coverUrl ? (asset(p.coverUrl) ?? p.coverUrl) : null;

  const sub =
    intro?.trim() ||
    "Guides, stories and notes from our corner of the bush — written by the people who live it.";

  return (
    <div className="sfjournal">
      {/* PAGE HEAD — full-bleed photo, left-aligned editorial */}
      <section className="sf-phead">
        <div className="sf-phead-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(
              "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2560&q=80",
              { width: 2560 },
            )}
            alt={brandName}
          />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-phead-in">
          <div className="sf-coverline on-photo">
            <span>{brandName}</span>
            <span className="sf-folio">The Field Journal · Journal</span>
          </div>
          <nav className="sf-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <span>Journal</span>
          </nav>
          <h1>{heading?.trim() || "The journal"}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {list.length === 0 ? (
        <section className="sf-sec">
          <div className="wrap">
            <div className="sfj-empty" data-reveal>
              <span className="sf-secnum" aria-hidden>
                I
              </span>
              <span className="sf-eyebrow">The journal</span>
              <h2 className="sf-h2">Your journal is almost here</h2>
              <p className="sf-lead sf-drop">
                Once {brandName} publishes its first stories they&apos;ll appear
                here.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* FEATURED — large editorial lead story */}
          {featured ? (
            <section className="sf-sec sfj-feat-sec">
              <div className="wrap">
                <a
                  href={`/blog/${featured.slug}`}
                  className="sfj-feat"
                  data-reveal
                >
                  <div className="sfj-feat-fig">
                    <Cover
                      url={cover(featured)}
                      title={featured.title}
                      className="sf-frame"
                      width={1100}
                    />
                  </div>
                  <div className="sfj-feat-copy">
                    <span className="sf-eyebrow">
                      {featured.featured ? "Featured" : "Latest"}
                    </span>
                    <h2 className="sf-h2">{featured.title}</h2>
                    {featured.excerpt ? (
                      <p className="sf-lead">{featured.excerpt}</p>
                    ) : null}
                    <div className="sfj-meta">
                      {featured.authorName ? (
                        <span>{featured.authorName}</span>
                      ) : null}
                      {featured.authorName && featured.date ? (
                        <span className="sfj-dot" />
                      ) : null}
                      {featured.date ? <span>{featured.date}</span> : null}
                    </div>
                    <span className="sfj-more">Read the story {Arrow}</span>
                  </div>
                </a>
              </div>
            </section>
          ) : null}

          {/* THE REST — hairline-ruled editorial list */}
          {rest.length ? (
            <section className="sf-sec sf-sand sfj-list-sec">
              <div className="wrap">
                <div className="sf-sechead" data-reveal>
                  <span className="sf-secnum" aria-hidden>
                    II
                  </span>
                  <span className="sf-eyebrow">More stories</span>
                  <h2 className="sf-h2">From the journal</h2>
                </div>
                <div className="sfj-list">
                  {rest.map((p, i) => (
                    <a
                      key={p.slug}
                      href={`/blog/${p.slug}`}
                      className="sfj-row"
                      data-reveal
                      style={
                        {
                          "--reveal-delay": `${(i % 3) * 70}ms`,
                        } as CSSProperties
                      }
                    >
                      <div className="sfj-row-meta">
                        {p.date ? (
                          <span className="sfj-row-date">{p.date}</span>
                        ) : null}
                        {p.authorName ? (
                          <span className="sfj-row-author">{p.authorName}</span>
                        ) : null}
                      </div>
                      <div className="sfj-row-body">
                        <h3>{p.title}</h3>
                        {p.excerpt ? <p>{p.excerpt}</p> : null}
                        <span className="sfj-more">Read more {Arrow}</span>
                      </div>
                      <div className="sfj-row-fig">
                        <Cover
                          url={cover(p)}
                          title={p.title}
                          className="sfj-thumb"
                          width={640}
                        />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* CTA — full-bleed closing banner */}
      <section className="sf-cta">
        <div className="sf-cta-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(
              "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=2000&q=80",
              { width: 2000 },
            )}
            alt={brandName}
            loading="lazy"
            decoding="async"
          />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-cta-in" data-reveal>
          <span className="sf-eyebrow on-dark">Come see it for yourself</span>
          <h2>The stories are better in person</h2>
          <p>
            Find your dates and we&apos;ll keep a spot warm for you — no agents,
            just the plain waking up.
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
