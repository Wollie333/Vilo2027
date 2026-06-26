/* eslint-disable @next/next/no-img-element -- NenGama design port: external Unsplash fallback imagery. */

/** The real post fields the Safari article render needs (subset of
 *  loadSiteBlogPost). Body is pre-sanitised HTML. */
export interface SafariArticlePost {
  title: string;
  bodyHtml: string;
  coverUrl: string | null;
  date: string | null;
  authorName: string | null;
  excerpt: string | null;
}

const STOCK_HERO =
  "https://images.unsplash.com/photo-1504675099198-7023dd85f5a3?w=2200&q=80";

function initialsOf(name?: string | null): string {
  if (!name) return "·";
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "·"
  );
}

/**
 * The Safari article page — now driven by the host's REAL post (cover, title,
 * meta, sanitised body HTML, author) so the preview matches what publishes and
 * the `.article` prose styling applies to the real content.
 */
export function SafariArticleContent({
  post,
  links,
}: {
  post?: SafariArticlePost;
  /** Resolved (preview-aware) nav targets, so links work on the live site AND in
   *  the dashboard preview. Falls back to absolute paths for the live site. */
  links?: { home?: string; journal?: string; rooms?: string };
}) {
  const title = post?.title ?? "Untitled post";
  const cover = post?.coverUrl || STOCK_HERO;
  const author = post?.authorName ?? null;
  const homeHref = links?.home || "/";
  const journalHref = links?.journal || "/blog";
  const roomsHref = links?.rooms || "/rooms";

  return (
    <>
      {/* POST HERO */}
      <section
        className="page-head"
        style={{ minHeight: "clamp(440px,62vh,620px)" }}
      >
        <img src={cover} alt="" />
        <div className="wrap">
          <div className="crumbs">
            <a href={homeHref}>Home</a>
            <span>·</span>
            <a href={journalHref}>Journal</a>
          </div>
          <h1 style={{ maxWidth: "18ch" }}>{title}</h1>
          <div
            className="post-meta"
            style={{ color: "rgba(255,255,255,.82)", marginTop: "22px" }}
          >
            {author ? <span>{author}</span> : null}
            {author && post?.date ? <span className="dot"></span> : null}
            {post?.date ? <span>{post.date}</span> : null}
          </div>
        </div>
      </section>

      {/* ARTICLE */}
      <section className="section">
        <article className="article">
          {post?.excerpt ? <p className="lead-p">{post.excerpt}</p> : null}
          {post?.bodyHtml ? (
            <div dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
          ) : (
            <p>This post has no content yet.</p>
          )}
        </article>

        {/* AUTHOR */}
        {author ? (
          <div className="article" style={{ marginTop: "56px" }}>
            <hr className="rule" />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "24px",
                marginTop: "32px",
              }}
            >
              <div className="author-row">
                <span className="av">{initialsOf(author)}</span>
                <div>
                  <div
                    style={{ fontFamily: "var(--serif)", fontSize: "1.35rem" }}
                  >
                    {author}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* CTA */}
      <section className="section-sm">
        <div className="wrap">
          <div className="cta-band">
            <img
              src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2000&q=80"
              alt=""
            />
            <div className="cta-inner">
              <h2>More from the journal</h2>
              <p>
                Read the rest of our field notes, or book direct — the price you
                see is the price you pay.
              </p>
              <div className="hero-cta">
                <a href={journalHref} className="btn btn-light btn-lg">
                  <span>All field notes</span>
                </a>
                <a href={roomsHref} className="btn btn-on-dark btn-lg">
                  <span>View the suites</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
