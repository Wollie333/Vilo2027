/** The real post fields the Marmalade House article render needs. Body is
 *  pre-sanitised HTML. */
export interface MarmaladeArticlePost {
  title: string;
  bodyHtml: string;
  coverUrl: string | null;
  date: string | null;
  authorName: string | null;
  excerpt: string | null;
}

const STOCK_HERO =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=2200&q=80";

/**
 * The Marmalade House article page — driven by the host's REAL post so the preview
 * matches what publishes and the `.article` prose styling applies. Scoped to
 * `.wielo-marmalade`.
 */
export function MarmaladeArticleContent({
  post,
  links,
}: {
  post?: MarmaladeArticlePost;
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
      {/* POST HERO — image page-head banner */}
      <section
        className="phead"
        style={{ minHeight: "clamp(380px,52vh,520px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt="" />
        <div className="wrap">
          <div className="crumbs">
            <a href={homeHref}>Home</a>
            <span>·</span>
            <a href={journalHref}>Journal</a>
          </div>
          <h1 style={{ maxWidth: "20ch" }}>{title}</h1>
          <p>{[author, post?.date].filter(Boolean).join(" · ")}</p>
        </div>
      </section>

      {/* ARTICLE */}
      <section className="section">
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
      <section className="section" data-section="cta">
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={STOCK_HERO} alt="" />
            <div className="banner-in">
              <h2>More from the journal</h2>
              <p>
                Read the rest of our notes from the kitchen, or book direct —
                the price you see is the price you pay.
              </p>
              <div className="hero-cta" style={{ justifyContent: "center" }}>
                <a href={journalHref} className="btn btn-white btn-lg">
                  <span>All journal posts</span>
                </a>
                <a href={roomsHref} className="btn btn-on-img btn-lg">
                  <span>View the rooms</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
