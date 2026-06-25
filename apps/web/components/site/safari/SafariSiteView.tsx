import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SafariNav, type SafariNavLink } from "./SafariNav";

import "./safari.css";

// The NenGama Lodge design ported into the CMS. Text is driven by the host's
// matching sections (by type); imagery + the bespoke layout come from the design
// so a fresh Safari site looks exactly like the example out of the box. Stock
// images are the design's original Unsplash URLs (external, hot-linked).

const IMG = {
  hero: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2400&q=80",
  intro:
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
  exp1: "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=1200&q=80",
  exp2: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1000&q=80",
  exp3: "https://images.unsplash.com/photo-1504675099198-7023dd85f5a3?w=1000&q=80",
  suite1:
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=80",
  suite2:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80",
  suite3:
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&q=80",
  g1: "https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=1200&q=80",
  g2: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=700&q=80",
  g3: "https://images.unsplash.com/photo-1501706362039-c06b2d715385?w=700&q=80",
  g4: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=700&q=80",
  g5: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&q=80",
  g6: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80",
  g7: "https://images.unsplash.com/photo-1502920514313-52581002a659?w=700&q=80",
  location:
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1100&q=80",
  cta: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2000&q=80",
};

const ARROW = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function findSection<T extends WebsiteSection["type"]>(
  sections: WebsiteSection[],
  type: T,
): Extract<WebsiteSection, { type: T }> | undefined {
  return sections.find(
    (s): s is Extract<WebsiteSection, { type: T }> => s.type === type,
  );
}

const STOCK_EXP = [
  {
    n: "01",
    title: "Game drives",
    body: "Twice daily in open Land Cruisers, tracking lion, elephant, leopard and the wide cast of the bushveld with rangers who grew up reading this land.",
    img: IMG.exp1,
  },
  {
    n: "02",
    title: "Walking safaris",
    body: "Step down from the vehicle and into the detail — tracks, scent, the small architecture of the bush — with an armed guide at your shoulder.",
    img: IMG.exp2,
  },
  {
    n: "03",
    title: "Boma dining",
    body: "Long tables, open coals and Limpopo wines under a sky thick with stars. Dinner here can run well past the last log.",
    img: IMG.exp3,
  },
];

const STOCK_SUITES = [
  {
    tag: "Sleeps 2 · Flagship",
    name: "Marula Suite",
    meta: ["Private plunge pool", "Waterhole deck"],
    desc: "The flagship — a glass-walled retreat above the waterhole with an outdoor bath and a deck made for doing nothing at all.",
    price: "R14,500",
    img: IMG.suite1,
  },
  {
    tag: "Sleeps 4 · Family",
    name: "Tamboti Suite",
    meta: ["Two bedrooms", "Private guide"],
    desc: "Two connected rooms under a single thatch, with a shaded family deck and a dedicated ranger for your stay.",
    price: "R18,900",
    img: IMG.suite2,
  },
  {
    tag: "Sleeps 2 · Tented",
    name: "Leadwood Tent",
    meta: ["Canvas & teak", "Star bed"],
    desc: "A canvas-and-teak tented suite set apart on the ridge, with a roll-back roof and a star bed for clear Waterberg nights.",
    price: "R11,500",
    img: IMG.suite3,
  },
];

const STOCK_REVIEWS = [
  {
    quote:
      "We came for the Big Five and left changed by the silence. Our ranger found a leopard at dawn and a kind of peace by dusk.",
    initials: "AM",
    name: "Anna & Marc",
    date: "May 2026 · Cape Town",
  },
  {
    quote:
      "The Marula Suite ruins you for ordinary hotels. Bath open to the bush, elephants at the waterhole over breakfast. Faultless.",
    initials: "TZ",
    name: "Thandi Z.",
    date: "Apr 2026 · Johannesburg",
  },
  {
    quote:
      "Booked direct, paid exactly what they quoted, and felt like the only people for miles. We're already back next winter.",
    initials: "JS",
    name: "James S.",
    date: "Mar 2026 · London",
  },
];

/**
 * Renders a Safari-themed site page exactly in the NenGama Lodge style. Server
 * component; the only client island is the scroll-aware nav. Mounted by
 * SitePageView when the active theme slug is `safari`.
 */
