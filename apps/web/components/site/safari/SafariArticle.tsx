import "./safariArticle.css";

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
const ArrowBack = (
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
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

/**
 * Safari (NenGama Lodge) JOURNAL article (preset `safari`) — its own component +
 * stylesheet (`.sfarticle` / safariArticle.css): the warm, airy, editorial lodge
 * treatment (Fraunces display, centred reading column ~68ch, generous line-height,
 * an optional hero, a hairline author/share footer and a "keep reading" strip) —
 * distinct from the OceansView full-bleed hero article. Wired to a LIVE post
 * (`loadSiteBlogPost`); the body is the SAME sanitised `body_html` rendered
 * verbatim through `.sf-prose`. Renders inside the shared themed chrome. Phase C.
 */
export function SafariArticle({
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
    <div className="sfarticle">
      {/* HEADER — centred editorial title block */}
      <section className="sf-art-head">
        <div className="wrap">
          <div className="sf-coverline">
            <span>{brandName}</span>
            <span className="sf-folio">The Field Journal · Journal</span>
          </div>
          <nav className="sf-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <a href="/blog">Journal</a>
          </nav>
          <h1>{post.title}</h1>
          <div className="sf-art-meta">
            {post.authorName ? <span>{post.authorName}</span> : null}
            {post.authorName && post.date ? (
              <span className="sf-art-dot" />
            ) : null}
            {post.date ? <span>{post.date}</span> : null}
          </div>
        </div>
      </section>

      {/* HERO — optional wide image */}
      {cover ? (
        <div className="wrap">
          <figure className="sf-art-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteImageUrl(cover, { width: 2000 })}
              alt={post.title}
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>
      ) : null}

      {/* ARTICLE — centred reading column */}
      <section className="sf-art-body">
        <div className="wrap">
          {post.excerpt ? (
            <div className="sf-prose">
              <p className="sf-prose-lead sf-drop">{post.excerpt}</p>
            </div>
          ) : null}
          <div
            className="sf-prose"
            // body_html is sanitised in loadSiteBlogPost
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
          />

          {/* FOOTER — author + share + back link */}
          <div className="sf-prose sf-art-foot">
            <hr className="sf-rule" />
            <div className="sf-art-footrow">
              {post.authorName ? (
                <div className="sf-auth">
                  <span className="sf-auth-av">
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
                    <div className="sf-auth-name">{post.authorName}</div>
                    <div className="sf-auth-bio">
                      {post.authorBio?.trim() || brandName}
                    </div>
                  </div>
                </div>
              ) : (
                <span />
              )}
              {ig || fb ? (
                <div className="sf-share">
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
            <a href="/blog" className="sf-back">
              {ArrowBack} Back to the journal
            </a>
          </div>
        </div>
      </section>

      {/* KEEP READING */}
      {rel.length ? (
        <section className="sf-sec sf-sand">
          <div className="wrap">
            <div className="sf-sechead sf-rel-head" data-reveal>
              <div>
                <span className="sf-secnum" aria-hidden>
                  I
                </span>
                <span className="sf-eyebrow">Keep reading</span>
                <h2 className="sf-h2">More from the journal</h2>
              </div>
              <a href="/blog" className="sf-alink">
                All stories {Arrow}
              </a>
            </div>
            <div className="sf-rel">
              {rel.map((r, i) => {
                const rc = r.coverUrl
                  ? (asset(r.coverUrl) ?? r.coverUrl)
                  : null;
                return (
                  <a
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="sf-rel-card"
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 3) * 90}ms` } as CSSProperties
                    }
                  >
                    <div className="sf-rel-fig">
                      {rc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={siteImageUrl(rc, { width: 800 })}
                          alt={r.title}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="sfj-ph" aria-hidden>
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

      {/* CTA — full-bleed closing banner */}
      <section className="sf-cta">
        <div className="sf-cta-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(
              "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=2000&q=80",
              { width: 2000 },
            )}
            alt={brandName}
            loading="lazy"
            decoding="async"
          />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-cta-in" data-reveal>
          <span className="sf-eyebrow on-dark">Come stay with us</span>
          <h2>Real rooms, real people</h2>
          <p>
            A price that never moves and a spot kept warm for you. We&apos;ll be
            glad to have you.
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
