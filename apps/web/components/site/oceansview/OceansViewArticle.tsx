import "./oceansJournal.css";

type RelatedPost = { title: string; slug: string; coverUrl: string | null };

type ArticlePost = {
  title: string;
  bodyHtml: string;
  coverUrl: string | null;
  date: string | null;
  authorName: string | null;
  authorBio: string | null;
  authorAvatarUrl: string | null;
  excerpt: string | null;
  tags: { name: string; slug: string }[];
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "•";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

const IgIcon = (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    aria-hidden
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const FbIcon = (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    aria-hidden
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);
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

/**
 * Oceans View JOURNAL article — the founder's bespoke reference design, wired to
 * a LIVE post (`loadSiteBlogPost`). Full-bleed hero, prose column (the sanitised
 * body_html styled by `.ovjournal .article`), an author block, and a live
 * "keep reading" strip. Renders inside the themed chrome. Scoped `.ovjournal`.
 */
export function OceansViewArticle({
  brandName,
  post,
  related,
  roomsHref = "/rooms",
  contactHref = "/contact",
  socials,
  asset,
}: {
  brandName: string;
  post: ArticlePost;
  related: RelatedPost[];
  roomsHref?: string;
  contactHref?: string;
  socials?: { instagram?: string | null; facebook?: string | null };
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const cover = post.coverUrl ? (asset(post.coverUrl) ?? post.coverUrl) : null;
  const rel = related.filter((r) => r.title);
  const ig = socials?.instagram?.trim();
  const fb = socials?.facebook?.trim();

  return (
    <div className="ovjournal">
      {/* HERO */}
      <section className="phead tall">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={post.title} />
        ) : (
          <div className="phead-bg" aria-hidden />
        )}
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <a href="/blog">Journal</a>
          </div>
          <h1 style={{ maxWidth: "20ch" }}>{post.title}</h1>
          <div className="pmeta">
            {post.authorName ? <span>{post.authorName}</span> : null}
            {post.authorName && post.date ? <span className="dot" /> : null}
            {post.date ? <span>{post.date}</span> : null}
          </div>
        </div>
      </section>

      {/* ARTICLE */}
      <section className="section">
        <div className="wrap">
          {post.excerpt ? (
            <div className="article">
              <p className="lead-p">{post.excerpt}</p>
            </div>
          ) : null}
          <div
            className="article"
            // body_html is sanitised in loadSiteBlogPost
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
          />

          {/* AUTHOR + SHARE */}
          <div className="article" style={{ marginTop: 52 }}>
            <hr className="rule" />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 24,
                flexWrap: "wrap",
                marginTop: 30,
              }}
            >
              {post.authorName ? (
                <div className="auth">
                  <span className="av">
                    {post.authorAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.authorAvatarUrl} alt={post.authorName} />
                    ) : (
                      initials(post.authorName)
                    )}
                  </span>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--site-font-heading)",
                        fontWeight: 800,
                        fontSize: "1.3rem",
                      }}
                    >
                      {post.authorName}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {post.authorBio?.trim() || brandName}
                    </div>
                  </div>
                </div>
              ) : (
                <span />
              )}
              {ig || fb ? (
                <div className="share">
                  {ig ? (
                    <a
                      href={ig}
                      aria-label="Instagram"
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {IgIcon}
                    </a>
                  ) : null}
                  {fb ? (
                    <a
                      href={fb}
                      aria-label="Facebook"
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {FbIcon}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* KEEP READING */}
      {rel.length ? (
        <section className="section sand">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <span className="tag">Keep reading</span>
                <h2
                  className="lg"
                  style={{
                    marginTop: 14,
                    fontSize: "clamp(1.8rem,3.6vw,2.6rem)",
                  }}
                >
                  More from the journal
                </h2>
              </div>
              <a href="/blog" className="alink">
                All stories {Arrow}
              </a>
            </div>
            <div className="posts">
              {rel.map((r) => {
                const rc = r.coverUrl
                  ? (asset(r.coverUrl) ?? r.coverUrl)
                  : null;
                return (
                  <a key={r.slug} href={`/blog/${r.slug}`} className="post">
                    <div className="p-img">
                      {rc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rc} alt={r.title} />
                      ) : (
                        <div className="cover-ph" aria-hidden>
                          <span>{(r.title?.[0] ?? "•").toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <h3>{r.title}</h3>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="section">
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1559339352-11d035aa65de?w=2000&q=80"
              alt={brandName}
            />
            <div className="banner-in">
              <h2>Come stay with us</h2>
              <p>
                Real rooms, real people, and a price that never moves.
                We&apos;ll keep a spot warm for you.
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
