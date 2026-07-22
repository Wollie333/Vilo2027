import "./royalSpecial.css";

import type { CSSProperties } from "react";

import { Money } from "@/components/currency/Money";
import { siteImageUrl } from "@/lib/site/image";
import type { SiteSpecialDetail } from "@/lib/site/loadSitePage";
import type { SpecialCard } from "@/lib/site/types";

const Check = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

type Fact = { icon: React.ReactNode; title: string; body: string };

const IconCalendar = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </svg>
);
const IconMoon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);
const IconGuests = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconBed = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 18v-6.5A2.5 2.5 0 0 1 5.5 9h13A2.5 2.5 0 0 1 21 11.5V18M3 14h18M3 18v2M21 18v2" />
  </svg>
);
const IconClock = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/**
 * Royal Hotel SPECIAL/offer-detail page (preset `royal`) — the founder's bespoke
 * GRAND-HOTEL design, forked from OceansViewSpecialDetail into Royal's own
 * component + stylesheet (`.rspecial` / royalSpecial.css). A single offer laid out
 * formally: breadcrumb → framed editorial hero (champagne badge overlay) → formal
 * title under a thin champagne rule + prose + a hairline-ruled "The details" facts
 * roster, a sticky booking card (now/was/save + a real `data-wielo-book` CTA), and
 * a "more offers" strip. Built INLINE (no shared sub-component), mirroring the
 * OceansView reference. Omit-rather-than-fabricate: only facts that exist render.
 * Colour/type/shape via the `.wielo-royal` skin's `--site-*` tokens (champagne
 * accent, espresso secondary, charcoal navy, Archivo). Server-rendered; renders
 * INSIDE the themed chrome (nav/footer from SiteChrome).
 */
