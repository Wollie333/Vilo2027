import "./marmaladeExperiences.css";

/**
 * Marmalade House THINGS-TO-DO page — the founder's bespoke "Postcards" reference
 * design (docs/themes/marmalade/pages/Experiences.html), wired to the host's LIVE
 * experiences. Each renders as a tilted, taped postcard card: image-backed items
 * get the photo + a handwritten caption; image-less items fall back to a themed
 * monogram note rather than a broken box. Empty → a tasteful "coming soon"
 * postcard instead of the reference's static demo cards. Renders inside the themed
 * chrome. Scoped under `.mmexp`.
 */
export function MarmaladeExperiences({
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
  const withImg = list.filter((e) => e.imageUrl);

  const brandInitial = (brandName.trim()[0] || "M").toUpperCase();

  const headImg =
    (withImg[0]?.imageUrl && asset(withImg[0].imageUrl)) ||
    withImg[0]?.imageUrl ||
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2000&q=80";
  const ctaImg =
    (withImg[withImg.length - 1]?.imageUrl &&
      asset(withImg[withImg.length - 1].imageUrl)) ||
    withImg[withImg.length - 1]?.imageUrl ||
    "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=2000&q=80";

  const sub =
    intro?.trim() ||
    "Do as little or as much as you like. Most of it begins at the breakfast table and ends on the stoep — but the good stuff is right there when you want it.";

  return (
    <div className="mmexp">
      {/* PAGE HEAD — photo with an overlapping postcard */}
      <section className="phero compact">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={headImg} alt={`Things to do at ${brandName}`} />
        </div>
        <div className="postcard sm">
          <span className="stamp">{brandInitial}</span>
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Things to do</span>
          </div>
          <span className="hand">close to home</span>
          <h1>{heading?.trim() || "Slow days, full ones"}</h1>
          <p className="sub">{sub}</p>
        </div>
      </section>

      {/* EXPERIENCES — live */}
      <section
        className="section"
        style={{ paddingTop: "clamp(56px,7vw,96px)" }}
      >
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty">
              <span className="stamp">✿</span>
              <h2>Things to do are on the way</h2>
              <p className="muted">
                {brandName} is putting together the best of what&apos;s close by
                — the walks, the tables, the little detours. Check back soon, or
                say hello and we&apos;ll shape the days around you.
              </p>
              <div className="pcta">
                <a href={roomsHref} className="btn btn-accent btn-lg">
                  See the rooms
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Say hello
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="sec-head center">
                <span className="hand">close to home</span>
                <h2>What there is to do</h2>
              </div>
              <div className="pcgrid">
                {list.map((e, i) => {
                  const img = e.imageUrl
                    ? (asset(e.imageUrl) ?? e.imageUrl)
                    : null;
                  if (!img) {
                    return (
                      <div className="pc pc-note" key={`${e.title}-${i}`}>
                        <span className="stamp mono" aria-hidden>
                          {(e.title[0] ?? "•").toUpperCase()}
                        </span>
                        <h3>{e.title}</h3>
                        {e.body ? <p>{e.body}</p> : null}
                      </div>
                    );
                  }
                  return (
                    <article className="pc" key={`${e.title}-${i}`}>
                      <div className="pi">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={e.title} />
                      </div>
                      <div className="cap">{e.title}</div>
                      {e.body ? (
                        <div className="pcbody">
                          <p>{e.body}</p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA (banner) */}
      <section className="section soft" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ctaImg} alt={brandName} />
            <div className="banner-in">
              <span className="hand lg" style={{ color: "var(--site-note)" }}>
                make a weekend of it
              </span>
              <h2 style={{ marginTop: 6 }}>Plan it, or don&apos;t</h2>
              <p>
                Tell us what you&apos;re after — or nothing at all — and
                we&apos;ll shape the days around you. Booked direct, with 0%
                booking fees.
              </p>
              <div className="pcta">
                <a href={roomsHref} className="btn btn-accent btn-lg">
                  See the rooms
                </a>
                <a href={contactHref} className="btn btn-light btn-lg">
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
