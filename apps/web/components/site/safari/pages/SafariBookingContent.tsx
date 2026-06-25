/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design port: copy uses literal apostrophes/quotes and external Unsplash imagery. */
export function SafariBookingContent() {
  return (
    <>
      <section
        className="section"
        style={{ paddingTop: "0", paddingBottom: "clamp(64px,8vw,110px)" }}
      >
        <div className="wrap">
          <div style={{ marginBottom: "8px" }}>
            <div className="crumbs" style={{ color: "var(--ink-soft)" }}>
              <a href="/rooms" style={{ color: "var(--accent)" }}>
                Suites
              </a>
              <span>·</span>
              <span>Reserve</span>
            </div>
            <h1
              className="display"
              style={{
                marginTop: "14px",
                fontSize: "clamp(2.2rem,4.6vw,3.4rem)",
              }}
            >
              Complete your reservation
            </h1>
          </div>

          <form
            className="checkout"
            data-booking
            data-rate="14500"
            id="bookingForm"
          >
            {/* LEFT: STEPS */}
            <div>
              {/* STEP 1 */}
              <div className="co-step">
                <div className="co-step-head">
                  <span className="co-num">1</span>
                  <h2>Your stay</h2>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Check in</label>
                    <input
                      type="date"
                      name="checkin"
                      defaultValue="2026-07-10"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Check out</label>
                    <input
                      type="date"
                      name="checkout"
                      defaultValue="2026-07-13"
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Guests</label>
                  <select name="guests">
                    <option value="1">1 guest</option>
                    <option value="2">2 guests</option>
                    <option value="3">3 guests</option>
                    <option value="4">4 guests</option>
                  </select>
                </div>
              </div>

              {/* STEP 2 */}
              <div className="co-step">
                <div className="co-step-head">
                  <span className="co-num">2</span>
                  <h2>Guest details</h2>
                </div>
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
                    <input type="tel" required placeholder="+27 ..." />
                  </div>
                </div>
                <div className="field">
                  <label>Country</label>
                  <select>
                    <option>South Africa</option>
                    <option>United Kingdom</option>
                    <option>United States</option>
                    <option>Germany</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="field">
                  <label>
                    Special requests{" "}
                    <span
                      style={{
                        textTransform: "none",
                        letterSpacing: "0",
                        opacity: ".7",
                      }}
                    >
                      (optional)
                    </span>
                  </label>
                  <textarea placeholder="Dietary needs, anniversaries, transfer details..."></textarea>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="co-step">
                <div className="co-step-head">
                  <span className="co-num">3</span>
                  <h2>Payment</h2>
                </div>
                <div className="field">
                  <label>Card number</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="4242 4242 4242 4242"
                    required
                  />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Expiry</label>
                    <input type="text" placeholder="MM / YY" required />
                  </div>
                  <div className="field">
                    <label>CVC</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="123"
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Name on card</label>
                  <input type="text" placeholder="N. Mokoena" required />
                </div>
                <div className="pay-note">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--green)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Encrypted &amp; secure. You won't be charged a booking fee —
                  not now, not ever.
                </div>
              </div>
            </div>

            {/* RIGHT: SUMMARY */}
            <aside>
              <div className="summary" data-d="1">
                <div className="sum-room">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    id="sumImg"
                    src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&q=80"
                    alt="Selected suite"
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
                      NenGama Lodge
                    </span>
                    <h4 id="sumSuite" style={{ marginTop: "4px" }}>
                      Marula Suite
                    </h4>
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
                <div className="sum-line">
                  <span>Dates</span>
                  <b>
                    <span data-fill="checkin">10 Jul</span> →{" "}
                    <span data-fill="checkout">13 Jul 2026</span>
                  </b>
                </div>
                <div className="sum-line">
                  <span data-rate-nights>R14,500 × 3 nights</span>
                  <b data-subtotal>R43,500</b>
                </div>
                <div className="sum-line">
                  <span>
                    Conservation levy{" "}
                    <span style={{ opacity: ".7" }}>(R280 pp / night)</span>
                  </span>
                  <b data-levy>R1,680</b>
                </div>
                <div className="sum-total">
                  <span className="lbl">Total to pay</span>
                  <span className="amt" data-total>
                    R45,180
                  </span>
                </div>
                <div className="no-fee">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>Booked direct · 0% booking fees</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  style={{ marginTop: "24px" }}
                >
                  <span>Pay &amp; confirm</span>
                </button>
                <p
                  className="muted center"
                  style={{ fontSize: "12.5px", marginTop: "14px" }}
                >
                  <span data-nights>3 nights</span> · free cancellation up to 14
                  days before arrival
                </p>
              </div>
            </aside>
          </form>
        </div>
      </section>
    </>
  );
}
