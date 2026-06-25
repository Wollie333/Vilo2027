/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design port: copy uses literal apostrophes/quotes and external Unsplash imagery. */
export function SafariContactContent() {
  return (
    <>
      {/* PAGE HEAD */}
      <section
        className="page-head"
        style={{ minHeight: "clamp(360px,48vh,480px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=2200&q=80"
          alt="Bush path at golden hour"
        />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Contact</span>
          </div>
          <h1>Let's plan your stay</h1>
          <p>
            Tell us who's travelling and when. A real person at the lodge
            replies within a day — often the same one who'll meet you at the
            gate.
          </p>
        </div>
      </section>

      {/* CONTACT */}
      <section className="section">
        <div className="wrap">
          <div className="contact-grid">
            {/* FORM */}
            <div>
              <span className="eyebrow">Send a message</span>
              <h2
                className="display"
                style={{
                  marginTop: "18px",
                  fontSize: "clamp(1.9rem,3.6vw,2.8rem)",
                }}
              >
                Enquire &amp; hold dates
              </h2>
              <form id="contactForm" style={{ marginTop: "32px" }}>
                <div className="field-row">
                  <div className="field">
                    <label>First name</label>
                    <input type="text" required placeholder="Naledi" />
                  </div>
                  <div className="field">
                    <label>Last name</label>
                    <input type="text" required placeholder="Mokoena" />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Email</label>
                    <input type="email" required placeholder="you@email.com" />
                  </div>
                  <div className="field">
                    <label>Phone</label>
                    <input type="tel" placeholder="+27 ..." />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Preferred suite</label>
                    <select>
                      <option>No preference</option>
                      <option>Marula Suite</option>
                      <option>Tamboti Suite</option>
                      <option>Leadwood Tent</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Guests</label>
                    <select>
                      <option>2 guests</option>
                      <option>1 guest</option>
                      <option>3 guests</option>
                      <option>4 guests</option>
                    </select>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Approx. arrival</label>
                    <input type="date" />
                  </div>
                  <div className="field">
                    <label>Nights</label>
                    <input type="number" min="1" value="3" />
                  </div>
                </div>
                <div className="field">
                  <label>Anything we should know?</label>
                  <textarea placeholder="Anniversaries, dietary needs, dream sightings, transfers from Johannesburg..."></textarea>
                </div>
                <button type="button" className="btn btn-primary btn-lg">
                  <span>Send enquiry</span>
                </button>
              </form>
              <div className="sent-msg" id="sentMsg">
                <div style={{ color: "var(--green)" }}>
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ margin: "0 auto" }}
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h3 style={{ fontSize: "1.8rem", marginTop: "14px" }}>
                  Thank you — message sent
                </h3>
                <p className="muted" style={{ marginTop: "10px" }}>
                  We've got your enquiry and will reply within a day. Keep an
                  eye on your inbox.
                </p>
              </div>
            </div>

            {/* DETAILS */}
            <div>
              <div className="detail-card">
                <div className="dc-row">
                  <span className="ic">
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
                      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
                    </svg>
                  </span>
                  <div>
                    <div className="t">+27 14 880 0192</div>
                    <div className="d">Reservations · 7am–8pm SAST</div>
                  </div>
                </div>
                <div className="dc-row">
                  <span className="ic">
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
                  </span>
                  <div>
                    <div className="t">stay@nengama.co.za</div>
                    <div className="d">We reply within one day</div>
                  </div>
                </div>
                <div className="dc-row">
                  <span className="ic">
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
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <div>
                    <div className="t">NenGama Private Reserve</div>
                    <div className="d">
                      Waterberg Biosphere, Vaalwater, Limpopo 0530
                    </div>
                  </div>
                </div>
                <div className="dc-row">
                  <span className="ic">
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
                  </span>
                  <div>
                    <div className="t">Private airstrip</div>
                    <div className="d">
                      45 min from Johannesburg · charters arranged
                    </div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: "18px",
                  padding: "22px 24px",
                  background: "var(--bg-2)",
                  borderRadius: "4px",
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <span style={{ color: "var(--green)", flexShrink: "0" }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <p style={{ fontSize: "14px", color: "var(--ink-soft)" }}>
                  Book direct and you pay exactly what we quote — no agents, no
                  booking fees, no commission.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAP */}
      <section className="section-sm" style={{ paddingTop: "0" }}>
        <div className="wrap">
          <div className="map-ph">
            <span className="map-pin"></span>
            <div className="map-tag">
              📍 NenGama Private Reserve · 24°18′S 28°06′E · Waterberg, Limpopo
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section bg-2">
        <div className="wrap-narrow">
          <div className="sec-head center" style={{ marginBottom: "40px" }}>
            <span className="eyebrow center no-rule">Good to know</span>
            <h2
              className="display"
              style={{ marginTop: "18px", fontSize: "clamp(2rem,4vw,3rem)" }}
            >
              Frequently asked
            </h2>
          </div>
          <div>
            <details className="faq-item" open>
              <summary>
                How do I get to the lodge?
                <span className="pm">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p>
                It's a scenic 3.5-hour drive from Johannesburg, or 45 minutes by
                light aircraft to our private airstrip. We arrange road and air
                transfers for every guest — just tell us your inbound flight.
              </p>
            </details>
            <details className="faq-item">
              <summary>
                Is the reserve malaria-free?
                <span className="pm">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p>
                Yes. The Waterberg is a certified malaria-free region, which
                makes NenGama an excellent choice for families with young
                children and travellers who'd rather skip the prophylactics.
              </p>
            </details>
            <details className="faq-item">
              <summary>
                What's included in the rate?
                <span className="pm">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p>
                Everything but the journey here: your suite, all meals, teas and
                house wines, two daily safari activities, guided bush walks, and
                return airstrip transfers. The only extra shown at checkout is a
                small per-person conservation levy that funds the reserve.
              </p>
            </details>
            <details className="faq-item">
              <summary>
                Are children welcome?
                <span className="pm">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p>
                Very. The Tamboti Family Suite is built for them, and our guides
                run shorter, child-paced drives and bush-skills sessions. Little
                ones under six stay free.
              </p>
            </details>
            <details className="faq-item">
              <summary>
                What's your cancellation policy?
                <span className="pm">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p>
                Free cancellation up to 14 days before arrival, with a full
                refund. Inside 14 days we'll always try to move your dates
                rather than charge you. Because you book direct, there are no
                agency fees layered on top.
              </p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