export function RoyalSpecialDetail({
  special,
  otherSpecials,
  specialsHref,
  asset,
}: {
  special: SiteSpecialDetail;
  otherSpecials: SpecialCard[];
  specialsHref: string;
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const hero = special.imageUrl
    ? (asset(special.imageUrl) ?? special.imageUrl)
    : null;

  // Price bits (reuse the listing's now/was/save treatment).
  const hasNow = special.price != null;
  const hasWas = special.wasPrice != null;
  const per = special.priceMode === "flat" ? "package" : "/ night";
  const savePct =
    special.savingsPct != null && special.savingsPct > 0
      ? special.savingsPct
      : null;
  const saveAmt =
    savePct == null &&
    special.savingsAmount != null &&
    special.savingsAmount > 0
      ? special.savingsAmount
      : null;

  // Description → paragraphs (first is the lead, the rest is body prose).
  const desc = (special.description ?? "").trim();
  const paras = desc
    ? desc
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];
  const lead = paras[0] ?? "";
  const bodyParas = paras.slice(1);

  // ── offer facts — only render the ones that actually exist ─────────────────
  const facts: Fact[] = [];

  // Validity window.
  let validity: string | null = null;
  if (special.isEvergreen) validity = "Always available";
  else if (special.checkIn && special.checkOut)
    validity = `Stay ${special.checkIn} – ${special.checkOut}`;
  else if (special.windowStart && special.windowEnd)
    validity = `Valid ${special.windowStart} – ${special.windowEnd}`;
  else if (special.checkIn) validity = `Stay from ${special.checkIn}`;
  else if (special.windowStart) validity = `Valid from ${special.windowStart}`;
  if (validity)
    facts.push({ icon: <IconCalendar />, title: "When", body: validity });
  if (special.bookBy)
    facts.push({
      icon: <IconClock />,
      title: "Book by",
      body: special.bookBy,
    });

  // Stay length.
  const nights: string[] = [];
  if (special.minNights != null)
    nights.push(
      `Min ${special.minNights} night${special.minNights === 1 ? "" : "s"}`,
    );
  if (special.maxNights != null)
    nights.push(
      `Max ${special.maxNights} night${special.maxNights === 1 ? "" : "s"}`,
    );
  if (nights.length > 0)
    facts.push({
      icon: <IconMoon />,
      title: "Stay length",
      body: nights.join(" · "),
    });
  if (special.maxGuests != null)
    facts.push({
      icon: <IconGuests />,
      title: "Guests",
      body: `Up to ${special.maxGuests} guest${special.maxGuests === 1 ? "" : "s"}`,
    });

  // Applicable room.
  if (special.roomName)
    facts.push({
      icon: <IconBed />,
      title: "Applies to",
      body: special.roomName,
    });

  const scarce = special.remaining > 0 && special.remaining <= 5;

  // Other offers — the parent already excluded the current one.
  const others = otherSpecials.filter((s) => s.title);

  return (
    <div className="rspecial">
      {/* breadcrumbs */}
      <section className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span className="sep">/</span>
          <a href={specialsHref}>Specials</a>
          <span className="sep">/</span>
          <span className="cur">{special.title}</span>
        </nav>
      </section>

      {/* hero */}
      {hero ? (
        <section className="wrap">
          <div className="hero">
            {special.badge ? (
              <span className="hero-badge">{special.badge}</span>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteImageUrl(hero, { width: 2560 })}
              alt={special.title}
            />
          </div>
        </section>
      ) : null}

      {/* title + facts + booking */}
      <section
        className="section"
        style={{ paddingTop: "clamp(44px,5vw,64px)" }}
      >
        <div className="wrap">
          <div className="olayout">
            <div>
              <span className="tag">Special offer</span>
              <h1 className="xl">{special.title}</h1>
              {special.propertyName ? (
                <p className="place">{special.propertyName}</p>
              ) : null}

              {lead ? <p className="lead">{lead}</p> : null}
              {bodyParas.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  {bodyParas.map((para, i) => (
                    <p
                      key={i}
                      className="muted"
                      style={{
                        marginTop: i === 0 ? 0 : 16,
                        maxWidth: "60ch",
                        lineHeight: 1.6,
                      }}
                    >
                      {para}
                    </p>
                  ))}
                </div>
              ) : null}

              {facts.length > 0 ? (
                <div style={{ marginTop: 40 }} data-reveal>
                  <h2
                    className="lg"
                    style={{ fontSize: "clamp(1.6rem,3vw,2.3rem)" }}
                  >
                    The details
                  </h2>
                  <div className="ofacts">
                    {facts.map((f, i) => (
                      <div className="k" key={i}>
                        {f.icon}
                        <div>
                          <b>{f.title}</b>
                          <span>{f.body}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* booking card (sticky) */}
            <aside>
              <div className="bkcard">
                {scarce ? (
                  <div className="bkleft">Only {special.remaining} left</div>
                ) : null}
                {hasNow ? (
                  <div className="bkrate">
                    <Money
                      className="amt"
                      amount={special.price}
                      currency={special.currency}
                    />
                    <span className="per">{per}</span>
                  </div>
                ) : null}
                {(hasWas && special.savingsAmount) ||
                savePct != null ||
                saveAmt != null ? (
                  <div className="bksave">
                    {hasWas && special.savingsAmount ? (
                      <Money
                        className="was"
                        amount={special.wasPrice}
                        currency={special.currency}
                      />
                    ) : null}
                    {savePct != null ? (
                      <span className="save">Save {savePct}%</span>
                    ) : saveAmt != null ? (
                      <span className="save">
                        Save{" "}
                        <Money
                          amount={saveAmt}
                          currency={special.currency}
                          approx={false}
                        />
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <a
                  href={special.bookHref}
                  data-wielo-book
                  className="btn btn-coral btn-lg btn-block"
                  style={{ marginTop: 20 }}
                >
                  Book this offer
                </a>
                <div className="bkperk">
                  <Check />
                  Booked direct — best-rate guarantee.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* more offers */}
      {others.length > 0 ? (
        <section
          className="section sand"
          style={{ paddingTop: "clamp(56px,7vw,96px)" }}
        >
          <div className="wrap">
            <div className="sec-head" data-reveal>
              <span className="tag">Keep exploring</span>
              <h2 className="lg" style={{ marginTop: 16 }}>
                More offers
              </h2>
            </div>
            <div className="spx">
              {others.map((s, i) => {
                const cHasNow = s.price != null;
                const cHasWas = s.wasPrice != null;
                const cPer = s.priceMode === "flat" ? "package" : "/ night";
                const cSavePct =
                  s.savingsPct != null && s.savingsPct > 0
                    ? s.savingsPct
                    : null;
                const cSaveAmt =
                  cSavePct == null &&
                  s.savingsAmount != null &&
                  s.savingsAmount > 0
                    ? s.savingsAmount
                    : null;
                const img = s.imageUrl
                  ? (asset(s.imageUrl) ?? s.imageUrl)
                  : null;
                return (
                  <a
                    href={s.detailHref ?? `/specials/${s.slug ?? ""}`}
                    className="spcard"
                    key={s.id}
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 3) * 90}ms` } as CSSProperties
                    }
                  >
                    <div className="spi">
                      {s.badge ? (
                        <span className="sp-badge">{s.badge}</span>
                      ) : null}
                      {s.remaining != null && s.remaining <= 5 ? (
                        <span className="sp-left">Only {s.remaining} left</span>
                      ) : null}
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={siteImageUrl(img, { width: 800 })}
                          alt={s.title}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                    </div>
                    <div className="spb">
                      <h3>{s.title}</h3>
                      {s.description ? (
                        <p className="spd">{s.description}</p>
                      ) : null}
                      {cHasNow ? (
                        <div className="sp-px">
                          <Money
                            className="sp-now"
                            amount={s.price}
                            currency={s.currency}
                          />
                          <span className="sp-per">{cPer}</span>
                          {cHasWas && s.savingsAmount ? (
                            <Money
                              className="sp-was"
                              amount={s.wasPrice}
                              currency={s.currency}
                            />
                          ) : null}
                          {cSavePct != null ? (
                            <span className="sp-save">Save {cSavePct}%</span>
                          ) : cSaveAmt != null ? (
                            <span className="sp-save">
                              Save{" "}
                              <Money
                                amount={cSaveAmt}
                                currency={s.currency}
                                approx={false}
                              />
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <span className="alink">
                        View offer
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
