import "./marmaladeJournal.css";

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
 * Marmalade House JOURNAL index — the founder's bespoke "Postcards" reference
 * design, wired to the site's LIVE published posts (`loadSiteBlogIndex`). A plain
 * (no-photo) page head clears the floating pill nav; the featured post leads as a
 * tilted split; the rest fill a taped-postcard grid. Cover-less posts fall back to
 * a themed monogram. Renders inside the themed chrome. Scoped `.mmjournal`.
 */
export function MarmaladeJournal({
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
    "Recipes, the garden, the village and the odd strong opinion — little stories from the people who run the house.";

  const ctaImg =
    "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=2000&q=80";

  return (
    <div className="mmjournal">
      {/* PAGE HEAD (plain, no photo — clears the floating nav) */}
      <section className="phead-plain">
        <div className="wrap-tight">
          <span className="hand">notes from the kitchen</span>
          <h1>{heading?.trim() || "The journal"}</h1>
          <p className="lead mx">{sub}</p>
        </div>
      </section>

      {list.length === 0 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap center">
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
              style={{ paddingTop: "clamp(20px,3vw,40px)" }}
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
                      {featured.featured ? "featured" : "latest"}
                    </span>
                    <h2
                      className="lg"
                      style={{
                        marginTop: 10,
                        fontSize: "clamp(1.9rem,4vw,2.9rem)",
                      }}
                    >
                      {featured.title}
                    </h2>
                    {featured.excerpt ? (
                      <p className="lead" style={{ marginTop: 16 }}>
                        {featured.excerpt}
                      </p>
                    ) : null}
                    <div className="pmeta" style={{ marginTop: 18 }}>
                      {featured.authorName ? (
                        <span>{featured.authorName}</span>
                      ) : null}
                      {featured.authorName && featured.date ? (
                        <span className="dot" />
                      ) : null}
                      {featured.date ? <span>{featured.date}</span> : null}
                    </div>
                    <div style={{ marginTop: 22 }}>
                      <span className="alink">Read it {Arrow}</span>
                    </div>
                  </div>
                </a>
              </div>
            </section>
          ) : null}

          {/* POSTS GRID (taped postcards) */}
          {rest.length ? (
            <section
              className="section"
              style={{ paddingTop: "clamp(16px,2vw,32px)" }}
            >
              <div className="wrap">
                <div className="pcgrid">
                  {rest.map((p) => (
                    <a key={p.slug} href={`/blog/${p.slug}`} className="pc">
                      <div className="pi">
                        {p.featured ? (
                          <span className="pc-badge">featured</span>
                        ) : null}
                        {cover(p) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover(p) as string}
                            alt={p.title}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="cover-ph" aria-hidden>
                            <span>{(p.title?.[0] ?? "•").toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="pcbody">
                        <h3>{p.title}</h3>
                        {p.excerpt ? <p>{p.excerpt}</p> : null}
                        <div className="pmeta">
                          {p.authorName ? <span>{p.authorName}</span> : null}
                          {p.authorName && p.date ? (
                            <span className="dot" />
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

      {/* CTA (banner) */}
      <section className="section soft">
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ctaImg} alt={brandName} loading="lazy" decoding="async" />
            <div className="banner-in">
              <span className="hand lg" style={{ color: "var(--site-note)" }}>
                read it from a good bed
              </span>
              <h2 style={{ marginTop: 6 }}>Come stay a night or three</h2>
              <p>
                Booked direct with the house — the price you see is the price
                you pay, with breakfast and 0% booking fees.
              </p>
              <div className="pcta">
                <a href="/rooms" className="btn btn-accent btn-lg">
                  Book a room
                </a>
                <a href="/contact" className="btn btn-light btn-lg">
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
