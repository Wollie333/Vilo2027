/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design language: literal apostrophes/quotes + external Unsplash imagery. */

const IMG = {
  head: "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=2200&q=80",
  cta: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2000&q=80",
};

const CHECK = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const RATES = [
  {
    suite: "Leadwood Tent",
    note: "Canvas & teak · sleeps 2",
    price: "R11,500",
  },
  {
    suite: "Marula Suite",
    note: "Flagship · plunge pool · sleeps 2",
    price: "R14,500",
  },
  {
    suite: "Tamboti Suite",
    note: "Family · two bedrooms · sleeps 4",
    price: "R18,900",
  },
];

const SEASONS = [
  {
    label: "Green season",
    dates: "Nov – Mar",
    note: "Lush bush, newborn game, dramatic skies",
  },
  {
    label: "Shoulder",
    dates: "Apr – Jun · Sep – Oct",
    note: "Mild days, excellent game viewing",
  },
  {
    label: "Peak",
    dates: "Jul – Aug",
    note: "Dry, cool, the best Big Five sightings",
  },
];

/** Safari-styled rates page (rates aren't a page in the NenGama set, so this is
 *  built in the same design language: page header, inclusions, a rate table and
 *  a seasonal note). */
export function SafariRatesContent() {
  return (
    <>
      <section className="page-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG.head} alt="" />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Rates</span>
          </div>
          <h1>Rates, all-inclusive</h1>
          <p>
            One nightly rate covers everything — your suite, all meals and house
            wines, two daily safaris and transfers from the airstrip. No fees,
            no surprises at checkout.
          </p>
        </div>
      </section>

      <section className="section-sm bg-2">
        <div className="wrap">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "clamp(20px,4vw,56px)",
              flexWrap: "wrap",
              textAlign: "center",
            }}
          >
            <span className="tag-pill">{CHECK}All meals & house wines</span>
            <span className="tag-pill">{CHECK}Two daily safaris</span>
            <span className="tag-pill">{CHECK}Airstrip transfers</span>
            <span className="tag-pill">{CHECK}0% booking fees</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Per suite, per night</span>
            <h2 className="display">Our rates</h2>
            <p className="lead">
              Rates are per suite, per night, fully inclusive — the price you
              see is the price you pay.
            </p>
          </div>

          <div style={{ maxWidth: 820 }}>
            {RATES.map((r, i) => (
              <div
                key={r.suite}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 24,
                  flexWrap: "wrap",
                  padding: "26px 0",
                  borderTop: i === 0 ? "1px solid var(--line)" : undefined,
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <div
                    style={{ fontFamily: "var(--serif)", fontSize: "1.7rem" }}
                  >
                    {r.suite}
                  </div>
                  <div
                    className="muted"
                    style={{ marginTop: 4, fontSize: "14.5px" }}
                  >
                    {r.note}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                  <div className="price">
                    {r.price}
                    <small>/ night</small>
                  </div>
                  <a href="/book" className="btn btn-primary btn-sm">
                    <span>Reserve</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-dark">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">When to come</span>
            <h2 className="display">The seasons</h2>
          </div>
          <div className="feat-row">
            {SEASONS.map((s) => (
              <div className="feat" key={s.label}>
                <div className="kicker-num">{s.dates}</div>
                <h3>{s.label}</h3>
                <p>{s.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="wrap">
          <div className="cta-band">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.cta} alt="" />
            <div className="cta-inner">
              <span className="tag-pill">
                Book direct · the price you see is the price you pay
              </span>
              <h2 style={{ marginTop: 22 }}>Ready when you are</h2>
              <p>
                Reserve straight with the lodge — no agents, no booking fees, no
                commission. Just your stay, arranged by the people who'll greet
                you at the gate.
              </p>
              <div className="hero-cta">
                <a href="/book" className="btn btn-light btn-lg">
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
