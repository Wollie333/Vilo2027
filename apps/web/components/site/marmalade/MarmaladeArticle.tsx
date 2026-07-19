import "./marmaladeArticle.css";

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

/**
 * Marmalade House JOURNAL article — the founder's bespoke "Postcards" reference
 * design, wired to a LIVE post (`loadSiteBlogPost`). A full-bleed photo hero with
 * an overlapping white postcard, a prose column (the sanitised body_html styled by
 * `.mmarticle .article`), an author postcard, tag chips, and a live "keep reading"
 * strip. Renders inside the themed chrome. Scoped `.mmarticle`.
 */
export function MarmaladeArticle({
  brandName,
  post,
  related,
  socials,
  asset,
}: {
  brandName: string;
  post: ArticlePost;
  related: RelatedPost[];
  socials?: { instagram?: string | null; facebook?: string | null };
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const cover = post.coverUrl ? (asset(post.coverUrl) ?? post.coverUrl) : null;
  const rel = related.filter((r) => r.title);
  const ig = socials?.instagram?.trim();
  const fb = socials?.facebook?.trim();
  const tags = post.tags.filter((t) => t.name);
  const brandInitial = (brandName.trim()[0] || "M").toUpperCase();

  return (
    <div className="mmarticle">
      {/* HERO (postcard over photo) */}
      <section className="phero compact">
        <div className="bg">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={post.title} />
          ) : null}
        </div>
        <div className="postcard sm">
          <span className="stamp">{brandInitial}</span>
          <div className="crumbs">
            <a href="/blog">Journal</a>
            <span>·</span>
            <span>Story</span>
          </div>
          <h1>{post.title}</h1>
          <div className="pmeta" style={{ justifyContent: "center" }}>
            {post.authorName ? <span>{post.authorName}</span> : null}
            {post.authorName && post.date ? <span className="dot" /> : null}
            {post.date ? <span>{post.date}</span> : null}
          </div>
        </div>
      </section>

      {/* ARTICLE */}
      <section className="section">
        <div className="wrap">
          <article className="article">
            {post.excerpt ? <p className="lead-p">{post.excerpt}</p> : null}
            <div
              // body_html is sanitised in loadSiteBlogPost
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
            />

            {/* TAGS */}
            {tags.length ? (
              <div className="chips" style={{ marginTop: 34 }}>
                {tags.map((t) => (
                  <span className="chip" key={t.slug}>
                    {t.name}
                  </span>
                ))}
              </div>
            ) : null}

            {/* AUTHOR + SHARE */}
            <hr className="rule" style={{ marginTop: 44 }} />
            <div className="auth-row">
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
                    <div className="auth-nm">{post.authorName}</div>
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
          </article>
        </div>
      </section>

      {/* KEEP READING */}
      {rel.length ? (
        <section className="section soft">
          <div className="wrap">
            <div className="sec-head center">
              <span className="hand">keep reading</span>
              <h2>More from the journal</h2>
            </div>
            <div className="pcgrid">
              {rel.map((r) => {
                const rc = r.coverUrl
                  ? (asset(r.coverUrl) ?? r.coverUrl)
                  : null;
                return (
                  <a key={r.slug} href={`/blog/${r.slug}`} className="pc">
                    <div className="pi">
                      {rc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rc} alt={r.title} />
                      ) : (
                        <div className="cover-ph" aria-hidden>
                          <span>{(r.title?.[0] ?? "•").toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div className="pcbody">
                      <h3>{r.title}</h3>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