export function SafariSiteView({
  sections,
  brandName,
  navLinks,
  bookHref,
}: {
  sections: WebsiteSection[];
  brandName: string;
  navLinks: SafariNavLink[];
  bookHref?: string | null;
}) {
  const hero = findSection(sections, "hero")?.props;
  const intro = findSection(sections, "intro")?.props;
  const exp = findSection(sections, "highlights")?.props;
  const reviews = findSection(sections, "reviews")?.props;
  const location = findSection(sections, "location")?.props;
  const cta = findSection(sections, "cta")?.props;

  const monogram = (brandName.trim()[0] || "N").toUpperCase();
  const roomsHref =
    navLinks.find((l) => /suite|room/i.test(l.label))?.href || "#suites";
  const aboutHref = navLinks.find((l) => /about|story/i.test(l.label))?.href;
  const contactHref = navLinks.find((l) => /contact/i.test(l.label))?.href;
  const reserve = bookHref || roomsHref;

  const expItems =
    exp?.items && exp.items.length
      ? exp.items.map((it, i) => ({
          n: STOCK_EXP[i]?.n ?? `0${i + 1}`,
          title: it.title || STOCK_EXP[i]?.title || "",
          body: it.body || STOCK_EXP[i]?.body || "",
          img: STOCK_EXP[i]?.img ?? IMG.exp1,
        }))
      : STOCK_EXP;

  return (
    <div className="vilo-safari">
      {/* Theme-scoped fonts (only the Safari design uses them) — intentionally
          not in the root layout. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@300;400;500;600&family=Marcellus&display=swap"
      />

      <SafariNav
        brandName={brandName}
        monogram={monogram}
        tagline="Lodge · Direct booking"
        links={navLinks}
        bookHref={reserve}
      />

      <section className="hero">
        <div className="hero-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.hero} alt="" />
        </div>
        <div className="hero-inner">
          <div className="wrap">
            <span className="eyebrow">{brandName} · Private Reserve</span>
            <h1>{hero?.headline || "Where the wild keeps its silence"}</h1>
            <p className="hero-sub">
              {hero?.subheadline ||
                "A luxury retreat set on twelve thousand unfenced hectares of bushveld. A handful of suites, a handful of guests, and a horizon that belongs to no one."}
            </p>
            <div className="hero-cta">
              <a href={roomsHref} className="btn btn-primary btn-lg">
                <span>{hero?.cta_label || "Explore the suites"}</span>
              </a>
              {aboutHref ? (
                <a href={aboutHref} className="btn btn-on-dark btn-lg">
                  <span>Our story</span>
                </a>
              ) : null}
            </div>
            <div className="hero-meta">
              <div className="hm">
                <b>12,000</b>
                <span>Hectares</span>
              </div>
              <div className="div" />
              <div className="hm">
                <b>Big Five</b>
                <span>Free-roaming</span>
              </div>
              <div className="div" />
              <div className="hm">
                <b>
                  4.98
                  <span
                    className="stars"
                    style={{ fontSize: 11, marginLeft: 6 }}
                  >
                    ★★★★★
                  </span>
                </b>
                <span>214 guest stays</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="split wide-img">
            <div>
              <span className="eyebrow">An unfenced wilderness</span>
              <h2
                className="display"
                style={{
                  marginTop: 24,
                  fontSize: "clamp(2.2rem,4.4vw,3.6rem)",
                }}
              >
                {intro?.heading || "A house at the heart of the bush"}
              </h2>
              <p className="lead" style={{ marginTop: 26 }}>
                {intro?.body ||
                  "The lodge sits where the plateau folds into open grassland — no fences, no neighbours, no schedule but the light. Built by hand from local stone and leadwood, low against the land so the wilderness reaches right up to the door."}
              </p>
              {aboutHref ? (
                <div style={{ marginTop: 38 }}>
                  <a href={aboutHref} className="link-u">
                    Read our story {ARROW}
                  </a>
                </div>
              ) : null}
            </div>
            <div className="split-media">
              <div className="frame-img img-tall">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG.intro} alt="" />
              </div>
              <div className="stat-badge" style={{ right: -12, bottom: -24 }}>
                <b>2009</b>
                <span>Family-run since</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-dark">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Days here</span>
            <h2 className="display">
              {exp?.heading || "The reserve, unhurried"}
            </h2>
            <p className="lead">
              Everything is included, and nothing is compulsory. Your ranger
              shapes each day around the weather, the wildlife and exactly how
              far you feel like going.
            </p>
          </div>
          <div className="exp-grid">
            {expItems.map((e, i) => (
              <div key={e.title + i} className={`exp${i === 0 ? "tall" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.img} alt="" />
                <div className="exp-body">
                  <span className="n">{e.n}</span>
                  <h3>{e.title}</h3>
                  <p>{e.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="suites">
        <div className="wrap">
          <div
            className="sec-head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              maxWidth: "none",
              gap: 28,
              flexWrap: "wrap",
              marginBottom: 48,
            }}
          >
            <div style={{ maxWidth: 560 }}>
              <span className="eyebrow">Where you&apos;ll rest</span>
              <h2
                className="display"
                style={{
                  marginTop: 22,
                  fontSize: "clamp(2.2rem,4.4vw,3.6rem)",
                }}
              >
                Three suites, one horizon
              </h2>
            </div>
            <a href={roomsHref} className="link-u">
              All suites &amp; rates {ARROW}
            </a>
          </div>
          <div className="suites-grid">
            {STOCK_SUITES.map((s) => (
              <a key={s.name} href={roomsHref} className="suite-card">
                <div className="sc-media">
                  <span className="sc-tag">{s.tag}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.img} alt={s.name} />
                </div>
                <div className="sc-body">
                  <h3>{s.name}</h3>
                  <div className="sc-meta">
                    {s.meta.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                  <p className="sc-desc">{s.desc}</p>
                  <div className="sc-foot">
                    <div className="price">
                      {s.price}
                      <small>/ night</small>
                    </div>
                    <span className="link-u">View</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow center no-rule">A look around</span>
            <h2
              className="display"
              style={{ marginTop: 18, fontSize: "clamp(2.2rem,4.4vw,3.4rem)" }}
            >
              Moments from the reserve
            </h2>
          </div>
          <div className="gallery">
            <div className="g w2 h2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.g1} alt="" />
            </div>
            <div className="g">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.g2} alt="" />
            </div>
            <div className="g">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.g3} alt="" />
            </div>
            <div className="g">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.g4} alt="" />
            </div>
            <div className="g">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.g5} alt="" />
            </div>
            <div className="g w2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.g6} alt="" />
            </div>
            <div className="g">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.g7} alt="" />
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-dark">
        <div className="wrap">
          <div
            className="split"
            style={{ alignItems: "center", marginBottom: 56 }}
          >
            <div>
              <span className="eyebrow">Guest stays</span>
              <h2
                className="display"
                style={{
                  marginTop: 22,
                  fontSize: "clamp(2.2rem,4.4vw,3.4rem)",
                }}
              >
                {reviews?.heading || "Quiet that you can feel"}
              </h2>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "clamp(3.4rem,7vw,5rem)",
                  fontWeight: 500,
                  color: "var(--gold)",
                  lineHeight: 1,
                }}
              >
                4.98
              </div>
              <div>
                <div className="stars" style={{ fontSize: 18 }}>
                  ★★★★★
                </div>
                <p className="muted" style={{ marginTop: 8 }}>
                  214 verified guest stays across four seasons
                </p>
              </div>
            </div>
          </div>
          <div className="reviews">
            {STOCK_REVIEWS.map((r) => (
              <div key={r.initials} className="review">
                <span className="stars">★★★★★</span>
                <p>{r.quote}</p>
                <div className="who">
                  <span className="av">{r.initials}</span>
                  <div>
                    <div className="nm">{r.name}</div>
                    <div className="dt">{r.date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="split">
            <div>
              <span className="eyebrow">Finding us</span>
              <h2
                className="display"
                style={{ marginTop: 22, fontSize: "clamp(2rem,4vw,3.2rem)" }}
              >
                {location?.heading || "Deep in the wild"}
              </h2>
              <p className="muted" style={{ marginTop: 24, maxWidth: "52ch" }}>
                A malaria-free reserve a few hours from the city, or forty-five
                minutes by light aircraft to our private airstrip. Full
                directions follow your booking.
              </p>
              {contactHref ? (
                <div style={{ marginTop: 36 }}>
                  <a href={contactHref} className="btn btn-ghost">
                    <span>Directions &amp; transfers</span>
                  </a>
                </div>
              ) : null}
            </div>
            <div>
              <div
                className="frame-img img-sq"
                style={{ height: "100%", minHeight: 380 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG.location} alt="" style={{ height: "100%" }} />
              </div>
            </div>
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
              <h2 style={{ marginTop: 22 }}>
                {cta?.heading || "Your dates, under wide skies"}
              </h2>
              <p>
                {cta?.body ||
                  "Reserve straight with the lodge — no agents, no booking fees, no commission. Just your stay, arranged by the people who'll greet you at the gate."}
              </p>
              <div className="hero-cta">
                <a href={reserve} className="btn btn-light btn-lg">
                  <span>{cta?.button_label || "Check availability"}</span>
                </a>
                {contactHref ? (
                  <a href={contactHref} className="btn btn-on-dark btn-lg">
                    <span>Ask us anything</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          <div className="footer-top">
            <div>
              <span className="brand-name">{brandName}</span>
              <p className="footer-blurb">
                An unfenced wilderness lodge. Book direct for the best rate and
                a warmer welcome.
              </p>
            </div>
            <div className="foot-col">
              <span className="foot-head">Explore</span>
              {navLinks.slice(0, 4).map((l) => (
                <a key={l.href + l.label} href={l.href}>
                  {l.label}
                </a>
              ))}
            </div>
            <div className="foot-col">
              <span className="foot-head">Visit</span>
              {contactHref ? <a href={contactHref}>Contact</a> : null}
              <a href={reserve}>Book a stay</a>
            </div>
            <div className="foot-col">
              <span className="foot-head">Stay in touch</span>
              <p className="footer-blurb" style={{ marginTop: 0 }}>
                Quiet news from the reserve, a few times a year.
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {brandName}. All rights reserved.</span>
            <span className="foot-socials">
              <a href="#" aria-label="Instagram">
                Ig
              </a>
              <a href="#" aria-label="Facebook">
                Fb
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
