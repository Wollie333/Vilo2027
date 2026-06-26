/* eslint-disable @next/next/no-img-element -- NenGama design port: external Unsplash fallback imagery. */
import type { BlogIndexPost } from "@/lib/site/loadSitePage";

const ARROW = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// Fallback covers (the design's stock) for posts with no uploaded cover.
const STOCK_COVERS = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80",
  "https://images.unsplash.com/photo-1504675099198-7023dd85f5a3?w=900&q=80",
  "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=900&q=80",
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=80",
  "https://images.unsplash.com/photo-1502920514313-52581002a659?w=900&q=80",
];

function PostMeta({
  author,
  date,
}: {
  author?: string | null;
  date?: string | null;
}) {
  return (
    <div className="post-meta">
      {author ? <span>{author}</span> : null}
      {author && date ? <span className="dot"></span> : null}
      {date ? <span>{date}</span> : null}
    </div>
  );
}

/**
 * The Safari ("Journal") blog index — now driven by the host's REAL published
 * posts so the preview shows how the blog will actually display and each card
 * links to the real post. Falls back to the page chrome + an empty note when
 * there are no posts yet.
 */
export function SafariJournalContent({
  posts = [],
}: {
  posts?: BlogIndexPost[];
}) {
  const featured = posts.find((p) => p.featured) ?? posts[0] ?? null;
  const rest = posts.filter((p) => p !== featured);

  return (
    <>
      {/* PAGE HEAD */}
      <section
        className="page-head"
        style={{ minHeight: "clamp(380px,52vh,520px)" }}
      >
        <img
          src="https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=2200&q=80"
          alt=""
        />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Journal</span>
          </div>
          <h1>Field notes</h1>
          <p>
            Stories from the lodge — written by the people who live and work
            here.
          </p>
        </div>
      </section>

      {posts.length === 0 ? (
        <section className="section">
          <div className="wrap">
            <p className="lead" style={{ textAlign: "center" }}>
              No journal posts yet. New stories will appear here once published.
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* FEATURED */}
          {featured ? (
            <section
              className="section"
              style={{ paddingBottom: "clamp(40px,5vw,64px)" }}
            >
              <div className="wrap">
                <a href={`/blog/${featured.slug}`} className="featured-post">
                  <div className="fp-media">
                    <img
                      src={featured.coverUrl || STOCK_COVERS[0]}
                      alt={featured.title}
                    />
                  </div>
                  <div>
                    <span className="post-cat">Featured</span>
                    <h2
                      className="display"
                      style={{
                        marginTop: "16px",
                        fontSize: "clamp(2rem,4vw,3.2rem)",
                      }}
                    >
                      {featured.title}
                    </h2>
                    {featured.excerpt ? (
                      <p className="lead" style={{ marginTop: "20px" }}>
                        {featured.excerpt}
                      </p>
                    ) : null}
                    <PostMeta
                      author={featured.authorName}
                      date={featured.date}
                    />
                    <div style={{ marginTop: "26px" }}>
                      <span className="link-u">Read the story {ARROW}</span>
                    </div>
                  </div>
                </a>
              </div>
            </section>
          ) : null}

          {/* POST GRID */}
          {rest.length > 0 ? (
            <section
              className="section"
              style={{ paddingTop: "clamp(20px,3vw,40px)" }}
            >
              <div className="wrap">
                <div className="post-grid">
                  {rest.map((post, i) => (
                    <a
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="post-card"
                    >
                      <div className="pc-media">
                        <img
                          src={
                            post.coverUrl ||
                            STOCK_COVERS[(i + 1) % STOCK_COVERS.length]
                          }
                          alt={post.title}
                        />
                      </div>
                      <h3 style={{ marginTop: "18px" }}>{post.title}</h3>
                      {post.excerpt ? <p>{post.excerpt}</p> : null}
                      <PostMeta author={post.authorName} date={post.date} />
                    </a>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* NEWSLETTER CTA */}
      <section className="section-sm" style={{ paddingTop: "0" }}>
        <div className="wrap">
          <div
            className="cta-band"
            style={{
              paddingTop: "clamp(48px,6vw,84px)",
              paddingBottom: "clamp(48px,6vw,84px)",
            }}
          >
            <img
              src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2000&q=80"
              alt=""
            />
            <div className="cta-inner">
              <h2>Field notes, twice a season</h2>
              <p>
                Sightings, open dates and the occasional recipe — no noise, just
                the lodge in your inbox.
              </p>
              <form
                className="foot-news"
                style={{ maxWidth: "420px", margin: "26px auto 0" }}
              >
                <input
                  type="email"
                  placeholder="you@email.com"
                  aria-label="Email"
                  style={{
                    background: "rgba(255,255,255,.14)",
                    borderColor: "rgba(255,255,255,.3)",
                    color: "#fff",
                  }}
                />
                <button className="btn btn-light btn-sm" type="button">
                  <span>Subscribe</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
