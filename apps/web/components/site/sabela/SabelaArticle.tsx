import "./sabelaArticle.css";

import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";

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
  if (!p.length) return "★";
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
 * Sabela Lodge JOURNAL article — the founder's bespoke dark-editorial "Lodge"
 * reference design (docs/themes/sabela/pages/Journal Post.html body), wired to a
 * LIVE post (`loadSiteBlogPost`). A nav-clearing centred title header (crumb,
 * headline, author + date), an inset full-width cover figure, a prose column (the
 * sanitised body_html styled by `.sbarticle .article`), tag chips, an author +
 * share row, a live "keep reading" strip and the direct-booking CTA. No full-bleed
 * hero. Renders inside the `.sbchrome` themed chrome. Scoped `.sbarticle`.
 */
export function SabelaArticle({
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

  return (
    <div className="sbarticle">
      <article>
        {/* TITLE HEADER (nav-clearing, centred — no full-bleed hero) */}
        <header className="art-head" data-section="intro">
          <div className="article center">
            <span className="crumb">
              <a href="/blog">Journal</a>
              <span aria-hidden>/</span>
              <span className="crumb-cur">Story</span>
            </span>
            <h1>{post.title}</h1>
            <div className="pc-meta head-meta">
              {post.authorName ? (
                <span className="by">
                  <span className="avatar">
                    {post.authorAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={siteImageUrl(post.authorAvatarUrl, { width: 200 })}
                        alt={post.authorName}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      initials(post.authorName)
                    )}
                  </span>
                  {post.authorName}
                </span>
              ) : null}
              {post.authorName && post.date ? <span aria-hidden>·</span> : null}
              {post.date ? <span>{post.date}</span> : null}
            </div>
          </div>
        </header>

        {/* COVER FIGURE (inset, full-width) */}
        {cover ? (
          <figure className="art-cover">
            <div className="wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={siteImageUrl(cover, { width: 2560 })}
                alt={post.title}
              />
            </div>
          </figure>
        ) : null}

        {/* PROSE BODY */}
        <div className="section" data-section="rich_text">
          <div className="article">
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
                      <img
                        src={siteImageUrl(post.authorAvatarUrl, { width: 200 })}
                        alt={post.authorName}
                        loading="lazy"
                        decoding="async"
                      />
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
          </div>
        </div>
      </article>

      {/* KEEP READING */}
      {rel.length ? (
        <section className="section-sm keep-reading" data-section="related">
          <div className="wrap">
            <div className="sec-head center" data-reveal>
              <span className="eyebrow center">Keep reading</span>
              <h2>More from the journal</h2>
            </div>
            <div className="blog-grid">
              {rel.map((r, i) => {
                const rc = r.coverUrl
                  ? (asset(r.coverUrl) ?? r.coverUrl)
                  : null;
                return (
                  <a
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="post-card"
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 3) * 90}ms` } as CSSProperties
                    }
                  >
                    <div className="pc-img">
                      {rc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={siteImageUrl(rc, { width: 800 })}
                          alt={r.title}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="cover-ph" aria-hidden>
                          <span>{(r.title?.[0] ?? "★").toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div className="pc-body">
                      <h3>{r.title}</h3>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA BAND */}
      <section className="section-sm" data-section="cta">
        <div className="wrap">
          <div className="cta-band" data-reveal>
            <span className="glow" />
            <h2>See it with your own eyes</h2>
            <p>
              Booked direct with {brandName} — the rate you see is the rate you
              pay.
            </p>
            <div className="hero-cta-row">
              <a href="/rooms" className="btn btn-light btn-lg">
                Check availability
              </a>
              <a href="/blog" className="btn btn-on-dark btn-lg">
                More from the journal
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
