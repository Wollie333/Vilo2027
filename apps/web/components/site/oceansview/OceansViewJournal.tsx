import "./oceansJournal.css";

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
        <span>{(title?.[0] ?? "•").toUpperCase()}</span>
      </div>
    </div>
  );
}

/**
 * Oceans View JOURNAL index — the founder's bespoke reference design, wired to
 * the site's LIVE published posts (`loadSiteBlogIndex`). The featured post leads
 * as a large split; the rest fill a three-up grid. Cover-less posts fall back to
 * a themed gradient monogram. Renders inside the themed chrome. Scoped `.ovjournal`.
 */
export function OceansViewJournal({
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
    <div className="ovjournal">
      {/* PAGE HEAD */}
      <section className="phead">
        <div className="phead-bg" aria-hidden />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Journal</span>
          </div>
          <h1>{heading?.trim() || "The journal"}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {list.length === 0 ? (
        <section className="section">
          <div className="wrap" style={{ textAlign: "center" }}>
            <h2 className="lg">Your journal is almost here</h2>
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
              className="section"
              style={{ paddingBottom: "clamp(36px,5vw,56px)" }}
            >
              <div className="wrap">
                <a href={`/blog/${featured.slug}`} className="feat-post">
                  <Cover
                    url={cover(featured)}
                    title={featured.title}
                    className="fp-img"
                  />
                  <div>
                    <span className="pcat">
                      {featured.featured ? "Featured" : "Latest"}
                    </span>
                    <h2
                      className="lg"
                      style={{
                        marginTop: 14,
                        fontSize: "clamp(2rem,4vw,3rem)",
                      }}
                    >
                      {featured.title}
                    </h2>
                    {featured.excerpt ? (
                      <p className="lead" style={{ marginTop: 18 }}>
                        {featured.excerpt}
                      </p>
                    ) : null}
                    <div className="pmeta" style={{ marginTop: 20 }}>
                      {featured.authorName ? (
                        <span>{featured.authorName}</span>
                      ) : null}
                      {featured.authorName && featured.date ? (
                        <span className="dot" />
                      ) : null}
                      {featured.date ? <span>{featured.date}</span> : null}
                    </div>
                    <div style={{ marginTop: 24 }}>
                      <span className="alink">Read the story {Arrow}</span>
                    </div>
                  </div>
                </a>
              </div>
            </section>
          ) : null}

          {/* POSTS GRID */}
          {rest.length ? (
            <section
              className="section"
              style={{ paddingTop: "clamp(18px,3vw,36px)" }}
            >
              <div className="wrap">
                <div className="posts">
                  {rest.map((p) => (
                    <a key={p.slug} href={`/blog/${p.slug}`} className="post">
                      <Cover url={cover(p)} title={p.title} className="p-img" />
                      <h3>{p.title}</h3>
                      {p.excerpt ? <p>{p.excerpt}</p> : null}
                      <div className="pmeta">
                        {p.authorName ? <span>{p.authorName}</span> : null}
                        {p.authorName && p.date ? (
                          <span className="dot" />
                        ) : null}
                        {p.date ? <span>{p.date}</span> : null}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* CTA */}
      <section
        className="section-sm"
        style={{ paddingTop: 0, paddingBottom: "clamp(70px,9vw,130px)" }}
      >
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=2000&q=80"
              alt={brandName}
            />
            <div className="banner-in">
              <h2>Come see it for yourself</h2>
              <p>
                The stories are better in person. Find your dates and we&apos;ll
                keep a spot warm for you.
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
