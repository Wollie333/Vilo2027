/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design port: copy uses literal apostrophes/quotes and external Unsplash imagery. */
export function SafariThankYouContent() {
  return (
    <>
      <section className="ty-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="bgimg"
          src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2200&q=80"
          alt="Waterberg sunset"
        />
        <div className="ty-card">
          <div className="ty-check">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <span
            className="eyebrow center no-rule"
            style={{ marginTop: "20px", display: "inline-flex" }}
          >
            Reservation confirmed
          </span>
          <h1
            className="display"
            style={{ fontSize: "clamp(2.2rem,5vw,3.4rem)", marginTop: "14px" }}
          >
            You're booked, <span id="tyName">traveller</span>
          </h1>
          <p
            className="muted"
            style={{
              marginTop: "14px",
              maxWidth: "46ch",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            A confirmation is on its way to{" "}
            <b id="tyEmail" style={{ color: "var(--ink)", fontWeight: "500" }}>
              your inbox
            </b>
            . We can't wait to welcome you to the reserve.
          </p>
          <div className="ty-ref">
            Booking reference <b id="tyRef">NG-204815</b>
          </div>

          <div className="ty-summary">
            <div className="ty-sum-top">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                id="tyImg"
                src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=300&q=80"
                alt="Your suite"
              />
              <div>
                <span
                  className="muted"
                  style={{
                    fontSize: "11px",
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                  }}
                >
                  NenGama Lodge · Limpopo
                </span>
                <h3
                  id="tySuite"
                  style={{ fontSize: "1.5rem", marginTop: "4px" }}
                >
                  Marula Suite
                </h3>
                <div className="rating-line" style={{ marginTop: "6px" }}>
                  <span className="stars" style={{ fontSize: "12px" }}>
                    ★★★★★
                  </span>
                  <span className="muted" style={{ fontSize: "12.5px" }}>
                    Fully inclusive
                  </span>
                </div>
              </div>
            </div>
            <div className="ty-row">
              <span>Check in</span>
              <b id="tyIn">10 Jul 2026</b>
            </div>
            <div className="ty-row">
              <span>Check out</span>
              <b id="tyOut">13 Jul 2026</b>
            </div>
            <div className="ty-row">
              <span>Guests · nights</span>
              <b>
                <span id="tyGuests">2</span> guests ·{" "}
                <span id="tyNights">3</span> nights
              </b>
            </div>
            <div className="ty-total">
              <span
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: "12px",
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                }}
              >
                Total paid
              </span>
              <span className="amt" id="tyTotal">
                R45,180
              </span>
            </div>
          </div>

          <div className="ty-next">
            <div className="n">
              <div className="ic">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 6L2 7" />
                </svg>
              </div>
              <h4>Check your email</h4>
              <p>Your itinerary and what to pack are on the way.</p>
            </div>
            <div className="n">
              <div className="ic">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 4.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                </svg>
              </div>
              <h4>We'll arrange transfers</h4>
              <p>Send your flights and we'll meet you at the airstrip.</p>
            </div>
            <div className="n">
              <div className="ic">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                </svg>
              </div>
              <h4>Then, simply arrive</h4>
              <p>The bush, the fire and your ranger will be ready.</p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "14px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: "32px",
            }}
          >
            <a href="/" className="btn btn-primary btn-lg">
              <span>Back to home</span>
            </a>
            <a href="/contact" className="btn btn-ghost btn-lg">
              <span>Send our team your flights</span>
            </a>
          </div>
          <p
            className="muted"
            style={{ fontSize: "12.5px", marginTop: "22px" }}
          >
            Free cancellation up to 14 days before arrival · no booking fees
            were charged.
          </p>
        </div>
      </section>
    </>
  );
}
