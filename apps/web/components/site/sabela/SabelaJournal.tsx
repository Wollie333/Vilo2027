import "./sabelaJournal.css";

import type { BlogIndexPost } from "@/lib/site/loadSitePage";

const Arrow = (
  <svg
    width="18"
    height="18"
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
}: {
  url: string | null;
  title: string;
  className: string;
}) {
  if (url) {
    return (
      <div className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title} />
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="cover-ph" aria-hidden>
        <span>{(title?.[0] ?? "★").toUpperCase()}</span>
      </div>
    </div>
  );
}

/**
 * Sabela Lodge JOURNAL index — the founder's bespoke dark-editorial "Lodge"
 * reference design (docs/themes/sabela/pages/Journal.html body), wired to the
 * site's LIVE published posts (`loadSiteBlogIndex`). A nav-clearing plain page
 * head leads (no full-bleed hero), the featured post runs as an editorial split,
 * and the rest fill a dark card grid; cover-less posts fall back to a gold
 * monogram. Renders inside the `.sbchrome` themed chrome (`hotel` preset).
 * Scoped `.sbjournal`.
 */
export function SabelaJournal({
  brandName,
  heading,
  intro,
  posts,
  asset,
}: {
  brandName: string;
  heading?: string | null;
  intro?: string | null;
  posts: BlogIndexPost[];
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const list = posts.filter((p) => p.title);
  const featured = list.find((p) => p.featured) ?? list[0] ?? null;
  const rest = list.filter((p) => p !== featured);
  const cover = (p: BlogIndexPost) =>
    p.coverUrl ? (asset(p.coverUrl) ?? p.coverUrl) : null;

  const sub =
    intro?.trim() ||
    "Field notes, sightings and seasons — written by the people who know this place best.";

  return (
    <div className="sbjournal">
      {/* PAGE HEAD (plain, nav-clearing — no full-bleed hero) */}
      <section className="page-head" data-section="intro">
        <div className="wrap-narrow">
          <span className="eyebrow center">The journal</span>
          <h1>{heading?.trim() || "Field notes from the reserve"}</h1>
          <p className="lead mx-auto">{sub}</p>
        </div>
      </section>

      {list.length === 0 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap center">
            <h2 className="empty-h">Your journal is almost here</h2>
            <p className="muted" style={{ marginTop: 14 }}>
              Once {brandName} publishes its first stories they&apos;ll appear
              here.
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* FEATURED */}
          {featured ? (
            <section
              className="section-sm"
              style={{ paddingTop: 0, paddingBottom: "clamp(20px,3vw,44px)" }}
            >
              <div className="wrap">
                <a href={`/blog/${featured.slug}`} className="post-feature">
                  <Cover
                    url={cover(featured)}
                    title={featured.title}
                    className="pf-img"
                  />
                  <div>
                    <span className="pc-cat">
                      {featured.featured ? "Featured" : "Latest"}
                    </span>
                    <h2>{featured.title}</h2>
                    {featured.excerpt ? (
                      <p className="muted feat-ex">{featured.excerpt}</p>
                    ) : null}
                    <div className="pc-meta">
                      {featured.authorName ? (
                        <span>{featured.authorName}</span>
                      ) : null}
                      {featured.authorName && featured.date ? (
                        <span aria-hidden>·</span>
                      ) : null}
                      {featured.date ? <span>{featured.date}</span> : null}
                    </div>
                    <span className="link-arrow feat-link">
                      Read the story {Arrow}
                    </span>
                  </div>
                </a>
              </div>
            </section>
          ) : null}

          {/* POSTS GRID */}
          {rest.length ? (
            <section
              className="section-sm"
              style={{ paddingTop: 0, paddingBottom: "clamp(64px,8vw,110px)" }}
            >
              <div className="wrap">
                <div className="blog-grid">
                  {rest.map((p) => (
                    <a
                      key={p.slug}
                      href={`/blog/${p.slug}`}
                      className="post-card"
                    >
                      <div className="pc-img">
                        {cover(p) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover(p) as string} alt={p.title} />
                        ) : (
                          <div className="cover-ph" aria-hidden>
                            <span>{(p.title?.[0] ?? "★").toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="pc-body">
                        {p.featured ? (
                          <span className="pc-cat">Featured</span>
                        ) : null}
                        <h3>{p.title}</h3>
                        {p.excerpt ? (
                          <p className="pc-ex">{p.excerpt}</p>
                        ) : null}
                        <div className="pc-meta">
                          {p.authorName ? <span>{p.authorName}</span> : null}
                          {p.authorName && p.date ? (
                            <span aria-hidden>·</span>
                          ) : null}
                          {p.date ? <span>{p.date}</span> : null}
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

      {/* CTA BAND */}
      <section className="section-sm" data-section="cta">
        <div className="wrap">
          <div className="cta-band">
            <span className="glow" />
            <h2>See it with your own eyes</h2>
            <p>
              Booked direct with {brandName} — the rate you see is the rate you
              pay, with zero booking fees.
            </p>
            <div className="hero-cta-row">
              <a href="/rooms" className="btn btn-light btn-lg">
                Check availability
              </a>
              <a href="/contact" className="btn btn-on-dark btn-lg">
                Speak to us
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
