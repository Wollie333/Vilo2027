/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- design copy + external Unsplash imagery. */

const HEAD =
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=2200&q=80";
const CTA =
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2000&q=80";

/**
 * A Safari-styled fallback page for kinds without a bespoke design — so EVERY
 * page renders in the theme (never the old chrome). A page-head with the page's
 * title and a closing booking CTA.
 */
export function SafariGenericContent({
  title,
  bookHref = "/book",
}: {
  title: string;
  bookHref?: string | null;
}) {
  return (
    <>
      <section className="page-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HEAD} alt="" />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>{title}</span>
          </div>
          <h1>{title}</h1>
        </div>
      </section>

      <section className="section-sm">
        <div className="wrap">
          <div className="cta-band">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={CTA} alt="" />
            <div className="cta-inner">
              <h2 style={{ marginTop: 0 }}>Your dates, under wide skies</h2>
              <p>
                Reserve straight with the lodge — no agents, no booking fees, no
                commission. Just your stay, arranged by the people who'll greet
                you at the gate.
              </p>
              <div className="hero-cta">
                <a href={bookHref || "/book"} className="btn btn-light btn-lg">
                  <span>Check availability</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
