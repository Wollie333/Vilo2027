import "./oceansExperiences.css";

/**
 * Oceans View EXPERIENCES page — the founder's bespoke reference design, wired
 * to the host's LIVE experiences. Each renders as a tall image-background tile
 * with its title and blurb overlaid (the reference's `.exps` grid). Image-less
 * items fall back to a themed gradient monogram rather than a broken box. Empty
 * → a tasteful "on the way" placeholder instead of fabricated experiences.
 * Renders inside the themed chrome. Scoped under `.ovexp`.
 */
export function OceansViewExperiences({
  brandName,
  heading,
  intro,
  experiences,
  roomsHref = "/rooms",
  contactHref = "/contact",
  asset,
}: {
  brandName: string;
  heading?: string | null;
  intro?: string | null;
  experiences: {
    title: string;
    body: string | null;
    imageUrl: string | null;
  }[];
  roomsHref?: string;
  contactHref?: string;
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const list = experiences.filter((e) => e.title);

  const sub =
    intro?.trim() ||
    "Swim, sail, spa, repeat. Everything here is built around one idea — that the best days are the ones where you do exactly as little, or as much, as you like.";

  return (
    <div className="ovexp">
      {/* PAGE HEAD */}
      <section className="phead">
        <div className="phead-bg" aria-hidden />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Experiences</span>
          </div>
          <h1>{heading?.trim() || "Experiences"}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* EXPERIENCES GRID — live */}
      <section className="section">
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty">
              <h2 className="lg">Experiences are on the way</h2>
              <p className="muted" style={{ marginTop: 14 }}>
                {brandName} is putting the finishing touches on things to see
                and do. Check back soon — or say hello and we&apos;ll shape the
                days around you.
              </p>
              <div className="hero-cta" style={{ justifyContent: "center" }}>
                <a href={roomsHref} className="btn btn-primary btn-lg">
                  View rooms
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Get in touch
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="sec-head">
                <span className="tag">The resort</span>
                <h2 className="lg" style={{ marginTop: 18 }}>
                  On the property
                </h2>
              </div>
              <div className="exps">
                {list.map((e, i) => {
                  const img = e.imageUrl
                    ? (asset(e.imageUrl) ?? e.imageUrl)
                    : null;
                  return (
                    <article className="exp" key={`${e.title}-${i}`}>
                      {img ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt={e.title} />
                        </>
                      ) : (
                        <div className="exp-ph" aria-hidden>
                          <span>{(e.title[0] ?? "•").toUpperCase()}</span>
                        </div>
                      )}
                      <div className="exp-b">
                        <h3>{e.title}</h3>
                        {e.body ? <p>{e.body}</p> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=2000&q=80"
              alt={brandName}
            />
            <div className="banner-in">
              <h2>Plan it, or don&apos;t</h2>
              <p>
                Tell us what you&apos;re after — or nothing at all — and
                we&apos;ll shape the days around you. The beach does the rest.
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
