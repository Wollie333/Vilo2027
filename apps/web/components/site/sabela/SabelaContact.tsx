import "./sabelaContact.css";

import type { CSSProperties, ReactNode } from "react";

import type { ReviewCard, RoomPolicies } from "@/lib/site/types";

import { SabelaContactForm } from "./SabelaContactForm";

type Faq = { q: string; a: string };

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "★";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// The standard fallback (mirrors OceansView / Marmalade): when the host hasn't
// written a wizard FAQ, pull the property's REAL "things to know" — check-in/out,
// cancellation, house rules, child/pet policy — into Q&A. Never fabricates
// generic prose; only renders the lines the property actually sets. Empty in →
// empty out (the section then omits itself).
function policiesToFaq(p?: RoomPolicies | null): Faq[] {
  if (!p) return [];
  const out: Faq[] = [];
  if (p.checkIn || p.checkOut) {
    const parts = [
      p.checkIn ? `Check-in is from ${p.checkIn}` : "",
      p.checkOut ? `check-out is by ${p.checkOut}` : "",
    ].filter(Boolean);
    out.push({
      q: "What are the check-in and check-out times?",
      a: `${parts.join(" and ")}.`,
    });
  }
  if (p.cancellation)
    out.push({ q: "What's your cancellation policy?", a: p.cancellation });
  if (p.houseRules)
    out.push({ q: "Are there any house rules?", a: p.houseRules });
  if (p.children != null || p.pets != null) {
    const bits = [
      p.children != null
        ? p.children
          ? "Children are welcome."
          : "This is an adults-only stay."
        : "",
      p.pets != null
        ? p.pets
          ? "Well-behaved pets are welcome."
          : "Sorry, we can't accommodate pets."
        : "",
    ].filter(Boolean);
    if (bits.length)
      out.push({ q: "Are children and pets welcome?", a: bits.join(" ") });
  }
  return out;
}

// Brand-agnostic, always-true direct-booking answers — used only to seed the FAQ
// when the host has written none and the property sets no policies, so the
// section never renders empty on a fresh site. Never claims property specifics.
const DIRECT_BOOKING_FAQ: Faq[] = [
  {
    q: "Why book direct instead of through a marketplace?",
    a: "Booking straight with us means the rate you see is the rate you pay — no agents in between.",
  },
  {
    q: "How soon will I hear back?",
    a: "A real person reads every enquiry and replies personally, usually within a day. Share your dates and what you're hoping for and we'll take it from there.",
  },
  {
    q: "Can you help with special requests?",
    a: "Absolutely — an early check-in, a special occasion, transfers or dietary needs. Tell us in your message and we'll do our best to arrange it.",
  },
];

