import "./marmaladeSpecialDetail.css";

import { siteImageUrl } from "@/lib/site/image";

import type { SiteSpecialDetail } from "@/lib/site/loadSitePage";
import type { SpecialCard } from "@/lib/site/types";

// ── formatting helpers (server-rendered — Intl-free, deterministic) ──────────
function commas(n: number): string {
  const s = String(Math.round(n));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return out;
}
function money(n?: number | null, currency?: string | null): string | null {
  if (n == null) return null;
  const ccy = currency ?? "ZAR";
  const sym = ccy === "ZAR" ? "R" : `${ccy} `;
  return `${sym}${commas(n)}`;
}

const Check = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
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
const Arrow = (
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
);

/**
 * Marmalade House SPECIAL/offer-detail page — a bespoke "Postcards" detail built
 * by adapting the marmalade room-detail + offers visual language to a single
 * offer: breadcrumb → framed postcard hero (taped badge) → title + prose + an
 * offer-facts grid, a sticky "book" postcard (price/was/save + "Book this offer"
 * CTA carrying the offer's checkout link), and a tilted "more offers" strip.
 * Omit-rather-than-fabricate: only facts that exist render. Server-rendered;
 * renders INSIDE the themed chrome (nav/footer from SiteChrome). Scoped `.mmsd`.
 */
export function MarmaladeSpecialDetail({
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

  // Price bits (reuse the offer card's now/was/save treatment).
  const now = money(special.price, special.currency);
  const was = money(special.wasPrice, special.currency);
  const per = special.priceMode === "flat" ? "package" : "/ night";
  const save =
    special.savingsPct != null && special.savingsPct > 0
      ? `Save ${special.savingsPct}%`
      : special.savingsAmount != null && special.savingsAmount > 0
        ? `Save ${money(special.savingsAmount, special.currency)}`
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
    <div className="mmsd">
      {/* breadcrumbs */}
      <section className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span className="sep">·</span>
          <a href={specialsHref}>Offers</a>
          <span className="sep">·</span>
          <span className="cur">{special.title}</span>
        </nav>
      </section>

      {/* hero — framed postcard photo with a taped badge */}
      {hero ? (
        <section className="wrap">
          <div className="frame-wrap">
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
          </div>
        </section>
      ) : null}

      {/* title + facts + booking */}
      <section
        className="section"
        style={{ paddingTop: "clamp(40px,5vw,60px)" }}
      >
        <div className="wrap">
          <div className="olayout">
            <div>
              <span className="hand">a little something</span>
              <h1>{special.title}</h1>
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
                        maxWidth: "58ch",
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
                  <h2>The details</h2>
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
                {now ? (
                  <div className="bkrate">
                    <span className="amt">{now}</span>
                    <span className="per">{per}</span>
                  </div>
                ) : null}
                {(was && special.savingsAmount) || save ? (
                  <div className="bksave">
                    {was && special.savingsAmount ? (
                      <span className="was">{was}</span>
                    ) : null}
                    {save ? <span className="save">{save}</span> : null}
                  </div>
                ) : null}
                <a
                  href={special.bookHref}
                  data-wielo-book
                  className="btn btn-accent btn-lg btn-block"
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
          className="section soft"
          style={{ paddingTop: "clamp(56px,7vw,96px)" }}
        >
          <div className="wrap">
            <div className="sec-head center" data-reveal>
              <span className="hand">while you&apos;re here</span>
              <h2>More offers</h2>
            </div>
            <div className="spx" data-reveal>
              {others.map((s) => {
                const cNow = money(s.price, s.currency);
                const cWas = money(s.wasPrice, s.currency);
                const cPer = s.priceMode === "flat" ? "package" : "/ night";
                const cSave =
                  s.savingsPct != null && s.savingsPct > 0
                    ? `Save ${s.savingsPct}%`
                    : s.savingsAmount != null && s.savingsAmount > 0
                      ? `Save ${money(s.savingsAmount, s.currency)}`
                      : null;
                const img = s.imageUrl
                  ? (asset(s.imageUrl) ?? s.imageUrl)
                  : null;
                return (
                  <a
                    href={s.detailHref ?? `/specials/${s.slug ?? ""}`}
                    className="spcard"
                    key={s.id}
                  >
                    <div className="sp-img">
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
                      {cNow ? (
                        <div className="sp-px">
                          <span className="sp-now">{cNow}</span>
                          <span className="sp-per">{cPer}</span>
                          {cWas && s.savingsAmount ? (
                            <span className="sp-was">{cWas}</span>
                          ) : null}
                          {cSave ? (
                            <span className="sp-save">{cSave}</span>
                          ) : null}
                        </div>
                      ) : null}
                      <span className="alink">View offer {Arrow}</span>
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
