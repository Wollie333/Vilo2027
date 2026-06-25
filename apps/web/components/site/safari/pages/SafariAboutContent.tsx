/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design port: copy uses literal apostrophes/quotes and external Unsplash imagery. */
export function SafariAboutContent() {
  return (
    <>
      {/* PAGE HEAD */}
      <section className="page-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=2200&q=80"
          alt="Open grassland of the reserve"
        />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>About</span>
          </div>
          <h1>
            A family, a fence line
            <br />
            we chose to remove
          </h1>
          <p>
            Since 2009 we've given this corner of the Waterberg back to the wild
            — and opened just three doors to share it.
          </p>
        </div>
      </section>

      {/* STORY */}
      <section className="section">
        <div className="wrap">
          <div className="split wide-img">
            <div>
              <span className="eyebrow">Our story</span>
              <h2
                className="display"
                style={{
                  marginTop: "24px",
                  fontSize: "clamp(2.1rem,4.2vw,3.4rem)",
                }}
              >
                The land came first
              </h2>
              <p className="lead" style={{ marginTop: "26px" }}>
                NenGama began as a worn-out cattle farm — overgrazed, fenced
                into squares, its wildlife long gone. The Mokoena family bought
                the first 3,000 hectares in 2009 with a single idea: take the
                fences down and let the bush decide what it wanted to be.
              </p>
              <p
                className="muted"
                style={{ marginTop: "20px", maxWidth: "56ch" }}
              >
                Fifteen years on, those squares are one unbroken wilderness of
                twelve thousand hectares. The grass came back, then the
                antelope, then the predators that follow them. Today lion,
                elephant, leopard, buffalo and rhino move freely across land
                that was once silent.
              </p>
              <p
                className="muted"
                style={{ marginTop: "20px", maxWidth: "56ch" }}
              >
                The lodge was always meant to be small. Three suites, a handful
                of guests, and just enough comfort to disappear into the rhythm
                of the reserve — never enough to disturb it.
              </p>
            </div>
            <div className="split-media">
              <div className="frame-img img-tall">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200&q=80"
                  alt="Sunset over the restored reserve"
                />
              </div>
              <div
                className="stat-badge"
                style={{ left: "-12px", bottom: "-24px" }}
              >
                <b>12,000</b>
                <span>Hectares rewilded</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAND */}
      <section className="section-sm bg-dark">
        <div className="wrap">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: "32px",
              textAlign: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "clamp(2.6rem,5vw,4rem)",
                  color: "var(--gold)",
                  lineHeight: "1",
                }}
              >
                15
              </div>
              <div
                className="muted"
                style={{
                  fontSize: "12px",
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  marginTop: "10px",
                }}
              >
                Years rewilding
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "clamp(2.6rem,5vw,4rem)",
                  color: "var(--gold)",
                  lineHeight: "1",
                }}
              >
                3
              </div>
              <div
                className="muted"
                style={{
                  fontSize: "12px",
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  marginTop: "10px",
                }}
              >
                Suites only
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "clamp(2.6rem,5vw,4rem)",
                  color: "var(--gold)",
                  lineHeight: "1",
                }}
              >
                340+
              </div>
              <div
                className="muted"
                style={{
                  fontSize: "12px",
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  marginTop: "10px",
                }}
              >
                Species recorded
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "clamp(2.6rem,5vw,4rem)",
                  color: "var(--gold)",
                  lineHeight: "1",
                }}
              >
                0
              </div>
              <div
                className="muted"
                style={{
                  fontSize: "12px",
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  marginTop: "10px",
                }}
              >
                Internal fences
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONSERVATION */}
      <section className="section">
        <div className="wrap">
          <div className="split reverse">
            <div className="split-media">
              <div className="frame-img img-wide">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=1200&q=80"
                  alt="Giraffe browsing on the reserve"
                />
              </div>
            </div>
            <div>
              <span className="eyebrow">Conservation</span>
              <h2
                className="display"
                style={{
                  marginTop: "24px",
                  fontSize: "clamp(2rem,4vw,3.2rem)",
                }}
              >
                Every stay protects the wild
              </h2>
              <p
                className="muted"
                style={{ marginTop: "24px", maxWidth: "54ch" }}
              >
                We keep the lodge small on purpose. Fewer guests means lighter
                footprints and a bigger share of every booking going where it
                matters — into the land and the people who guard it.
              </p>
              <div
                className="amenity-grid"
                style={{ marginTop: "34px", gridTemplateColumns: "1fr" }}
              >
                <div className="amenity">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  A full-time anti-poaching unit on the reserve
                </div>
                <div className="amenity">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Black &amp; white rhino monitored daily
                </div>
                <div className="amenity">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  40 local people employed from neighbouring villages
                </div>
                <div className="amenity">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Borehole-fed waterholes through the dry season
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER NOTE */}
      <section className="section bg-2">
        <div className="wrap-narrow center">
          <span className="eyebrow center no-rule">A note from the family</span>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(1.6rem,3.2vw,2.5rem)",
              lineHeight: "1.32",
              marginTop: "28px",
              color: "var(--ink)",
            }}
          >
            "We don't think of ourselves as hoteliers. We're custodians who
            happen to keep three beautiful rooms. Come as our guests, leave as
            part of the reason this place still exists."
          </p>
          <div
            style={{
              marginTop: "34px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontFamily: "var(--serif)", fontSize: "1.5rem" }}>
              Lethabo &amp; Naledi Mokoena
            </span>
            <span
              className="muted"
              style={{
                fontSize: "12px",
                letterSpacing: ".2em",
                textTransform: "uppercase",
              }}
            >
              Founders · NenGama Lodge
            </span>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow center no-rule">How we host</span>
            <h2
              className="display"
              style={{
                marginTop: "18px",
                fontSize: "clamp(2.1rem,4.2vw,3.4rem)",
              }}
            >
              Three quiet promises
            </h2>
          </div>
          <div className="feat-row">
            <div className="feat">
              <span className="kicker-num">01</span>
              <h3>Space, not crowds</h3>
              <p>
                Never more than six guests in the vehicle, and often it's just
                you and your ranger under the whole sky.
              </p>
            </div>
            <div className="feat">
              <span className="kicker-num">02</span>
              <h3>Honest pricing</h3>
              <p>
                One inclusive rate, booked direct with us. No agents, no booking
                fees, no commission. The price you're quoted is the price you
                pay.
              </p>
            </div>
            <div className="feat">
              <span className="kicker-num">03</span>
              <h3>People of this place</h3>
              <p>
                Our guides, trackers and cooks were raised in the Waterberg.
                Their knowledge isn't trained — it's inherited.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-sm">
        <div className="wrap">
          <div className="cta-band">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1502920514313-52581002a659?w=2000&q=80"
              alt="Elephant at the waterhole"
            />
            <div className="cta-inner">
              <h2>Come see what came back</h2>
              <p>
                Three suites, twelve thousand hectares, and a family who'll meet
                you at the gate.
              </p>
              <div className="hero-cta">
                <a href="/rooms" className="btn btn-light btn-lg">
                  <span>View the suites</span>
                </a>
                <a href="/contact" className="btn btn-on-dark btn-lg">
                  <span>Plan a visit</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
