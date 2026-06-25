/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design port: copy uses literal apostrophes/quotes and external Unsplash imagery. */
export function SafariRoomsContent() {
  return (
    <>
      {/* PAGE HEAD */}
      <section className="page-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=2200&q=80"
          alt="A suite at NenGama Lodge"
        />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Suites</span>
          </div>
          <h1>
            Three suites,
            <br />
            one wild horizon
          </h1>
          <p>
            Each opens onto the reserve, each fully inclusive of meals, safaris
            and transfers. Choose the one that fits your stay.
          </p>
        </div>
      </section>

      {/* INCLUDED BAR */}
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
            <span className="tag-pill">
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
              All meals &amp; house wines
            </span>
            <span className="tag-pill">
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
              Two daily safaris
            </span>
            <span className="tag-pill">
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
              Airstrip transfers
            </span>
            <span className="tag-pill">
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
              0% booking fees
            </span>
          </div>
        </div>
      </section>

      {/* SUITE 1 */}
      <section className="section">
        <div className="wrap">
          <div className="split wide-img">
            <div className="split-media">
              <div className="frame-img img-wide">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1300&q=80"
                  alt="Marula Suite"
                />
              </div>
              <div
                className="stat-badge"
                style={{ right: "-12px", bottom: "-22px" }}
              >
                <b>R14,500</b>
                <span>Per night, inclusive</span>
              </div>
            </div>
            <div>
              <span className="eyebrow">Flagship · Sleeps 2</span>
              <h2
                className="display"
                style={{
                  marginTop: "20px",
                  fontSize: "clamp(2rem,4vw,3.2rem)",
                }}
              >
                Marula Suite
              </h2>
              <p
                className="muted"
                style={{ marginTop: "22px", maxWidth: "52ch" }}
              >
                A glass-walled retreat raised above the main waterhole. Wake to
                elephants below, soak in the outdoor stone bath, and watch the
                light change from a private deck and plunge pool.
              </p>
              <div className="amenity-grid" style={{ marginTop: "30px" }}>
                <div className="amenity">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path
                      d="M2 12h20M2 12a10 10 0 0 1 20 0M6 16h.01M10 16h.01M14 16h.01M18 16h.01"
                      strokeLinecap="round"
                    />
                  </svg>
                  Private plunge pool
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
                    <path d="M9 6 6.5 3.5a1 1 0 0 0-1.4 0L3.5 5.1a1 1 0 0 0 0 1.4L6 9" />
                    <path d="M3 21l6-6" />
                    <path d="M14 4l6 6" />
                    <path d="M21 3l-9 9" />
                  </svg>
                  Outdoor stone bath
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
                    <path d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                  Waterhole deck
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
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                  </svg>
                  King bed, air-conditioned
                </div>
              </div>
              <div
                style={{
                  marginTop: "36px",
                  display: "flex",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <a href="/rooms" className="btn btn-ghost">
                  <span>View suite</span>
                </a>
                <a href="/book" className="btn btn-primary">
                  <span>Reserve · R14,500</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SUITE 2 */}
      <section className="section bg-2">
        <div className="wrap">
          <div className="split reverse wide-img">
            <div className="split-media">
              <div className="frame-img img-wide">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1300&q=80"
                  alt="Tamboti Family Suite"
                />
              </div>
              <div
                className="stat-badge"
                style={{ left: "-12px", bottom: "-22px" }}
              >
                <b>R18,900</b>
                <span>Per night, inclusive</span>
              </div>
            </div>
            <div>
              <span className="eyebrow">Family · Sleeps 4</span>
              <h2
                className="display"
                style={{
                  marginTop: "20px",
                  fontSize: "clamp(2rem,4vw,3.2rem)",
                }}
              >
                Tamboti Suite
              </h2>
              <p
                className="muted"
                style={{ marginTop: "22px", maxWidth: "52ch" }}
              >
                Two connected bedrooms beneath a single thatch, built for
                families and friends travelling together. A shaded deck, a
                private guide, and enough space for everyone to find their own
                quiet.
              </p>
              <div className="amenity-grid" style={{ marginTop: "30px" }}>
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
                    <path d="M3 7v10M21 7v10M3 12h18M7 7a2 2 0 1 1 0-.01" />
                  </svg>
                  Two en-suite bedrooms
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
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                  Dedicated private ranger
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
                    <path d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                  Family deck &amp; fire pit
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
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                  </svg>
                  Child-friendly safaris
                </div>
              </div>
              <div
                style={{
                  marginTop: "36px",
                  display: "flex",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <a href="/rooms" className="btn btn-ghost">
                  <span>View suite</span>
                </a>
                <a href="/book" className="btn btn-primary">
                  <span>Reserve · R18,900</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SUITE 3 */}
      <section className="section">
        <div className="wrap">
          <div className="split wide-img">
            <div className="split-media">
              <div className="frame-img img-wide">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1300&q=80"
                  alt="Leadwood Tented Suite"
                />
              </div>
              <div
                className="stat-badge"
                style={{ right: "-12px", bottom: "-22px" }}
              >
                <b>R11,500</b>
                <span>Per night, inclusive</span>
              </div>
            </div>
            <div>
              <span className="eyebrow">Tented · Sleeps 2</span>
              <h2
                className="display"
                style={{
                  marginTop: "20px",
                  fontSize: "clamp(2rem,4vw,3.2rem)",
                }}
              >
                Leadwood Tent
              </h2>
              <p
                className="muted"
                style={{ marginTop: "22px", maxWidth: "52ch" }}
              >
                Canvas and teak, set apart on the ridge for those who want the
                bush at its closest. Roll back the roof above the bed and fall
                asleep beneath the full sweep of the Waterberg sky.
              </p>
              <div className="amenity-grid" style={{ marginTop: "30px" }}>
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
                    <path d="m2 20 10-16 10 16z" />
                    <path d="M12 4v16" />
                  </svg>
                  Canvas-and-teak tent
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
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                  </svg>
                  Roll-back star roof
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
                    <path d="M9 6 6.5 3.5a1 1 0 0 0-1.4 0L3.5 5.1a1 1 0 0 0 0 1.4L6 9" />
                    <path d="M3 21l6-6" />
                  </svg>
                  Open-air shower
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
                    <path d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                  Private ridge deck
                </div>
              </div>
              <div
                style={{
                  marginTop: "36px",
                  display: "flex",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <a href="/rooms" className="btn btn-ghost">
                  <span>View suite</span>
                </a>
                <a href="/book" className="btn btn-primary">
                  <span>Reserve · R11,500</span>
                </a>
              </div>
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
              src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2000&q=80"
              alt="Waterberg sunset"
            />
            <div className="cta-inner">
              <span
                className="tag-pill"
                style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}
              >
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
                Booked direct · 0% fees
              </span>
              <h2 style={{ marginTop: "22px" }}>Not sure which suite?</h2>
              <p>
                Tell us who's travelling and when. We'll suggest the right fit
                and hold your dates — no deposit to ask.
              </p>
              <div className="hero-cta">
                <a href="/contact" className="btn btn-light btn-lg">
                  <span>Ask the lodge</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
