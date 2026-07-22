import "./royalJournal.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";
import type { BlogIndexPost } from "@/lib/site/loadSitePage";

const Arrow = (
  <svg
    width="17"
    height="17"
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
      <div className="rj-ph" aria-hidden>
        <span>{(title?.[0] ?? "•").toUpperCase()}</span>
      </div>
    </div>
  );
}

/**
 * Royal Hotel JOURNAL index (preset `royal`) — its own component + stylesheet
 * (`.rjournal` / royalJournal.css): the formal GRAND-HOTEL treatment (Archivo
 * display, a centred champagne-ruled page head, a refined featured lead post
 * stacked centred, then a formal grid of the rest — date · title · excerpt ·
 * read-more) — distinct from the OceansView resort grid and the Safari warm
 * editorial list. Wired to the site's LIVE published posts (`loadSiteBlogIndex`);
 * the data + empty-state logic is the same as the OceansView index. Cover-less
 * posts fall back to a champagne monogram. Renders inside the shared themed
 * chrome. Phase C (theme subpages).
 */
export function RoyalJournal({
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
    "Guides, stories and notes from the house — written by the people who look after every stay.";

  // Dark image hero (matches the reference Journal + the other Royal pages) so
  // the transparent, light-text header stays legible. Prefer a real post cover,
  // else a warm fallback.
  const heroImg =
    (featured ? cover(featured) : null) ||
    list.map(cover).find(Boolean) ||
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=2200&q=80";

  return (
    <div className="rjournal">
      {/* PAGE HEAD — dark image hero, champagne-ruled */}
      <section className="phead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={siteImageUrl(heroImg, { width: 2560 })}
          alt={heading?.trim() || "The journal"}
        />
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>·</span>
            <span>Journal</span>
          </nav>
          <h1 className="xl">{heading?.trim() || "The journal"}</h1>
          <span className="rj-rule" aria-hidden />
          <p className="lead">{sub}</p>
        </div>
      </section>

      {list.length === 0 ? (
        <section className="section">
          <div className="wrap">
            <div className="rj-empty" data-reveal>
              <span className="tag">The journal</span>
              <h2 className="lg">Your journal is almost here</h2>
              <p className="muted">
                Once {brandName} publishes its first stories they&apos;ll appear
                here.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* FEATURED — centred formal lead story */}
          {featured ? (
            <section
              className="section"
              style={{ paddingBottom: "clamp(36px,5vw,56px)" }}
            >
              <div className="wrap">
                <a
                  href={`/blog/${featured.slug}`}
                  className="rj-feat"
                  data-reveal
                >
                  <Cover
                    url={cover(featured)}
                    title={featured.title}
                    className="rj-feat-fig"
                    width={1600}
                  />
                  <div className="rj-feat-copy">
                    <span className="tag">
                      {featured.featured ? "Featured" : "Latest"}
                    </span>
                    <h2 className="lg">{featured.title}</h2>
                    <span className="rj-rule" aria-hidden />
                    {featured.excerpt ? (
                      <p className="lead">{featured.excerpt}</p>
                    ) : null}
                    <div className="rj-meta">
                      {featured.authorName ? (
                        <span>{featured.authorName}</span>
                      ) : null}
                      {featured.authorName && featured.date ? (
                        <span className="rj-dot" />
                      ) : null}
                      {featured.date ? <span>{featured.date}</span> : null}
                    </div>
                    <span className="alink rj-more">
                      Read the story {Arrow}
                    </span>
                  </div>
                </a>
              </div>
            </section>
          ) : null}

          {/* THE REST — formal grid */}
          {rest.length ? (
            <section
              className="section sand"
              style={{ paddingTop: "clamp(48px,6vw,84px)" }}
            >
              <div className="wrap">
                <div className="sec-head center" data-reveal>
                  <span className="tag">More stories</span>
                  <h2 className="lg">From the journal</h2>
                  <span className="rj-rule" aria-hidden />
                </div>
                <div className="rj-grid">
                  {rest.map((p, i) => (
                    <a
                      key={p.slug}
                      href={`/blog/${p.slug}`}
                      className="rj-card"
                      data-reveal
                      style={
                        {
                          "--reveal-delay": `${(i % 3) * 90}ms`,
                        } as CSSProperties
                      }
                    >
                      <Cover
                        url={cover(p)}
                        title={p.title}
                        className="rj-card-fig"
                        width={800}
                      />
                      <div className="rj-card-body">
                        {p.date ? (
                          <span className="rj-card-date">{p.date}</span>
                        ) : null}
                        <h3>{p.title}</h3>
                        {p.excerpt ? <p>{p.excerpt}</p> : null}
                        <div className="rj-card-foot">
                          <span className="alink rj-more">
                            Read more {Arrow}
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* CTA BANNER */}
      <section
        className="section"
        style={{ paddingBottom: "clamp(70px,9vw,130px)" }}
      >
        <div className="wrap">
          <div className="banner" data-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteImageUrl(
                "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=2000&q=80",
                { width: 1600 },
              )}
              alt={brandName}
              loading="lazy"
              decoding="async"
            />
            <div className="banner-in">
              <h2>Come see it for yourself</h2>
              <p>
                The stories are better in person. Find your dates and we&apos;ll
                keep a room ready for you.
              </p>
              <div className="hero-cta">
                <a href={roomsHref} className="btn btn-white btn-lg">
                  View rooms
                </a>
                <a href={contactHref} className="btn btn-on-img btn-lg">
                  Say hello
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
