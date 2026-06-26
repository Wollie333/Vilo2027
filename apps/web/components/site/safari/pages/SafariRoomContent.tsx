/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design port: copy uses literal apostrophes/quotes and external Unsplash imagery. */
export function SafariRoomContent() {
  return (
    <>
      {/* SUITE GALLERY HERO */}
      <section className="wrap">
        <div className="suite-hero">
          <div className="sh main">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1400&q=80"
              data-lb-src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=2000&q=80"
              alt="Marula Suite deck above the waterhole"
            />
          </div>
          <div className="sh">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900&q=80"
              data-lb-src="https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1600&q=80"
              alt="Suite bedroom"
            />
          </div>
          <div className="sh">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=900&q=80"
              data-lb-src="https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1600&q=80"
              alt="Outdoor bath"
            />
          </div>
          <button type="button" className="sh-count" data-lb-open>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="15" rx="2" />
              <circle cx="12" cy="12.5" r="3.2" />
              <path d="M8 5l1.5-2h5L16 5" />
            </svg>
            <span data-lb-count>View photos</span>
          </button>
        </div>
      </section>

      {/* TITLE + BOOKING */}
      <section
        className="section"
        style={{ paddingTop: "clamp(48px,6vw,72px)" }}
      >
        <div className="wrap">
          <div className="room-layout">
            {/* MAIN */}
            <div>
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="eyebrow no-rule">Flagship Suite</span>
                  <span className="rating-line">
                    <span className="stars">★★★★★</span>
                    <span className="muted">4.99 · 86 stays</span>
                  </span>
                </div>
                <h1
                  className="display"
                  style={{
                    marginTop: "16px",
                    fontSize: "clamp(2.6rem,5.5vw,4.4rem)",
                  }}
                >
                  Marula Suite
                </h1>
                <p className="lead" style={{ marginTop: "22px" }}>
                  Raised on stilts above the main waterhole, the Marula is
                  NenGama's most private retreat — a glass-walled room that all
                  but vanishes into the bush, with an outdoor stone bath, a
                  plunge pool, and a deck where elephants are the morning view.
                </p>
                <div className="spec-row">
                  <div className="spec">
                    <b>2</b>
                    <span>Guests</span>
                  </div>
                  <div className="spec">
                    <b>1</b>
                    <span>King bed</span>
                  </div>
                  <div className="spec">
                    <b>78m²</b>
                    <span>Suite &amp; deck</span>
                  </div>
                  <div className="spec">
                    <b>Big 5</b>
                    <span>From the bed</span>
                  </div>
                </div>
              </div>

              {/* THE SPACE */}
              <div style={{ marginTop: "48px" }}>
                <span className="eyebrow">The space</span>
                <h2
                  className="display"
                  style={{
                    marginTop: "18px",
                    fontSize: "clamp(1.8rem,3.4vw,2.6rem)",
                  }}
                >
                  Built to disappear into the bush
                </h2>
                <p
                  className="muted"
                  style={{ marginTop: "20px", maxWidth: "60ch" }}
                >
                  Floor-to-ceiling glass slides clean away so the room opens to
                  the air. Inside: a hand-built leadwood bed dressed in linen, a
                  deep freestanding tub, and a writing desk facing the plains.
                  Outside: a private deck, a plunge pool cut into the stone, and
                  a sala for afternoons spent doing gloriously little.
                </p>
              </div>

              {/* DETAIL IMAGES */}
              <div
                style={{
                  marginTop: "40px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                }}
              >
                <div className="frame-img img-wide">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80"
                    data-lb-src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=80"
                    alt="Bedroom interior"
                  />
                </div>
                <div className="frame-img img-wide">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1502920514313-52581002a659?w=900&q=80"
                    data-lb-src="https://images.unsplash.com/photo-1502920514313-52581002a659?w=1600&q=80"
                    alt="Elephant at the waterhole below the deck"
                  />
                </div>
              </div>

              {/* AMENITIES */}
              <div style={{ marginTop: "52px" }}>
                <span className="eyebrow">In the suite</span>
                <h2
                  className="display"
                  style={{
                    marginTop: "18px",
                    fontSize: "clamp(1.8rem,3.4vw,2.6rem)",
                  }}
                >
                  Everything, thought of
                </h2>
                <div className="amenity-grid" style={{ marginTop: "28px" }}>
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
                      <path d="M2 12h20M2 12a10 10 0 0 1 20 0" />
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
                      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                    </svg>
                    Climate control &amp; ceiling fan
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
                    Private waterhole deck &amp; sala
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
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                    24-hour butler service
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
                      <path d="M4 19V5l8 4 8-4v14l-8-4z" />
                    </svg>
                    Mini bar &amp; espresso, restocked daily
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
                      <path d="M5 12.5 10 17l9-9" />
                    </svg>
                    Eco toiletries &amp; sun kit
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
                      <path d="M2 20h20M4 20V8l8-5 8 5v12" />
                    </svg>
                    Solar power &amp; Wi-Fi in the lodge
                  </div>
                </div>
              </div>

              {/* INCLUDED */}
              <div
                style={{
                  marginTop: "52px",
                  padding: "32px",
                  background: "var(--bg-2)",
                  borderRadius: "4px",
                }}
              >
                <h3 style={{ fontSize: "1.6rem" }}>Your rate includes</h3>
                <div className="amenity-grid" style={{ marginTop: "20px" }}>
                  <div className="amenity">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    All meals, teas &amp; house wines
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
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Two daily safari activities
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
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Guided bush walks
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
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Return airstrip transfers
                  </div>
                </div>
              </div>
            </div>

            {/* BOOKING CARD */}
            <aside>
              <div className="bk-card" data-booking data-rate="14500">
                <div className="bk-rate">
                  <span className="amt">R14,500</span>
                  <span className="muted">/ night · inclusive</span>
                </div>
                <div className="bk-grid">
                  <div className="field" style={{ marginBottom: "14px" }}>
                    <label>Check in</label>
                    <input
                      type="date"
                      name="checkin"
                      defaultValue="2026-07-10"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: "14px" }}>
                    <label>Check out</label>
                    <input
                      type="date"
                      name="checkout"
                      defaultValue="2026-07-13"
                    />
                  </div>
                </div>
                <div className="field" style={{ marginBottom: "18px" }}>
                  <label>Guests</label>
                  <select name="guests" defaultValue="2">
                    <option value="1">1 guest</option>
                    <option value="2">2 guests</option>
                  </select>
                </div>
                <div
                  className="sum-line"
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingTop: "16px",
                  }}
                >
                  <span data-rate-nights>R14,500 × 3 nights</span>
                  <b data-subtotal>R43,500</b>
                </div>
                <div className="sum-line">
                  <span>Conservation levy</span>
                  <b data-levy>R1,680</b>
                </div>
                <div className="sum-total" style={{ marginTop: "4px" }}>
                  <span className="lbl">Total</span>
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
                  <span>
                    <span data-nights>3 nights</span> · no booking fees, ever
                  </span>
                </div>
                <a
                  href="/book"
                  className="btn btn-primary btn-lg btn-block"
                  style={{ marginTop: "22px" }}
                >
                  <span>Reserve this suite</span>
                </a>
                <p
                  className="muted center"
                  style={{ fontSize: "12.5px", marginTop: "14px" }}
                >
                  No deposit to enquire · free cancellation up to 14 days before
                  arrival
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* OTHER SUITES */}
      <section className="section bg-2">
        <div className="wrap">
          <div
            className="sec-head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              maxWidth: "none",
              gap: "24px",
              flexWrap: "wrap",
              marginBottom: "44px",
            }}
          >
            <div>
              <span className="eyebrow">Also at the lodge</span>
              <h2
                className="display"
                style={{
                  marginTop: "20px",
                  fontSize: "clamp(2rem,4vw,3.2rem)",
                }}
              >
                The other two suites
              </h2>
            </div>
            <a href="/rooms" className="link-u">
              All suites{" "}
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
            </a>
          </div>
          <div
            className="suites-grid"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            <a href="/rooms" className="suite-card">
              <div className="sc-media">
                <span className="sc-tag">Sleeps 4 · Family</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80"
                  alt="Tamboti Suite"
                />
              </div>
              <div className="sc-body">
                <h3>Tamboti Suite</h3>
                <div className="sc-meta">
                  <span>Two bedrooms</span>
                  <span>Private guide</span>
                </div>
                <p className="sc-desc">
                  Two connected rooms under one thatch, with a shaded family
                  deck and a dedicated ranger.
                </p>
                <div className="sc-foot">
                  <div className="price">
                    R18,900<small>/ night</small>
                  </div>
                  <span className="link-u">View</span>
                </div>
              </div>
            </a>
            <a href="/rooms" className="suite-card">
              <div className="sc-media">
                <span className="sc-tag">Sleeps 2 · Tented</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&q=80"
                  alt="Leadwood Tent"
                />
              </div>
              <div className="sc-body">
                <h3>Leadwood Tent</h3>
                <div className="sc-meta">
                  <span>Canvas &amp; teak</span>
                  <span>Star bed</span>
                </div>
                <p className="sc-desc">
                  A canvas-and-teak tented suite on the ridge, with a roll-back
                  roof for clear Waterberg nights.
                </p>
                <div className="sc-foot">
                  <div className="price">
                    R11,500<small>/ night</small>
                  </div>
                  <span className="link-u">View</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
