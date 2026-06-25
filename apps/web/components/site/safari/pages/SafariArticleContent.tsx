/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design port: copy uses literal apostrophes/quotes and external Unsplash imagery. */
export function SafariArticleContent() {
  return (
    <>
      {/* POST HERO */}
      <section
        className="page-head"
        style={{ minHeight: "clamp(440px,62vh,620px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1504675099198-7023dd85f5a3?w=2200&q=80"
          alt="A long table laid for dinner in the open"
        />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <a href="/blog">Journal</a>
            <span>·</span>
            <span>Table &amp; Cellar</span>
          </div>
          <h1 style={{ maxWidth: "18ch" }}>A table under the stars</h1>
          <div
            className="post-meta"
            style={{ color: "rgba(255,255,255,.82)", marginTop: "22px" }}
          >
            <span>Chef Anele · Head of Kitchen</span>
            <span className="dot"></span>
            <span>14 May 2026</span>
            <span className="dot"></span>
            <span>6 min read</span>
          </div>
        </div>
      </section>

      {/* ARTICLE */}
      <section className="section">
        <article className="article">
          <p className="lead-p">
            Ask any of our guests what they remember most, and surprisingly few
            of them say the lions. More often, they say the dinner — the night
            we ate around the fire, under more stars than they had ever seen.
          </p>

          <p className="dropcap">
            The boma is the oldest idea we have. A circle of low stone walls,
            open to the sky, with a fire at its centre — a place to gather after
            dark, where the light keeps the night at a respectful distance and
            the conversation runs long. We didn't invent it; the bush did,
            generations ago. We simply set a good table inside it and let the
            rest take care of itself.
          </p>

          <p>
            Cooking here is governed by the fire and the seasons, in that order.
            Most of what reaches the table has spent time over coals —
            slow-roasted lamb shoulder rubbed with rosemary from the kitchen
            garden, line fish wrapped in vine leaves, vegetables charred until
            they are sweet. We grow what we can on the reserve and buy the rest
            from farms within an hour's drive. Nothing travels further than it
            has to.
          </p>

          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1300&q=80"
              alt="The sky over the reserve as dinner begins"
            />
            <figcaption>
              Dinner begins as the last light leaves the ridge and the first
              stars arrive.
            </figcaption>
          </figure>

          <h2>A cellar with a sense of place</h2>
          <p>
            We are a long way from the Cape winelands, but South Africa's wine
            finds its way to us. The cellar leans local and unhurried —
            Swartland syrah, old-vine chenin, the occasional bottle from a
            grower we've come to know by name. Our sommelier's only rule is that
            the wine should taste of somewhere, the way the food does.
          </p>

          <blockquote>
            "A good dinner in the bush isn't about luxury. It's about time — the
            one thing the city never gives you enough of."
            <cite>— Chef Anele</cite>
          </blockquote>

          <p>
            There is no set menu in the way a restaurant would mean it. Each
            evening is built around what the gardens and the season are
            offering, and around you — your appetites, your celebrations, the
            dietary notes you sent us before you arrived. If it's an
            anniversary, we'll know. If you fell in love with something at
            lunch, we'll find a way to bring it back.
          </p>

          <h2>The part nobody photographs</h2>
          <p>
            The food matters, but it is not really the point. The point is what
            happens around it. With no screens, no rush and nowhere else to be,
            dinner stretches. Strangers at the start of a stay become a table of
            friends by the end of it. The fire burns down, someone asks for one
            more glass, and the guides start telling the stories they don't tell
            on the vehicle.
          </p>
          <ul>
            <li>
              Dinner is served under the open sky whenever the weather allows.
            </li>
            <li>Every menu is shaped around the season — and around you.</li>
            <li>House wines, teas and coffees are included, always.</li>
          </ul>
          <p>
            By the time you walk back to your suite, torch in hand, the Milky
            Way is directly overhead and the bush is loud with the small
            business of the night. You will have eaten well. But it's the hours,
            not the courses, you'll remember.
          </p>
        </article>

        {/* AUTHOR + SHARE */}
        <div className="article" style={{ marginTop: "56px" }}>
          <hr className="rule" />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "24px",
              flexWrap: "wrap",
              marginTop: "32px",
            }}
          >
            <div className="author-row">
              <span className="av">A</span>
              <div>
                <div
                  style={{ fontFamily: "var(--serif)", fontSize: "1.35rem" }}
                >
                  Chef Anele
                </div>
                <div className="muted" style={{ fontSize: "13px" }}>
                  Head of Kitchen · NenGama Lodge
                </div>
              </div>
            </div>
            <div className="share-row">
              <a href="/" aria-label="Share on Instagram">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle
                    cx="17.5"
                    cy="6.5"
                    r="1"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </a>
              <a href="/" aria-label="Share on Facebook">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              <a href="/" aria-label="Copy link">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
                  <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* RELATED */}
      <section
        className="section bg-2"
        style={{ paddingTop: "clamp(56px,7vw,90px)" }}
      >
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
              marginBottom: "40px",
            }}
          >
            <div>
              <span className="eyebrow">Keep reading</span>
              <h2
                className="display"
                style={{
                  marginTop: "18px",
                  fontSize: "clamp(1.9rem,3.6vw,2.8rem)",
                }}
              >
                More from the journal
              </h2>
            </div>
            <a href="/blog" className="link-u">
              All field notes{" "}
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
          <div className="post-grid">
            <a href="/blog" className="post-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="pc-media">
                <img
                  src="https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=900&q=80"
                  alt="A tracker at dawn"
                />
              </div>
              <span className="post-cat" style={{ marginTop: "18px" }}>
                Field Notes
              </span>
              <h3>Reading the tracks: a morning with our head tracker</h3>
              <div className="post-meta">
                <span>Tebogo Modise</span>
                <span className="dot"></span>
                <span>7 min</span>
              </div>
            </a>
            <a href="/blog" className="post-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="pc-media">
                <img
                  src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80"
                  alt="Restored grassland"
                />
              </div>
              <span className="post-cat" style={{ marginTop: "18px" }}>
                Conservation
              </span>
              <h3>
                Twelve thousand hectares: how a cattle farm became wild again
              </h3>
              <div className="post-meta">
                <span>Naledi Mokoena</span>
                <span className="dot"></span>
                <span>9 min</span>
              </div>
            </a>
            <a href="/rooms" className="post-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="pc-media">
                <img
                  src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80"
                  alt="A suite at the lodge"
                />
              </div>
              <span className="post-cat" style={{ marginTop: "18px" }}>
                Stay
              </span>
              <h3>Where you'll sleep: the suites at NenGama</h3>
              <div className="post-meta">
                <span>From R11,500 / night</span>
              </div>
            </a>
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
              <h2>Pull up a chair at the fire</h2>
              <p>
                Long dinners under the stars, included in every stay. Book
                direct — the price you see is the price you pay.
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