// One business-detail row. Rendered only when it has a value. When `href` is set
// the value becomes a real link (tel: / mailto:) so guests can tap to call/email.
function Row({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string | null;
}) {
  return (
    <div className="contact-item">
      <span className="ci-ic">{icon}</span>
      <div>
        <div className="t">{label}</div>
        {href ? (
          <a className="d" href={href}>
            {value}
          </a>
        ) : (
          <div className="d">{value}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Sabela Lodge CONTACT page — the founder's bespoke dark-editorial "Lodge"
 * reference, built to the same completeness bar as the OceansView reference:
 * a page head, then a two-column body with the real enquiry / request-a-quote
 * FORM on the left (posting to the host inbox) and a business-DETAILS card on
 * the right — the address renders as a map-pin line, the phone as a real `tel:`
 * link and the email as a real `mailto:` link (each row conditional on its
 * value) — followed by a full-width MAP (the Google embed when present, else a
 * themed placeholder that still shows the address), and the FAQ. A real guest
 * review carries social proof beneath the details when the site has one. The FAQ
 * follows the standard content flow: the host's wizard FAQ, falling back to the
 * property's real policies, then to always-true direct-booking answers. Renders
 * inside the `.sbchrome` themed chrome (`hotel` preset). Scoped under
 * `.sbcontact`; all colour / type / shape from `--site-*` tokens (dark
 * fallbacks) so it stays on-brand and host-editable.
 */
export function SabelaContact({
  brandName,
  websiteId,
  interactive = true,
  heroImageUrl,
  phone,
  email,
  address,
  mapEmbedUrl,
  faq,
  policies,
  rooms,
  review,
}: {
  brandName: string;
  websiteId?: string;
  interactive?: boolean;
  heroImageUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  mapEmbedUrl?: string | null;
  faq?: Faq[] | null;
  policies?: RoomPolicies | null;
  rooms?: string[];
  review?: ReviewCard | null;
}) {
  // heroImageUrl is part of the shared contact prop contract; the sabela
  // reference uses a plain (no-photo) page head, so it isn't surfaced here.
  void heroImageUrl;

  // Wizard FAQ first (host-authored), else the property's real policies, else
  // the always-true direct-booking answers so the section is never empty.
  const authored = (faq ?? []).filter((f) => f.q && f.a);
  const policyFaq = policiesToFaq(policies);
  const faqList = authored.length
    ? authored
    : policyFaq.length
      ? policyFaq
      : DIRECT_BOOKING_FAQ;
  const hasDetails = Boolean(phone || email || address);
  const showReview = Boolean(review?.body?.trim());

  return (
    <div className="sbcontact">
      {/* PAGE HEAD (centred, interior-page convention) */}
      <section className="page-head" data-section="intro">
        <div className="wrap-narrow">
          <span className="eyebrow center">Reservations &amp; enquiries</span>
          <h1>Let&apos;s plan your stay</h1>
          <p className="lead mx-auto">
            Tell us your dates and what you&apos;re hoping for. A real person at{" "}
            {brandName} replies within a day — booked direct.
          </p>
        </div>
      </section>

      {/* FORM + DETAILS */}
      <section className="section-tight" data-section="form">
        <div className="wrap">
          <div className="contact-grid">
            {/* LEFT — the enquiry / request-a-quote form */}
            <div className="form-col">
              <div className="col-head">
                <span className="eyebrow">Request a quote</span>
                <h2>Tell us about your stay</h2>
              </div>
              <SabelaContactForm
                websiteId={websiteId}
                interactive={interactive}
                rooms={rooms ?? []}
              />
            </div>

            {/* RIGHT — business details (+ guest review) */}
            <aside className="contact-aside" data-section="location">
              {hasDetails ? (
                <div className="ci-card">
                  <h3 className="card-title">How to reach us</h3>
                  <p className="card-sub">
                    A real person replies within a day.
                  </p>
                  <div className="ci-list">
                    {email ? (
                      <Row
                        icon={
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
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="m22 7-10 6L2 7" />
                          </svg>
                        }
                        label="Reservations"
                        value={email}
                        href={`mailto:${email}`}
                      />
                    ) : null}
                    {phone ? (
                      <Row
                        icon={
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
                            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z" />
                          </svg>
                        }
                        label="Phone & WhatsApp"
                        value={phone}
                        href={`tel:${phone.replace(/\s+/g, "")}`}
                      />
                    ) : null}
                    {address ? (
                      <Row
                        icon={
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
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        }
                        label="Find us"
                        value={address}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* A real guest review carries the column (in place of a
                  reassurance note). Omitted when the site has no reviews. */}
              {showReview && review ? (
                <figure className="qcard">
                  <div
                    className="qstars"
                    aria-label={`${review.rating} out of 5`}
                  >
                    {"★".repeat(
                      Math.max(1, Math.min(5, Math.round(review.rating))),
                    )}
                  </div>
                  <blockquote>&ldquo;{review.body}&rdquo;</blockquote>
                  <figcaption>
                    <span className="qav">{initials(review.author)}</span>
                    <span>
                      <span className="qnm">{review.author}</span>
                      {review.date ? (
                        <span className="qdt">{review.date}</span>
                      ) : null}
                    </span>
                  </figcaption>
                </figure>
              ) : null}
            </aside>
          </div>
        </div>
      </section>

      {/* MAP — full-width band: the Google embed when present, else a themed
          placeholder that still names the address. Omitted with neither. */}
      {mapEmbedUrl ? (
        <section className="section-tight" data-section="map">
          <div className="wrap">
            <div className="map-frame">
              <iframe
                src={mapEmbedUrl}
                title={`Map of ${brandName}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      ) : address ? (
        <section className="section-tight" data-section="map">
          <div className="wrap">
            <div className="map-ph">
              <span className="map-pin" />
              <div className="map-tag">{address}</div>
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      {faqList.length ? (
        <section className="section soft-bg" data-section="faq">
          <div className="wrap-narrow">
            <div className="sec-head center faq-head" data-reveal>
              <span className="eyebrow center no-rule">Good to know</span>
              <h2>Frequently asked</h2>
            </div>
            <div className="faq">
              {faqList.map((f, i) => (
                <details
                  className="faq-item"
                  key={i}
                  open={i === 0}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 80}ms` } as CSSProperties}
                >
                  <summary>
                    {f.q}
                    <span className="faq-ic" />
                  </summary>
                  <div className="faq-a">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
