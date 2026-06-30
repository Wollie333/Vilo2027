/** The real post fields the Sabela article render needs (subset of
 *  loadSiteBlogPost). Body is pre-sanitised HTML. */
export interface SabelaArticlePost {
  title: string;
  bodyHtml: string;
  coverUrl: string | null;
  date: string | null;
  authorName: string | null;
  excerpt: string | null;
}

/**
 * The Sabela article page — driven by the host's REAL post (cover, title, meta,
 * sanitised body HTML, author) so the preview matches what publishes and the
 * `.article` prose styling applies to the real content. Scoped to `.wielo-sabela`.
 */
export function SabelaArticleContent({
  post,
  links,
}: {
  post?: SabelaArticlePost;
  links?: { home?: string; journal?: string; rooms?: string };
}) {
  const title = post?.title ?? "Untitled post";
  const cover = post?.coverUrl || null;
  const author = post?.authorName ?? null;
  const homeHref = links?.home || "/";
  const journalHref = links?.journal || "/blog";
  const roomsHref = links?.rooms || "/rooms";

  return (
    <>
      {/* POST HERO — dark page-head banner */}
      <section className="page-head">
        <div className="wrap wrap-narrow">
          <div className="crumb">
            <a href={homeHref}>Home</a>
            <span>·</span>
            <a href={journalHref}>Journal</a>
          </div>
          <h1 style={{ marginTop: 16, maxWidth: "20ch", marginInline: "auto" }}>
            {title}
          </h1>
          <p className="muted" style={{ marginTop: 16 }}>
            {[author, post?.date].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      {cover ? (
        <section className="section-sm" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div
              style={{
                aspectRatio: "16/8",
                overflow: "hidden",
                borderRadius: "var(--site-radius-lg, 14px)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* ARTICLE */}
      <section
        className="section"
        style={{ paddingTop: cover ? 0 : undefined }}
      >
        <article className="article">
          {post?.excerpt ? (
            <p className="lead" style={{ marginBottom: 28 }}>
              {post.excerpt}
            </p>
          ) : null}
          {post?.bodyHtml ? (
            <div dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
          ) : (
            <p>This post has no content yet.</p>
          )}
        </article>
      </section>

      {/* CTA */}
      <section className="section-sm" data-section="cta">
        <div className="wrap">
          <div className="cta-band">
            <span className="glow" />
            <h2>More from the journal</h2>
            <p>
              Read the rest of our field notes, or book direct — the price you
              see is the price you pay.
            </p>
            <div className="hero-cta-row" style={{ justifyContent: "center" }}>
              <a href={journalHref} className="btn btn-light btn-lg">
                <span>All field notes</span>
              </a>
              <a href={roomsHref} className="btn btn-on-dark btn-lg">
                <span>View the suites</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
