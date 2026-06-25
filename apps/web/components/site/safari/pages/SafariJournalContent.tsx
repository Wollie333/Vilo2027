/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design port: copy uses literal apostrophes/quotes and external Unsplash imagery. */
export function SafariJournalContent() {
  return (
    <>
      {/* PAGE HEAD */}
      <section
        className="page-head"
        style={{ minHeight: "clamp(380px,52vh,520px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=2200&q=80"
          alt="Giraffe at dusk on the reserve"
        />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Journal</span>
          </div>
          <h1>Field notes</h1>
          <p>
            Stories from the reserve — tracking and conservation, long dinners
            and longer drives, written by the people who live here.
          </p>
        </div>
      </section>

      {/* FEATURED */}
      <section
        className="section"
        style={{ paddingBottom: "clamp(40px,5vw,64px)" }}
      >
        <div className="wrap">
          <a href="/blog" className="featured-post">
            <div className="fp-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=1300&q=80"
                alt="A tracker reading the morning sand"
              />
            </div>
            <div>
              <span className="post-cat">Field Notes · Featured</span>
              <h2
                className="display"
                style={{
                  marginTop: "16px",
                  fontSize: "clamp(2rem,4vw,3.2rem)",
                }}
              >
                Reading the tracks: a morning with our head tracker
              </h2>
              <p className="lead" style={{ marginTop: "20px" }}>
                Before the sun clears the ridge, Tebogo is already crouched in
                the sand reading the night's news — who passed, how fast, how
                long ago. We followed him for three hours and learned to see the
                bush differently.
              </p>
              <div className="post-meta" style={{ marginTop: "24px" }}>
                <span>Tebogo Modise</span>
                <span className="dot"></span>
                <span>12 June 2026</span>
                <span className="dot"></span>
                <span>7 min read</span>
              </div>
              <div style={{ marginTop: "26px" }}>
                <span className="link-u">
                  Read the story{" "}
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
                </span>
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* CATEGORIES */}
      <section style={{ paddingBottom: "clamp(28px,3vw,40px)" }}>
        <div className="wrap">
          <div className="cat-bar">
            <button type="button" className="cat-chip on">
              All
            </button>
            <button type="button" className="cat-chip">
              Field Notes
            </button>
            <button type="button" className="cat-chip">
              Conservation
            </button>
            <button type="button" className="cat-chip">
              Wildlife
            </button>
            <button type="button" className="cat-chip">
              Table &amp; Cellar
            </button>
            <button type="button" className="cat-chip">
              Travel
            </button>
          </div>
        </div>
      </section>

      {/* POST GRID */}
      <section
        className="section"
        style={{ paddingTop: "clamp(20px,3vw,40px)" }}
      >
        <div className="wrap">
          <div className="post-grid">
            <a href="/blog" className="post-card">
              <div className="pc-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80"
                  alt="Open restored grassland"
                />
              </div>
              <span className="post-cat" style={{ marginTop: "18px" }}>
                Conservation
              </span>
              <h3>
                Twelve thousand hectares: how a cattle farm became wild again
              </h3>
              <p>
                Fifteen years, one fence line at a time. The slow, stubborn work
                of giving land back to itself.
              </p>
              <div className="post-meta">
                <span>Naledi Mokoena</span>
                <span className="dot"></span>
                <span>28 May 2026</span>
                <span className="dot"></span>
                <span>9 min</span>
              </div>
            </a>
            <a href="/blog" className="post-card">
              <div className="pc-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1504675099198-7023dd85f5a3?w=900&q=80"
                  alt="A boma table laid for dinner"
                />
              </div>
              <span className="post-cat" style={{ marginTop: "18px" }}>
                Table &amp; Cellar
              </span>
              <h3>A table under the stars: an evening at the boma</h3>
              <p>
                Open coals, Limpopo wine and a sky thick with stars. How dinner
                here became the favourite part of the day.
              </p>
              <div className="post-meta">
                <span>Chef Anele</span>
                <span className="dot"></span>
                <span>14 May 2026</span>
                <span className="dot"></span>
                <span>6 min</span>
              </div>
            </a>
            <a href="/blog" className="post-card">
              <div className="pc-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=900&q=80"
                  alt="A lion resting in the grass"
                />
              </div>
              <span className="post-cat" style={{ marginTop: "18px" }}>
                Wildlife
              </span>
              <h3>The big cats of the Waterberg</h3>
              <p>
                Lion, leopard and the elusive brown hyena — meet the predators
                that returned when the fences came down.
              </p>
              <div className="post-meta">
                <span>Tebogo Modise</span>
                <span className="dot"></span>
                <span>2 May 2026</span>
                <span className="dot"></span>
                <span>8 min</span>
              </div>
            </a>
            <a href="/blog" className="post-card">
              <div className="pc-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&q=80"
                  alt="A canvas tent at dusk"
                />
              </div>
              <span className="post-cat" style={{ marginTop: "18px" }}>
                Travel
              </span>
              <h3>Packing for the bush: a short, honest list</h3>
              <p>
                What to bring, what to leave, and why your phone will spend most
                of the trip in a drawer.
              </p>
              <div className="post-meta">
                <span>Lethabo Mokoena</span>
                <span className="dot"></span>
                <span>20 Apr 2026</span>
                <span className="dot"></span>
                <span>5 min</span>
              </div>
            </a>
            <a href="/blog" className="post-card">
              <div className="pc-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=80"
                  alt="The lodge at golden hour"
                />
              </div>
              <span className="post-cat" style={{ marginTop: "18px" }}>
                From the Family
              </span>
              <h3>Why we'll always stay small</h3>
              <p>
                Three suites, never more. A note on the quiet maths of running a
                lodge that refuses to grow.
              </p>
              <div className="post-meta">
                <span>Lethabo Mokoena</span>
                <span className="dot"></span>
                <span>6 Apr 2026</span>
                <span className="dot"></span>
                <span>4 min</span>
              </div>
            </a>
            <a href="/blog" className="post-card">
              <div className="pc-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1502920514313-52581002a659?w=900&q=80"
                  alt="An elephant at the waterhole"
                />
              </div>
              <span className="post-cat" style={{ marginTop: "18px" }}>
                Field Notes
              </span>
              <h3>The herd that visits at breakfast</h3>
              <p>
                For three seasons, the same elephant family has come to our
                waterhole at dawn. We've started to know them.
              </p>
              <div className="post-meta">
                <span>Tebogo Modise</span>
                <span className="dot"></span>
                <span>22 Mar 2026</span>
                <span className="dot"></span>
                <span>6 min</span>
              </div>
            </a>
          </div>
        </div>
      </section>

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2000&q=80"
              alt="Waterberg sunset"
            />
            <div className="cta-inner">
              <h2>Field notes, twice a season</h2>
              <p>
                Sightings, open dates and the occasional recipe from the boma.
                No noise — just the reserve, in your inbox.
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
