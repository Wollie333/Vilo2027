import "./safariSpecial.css";

import type { CSSProperties } from "react";

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
function pad2(n: number): string {
  return String(n + 1).padStart(2, "0");
}

const Check = () => (
  <svg
    width="18"
    height="18"
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

const Arrow = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
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
 * Safari (NenGama Lodge) SPECIAL/offer-detail page (preset `safari`) — its own
 * component + stylesheet (`.sfspecial` / safariSpecial.css): the warm, airy,
 * editorial lodge treatment (breadcrumb → editorial hero with badge overlay →
 * oversized serif title, prose, a hairline-ruled offer-facts roster, a sticky
 * booking card, and a "more offers" collection strip) — distinct from the
 * OceansView offer-detail. Omit-rather-than-fabricate: only facts that exist
 * render. Server-rendered; renders INSIDE the themed chrome. Phase C.
 */
export function SafariSpecialDetail({
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
    <div className="sfspecial">
      {/* breadcrumbs */}
      <section className="wrap">
        <nav className="sf-crumbs" aria-label="Breadcrumb">
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
          <div className="sf-hero">
            {special.badge ? (
              <span className="sf-hero-badge">{special.badge}</span>
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
      <section className="sf-sec sf-sec-top">
        <div className="wrap">
          <div className="sf-layout">
            <div className="sf-main">
              <span className="sf-eyebrow">Special offer</span>
              <h1>{special.title}</h1>
              {special.propertyName ? (
                <p className="sf-place">{special.propertyName}</p>
              ) : null}

              {lead ? <p className="sf-lead">{lead}</p> : null}
              {bodyParas.length > 0 ? (
                <div className="sf-body">
                  {bodyParas.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              ) : null}

              {facts.length > 0 ? (
                <div className="sf-block" data-reveal>
                  <h2 className="sf-h3">The details</h2>
                  <div className="sf-facts">
                    {facts.map((f, i) => (
                      <div className="sf-k" key={i}>
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
            <aside className="sf-aside">
              <div className="sf-bkcard">
                {scarce ? (
                  <div className="sf-bkleft">Only {special.remaining} left</div>
                ) : null}
                {now ? (
                  <div className="sf-bkrate">
                    <span className="amt">{now}</span>
                    <span className="per">{per}</span>
                  </div>
                ) : null}
                {(was && special.savingsAmount) || save ? (
                  <div className="sf-bksave">
                    {was && special.savingsAmount ? (
                      <span className="was">{was}</span>
                    ) : null}
                    {save ? <span className="save">{save}</span> : null}
                  </div>
                ) : null}
                <a
                  href={special.bookHref}
                  data-wielo-book
                  className="sf-btn sf-btn-solid sf-btn-lg sf-btn-block"
                >
                  Book this offer
                </a>
                <div className="sf-bkperk">
                  <Check />
                  Booked direct — 0% booking fees, best-rate guarantee.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* more offers */}
      {others.length > 0 ? (
        <section className="sf-sec sf-sand">
          <div className="wrap">
            <div className="sf-sechead" data-reveal>
              <span className="sf-eyebrow">Keep exploring</span>
              <h2 className="sf-h2">More offers</h2>
            </div>
            <div className="sf-grid">
              {others.map((s, i) => {
                const cNow = money(s.price, s.currency);
                const cWas = money(s.wasPrice, s.currency);
                const cPer = s.priceMode === "flat" ? "package" : "/ night";
                const cSave =
                  s.savingsPct != null && s.savingsPct > 0
                    ? `Save ${s.savingsPct}%`
                    : s.savingsAmount != null && s.savingsAmount > 0
                      ? `Save ${money(s.savingsAmount, s.currency)}`
                      : null;
                const cScarce = s.remaining != null && s.remaining <= 5;
                const img = s.imageUrl
                  ? (asset(s.imageUrl) ?? s.imageUrl)
                  : null;
                return (
                  <a
                    href={s.detailHref ?? `/specials/${s.slug ?? ""}`}
                    className="sf-card"
                    key={s.id}
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 2) * 90}ms` } as CSSProperties
                    }
                  >
                    <span className="sf-card-fig">
                      <span className="sf-card-idx" aria-hidden>
                        {pad2(i)}
                      </span>
                      <span className="sf-card-tags">
                        {s.badge ? (
                          <span className="sf-card-badge">{s.badge}</span>
                        ) : null}
                        {cScarce ? (
                          <span className="sf-card-left">
                            Only {s.remaining} left
                          </span>
                        ) : null}
                      </span>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={siteImageUrl(img, { width: 1000 })}
                          alt={s.title}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                      {cNow ? (
                        <span className="sf-card-price">
                          {cNow}
                          <em>{cPer}</em>
                        </span>
                      ) : null}
                    </span>
                    <span className="sf-card-body">
                      <h3>{s.title}</h3>
                      {s.description ? <p>{s.description}</p> : null}
                      {(cWas && s.savingsAmount) || cSave ? (
                        <span className="sf-card-save">
                          {cWas && s.savingsAmount ? (
                            <span className="sf-was">{cWas}</span>
                          ) : null}
                          {cSave ? (
                            <span className="sf-save">{cSave}</span>
                          ) : null}
                        </span>
                      ) : null}
                      <span className="sf-card-cta">
                        <span className="sf-alink">View offer {Arrow}</span>
                      </span>
                    </span>
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
