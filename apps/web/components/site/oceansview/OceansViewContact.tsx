import "./oceansContact.css";

import type { ReactNode } from "react";

import type { ReviewCard, RoomPolicies } from "@/lib/site/types";

import { OceansContactForm } from "./OceansContactForm";

type Faq = { q: string; a: string };

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "•";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// The standard fallback (per the `contact.faq` slot binding, `derive:
// d.policiesFaq`): when the host hasn't written a wizard FAQ, pull the property's
// REAL "things to know" — check-in/out, cancellation, house rules, child/pet
// policy — into Q&A. Never fabricates generic prose; only renders the lines the
// property actually sets. Empty in → empty out (the section then omits itself).
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

// One contact-detail row. Rendered only when it has a value.
function Row({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail?: string | null;
}) {
  return (
    <div className="drow">
      <span className="ic">{icon}</span>
      <div>
        <div className="t">{title}</div>
        {detail ? <div className="d">{detail}</div> : null}
      </div>
    </div>
  );
}

/**
 * Oceans View CONTACT page — the founder's bespoke reference design. The message
 * form (left) is a real lead-capture form posting to the host inbox; the details
 * card (right) is wired to LIVE establishment data (phone/email/address, with the
 * map embed when we can build one). The FAQ follows the standard content flow:
 * the host's wizard `content_profile.contact.faq`, falling back to the property's
 * real policies (never fabricated prose); it omits entirely when there's nothing
 * real to show. Renders inside the themed chrome. Scoped under `.ovcontact`.
 */
export function OceansViewContact({
  brandName,
  websiteId,
  interactive = false,
  heroImageUrl,
  subheadline,
  phone,
  email,
  address,
  localityLabel,
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
  subheadline?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  localityLabel?: string | null;
  mapEmbedUrl?: string | null;
  faq?: Faq[] | null;
  policies?: RoomPolicies | null;
  rooms?: string[] | null;
  review?: ReviewCard | null;
}) {
  const headImg =
    heroImageUrl ||
    "https://images.unsplash.com/photo-1455587734955-081b22074882?w=2200&q=80";
  const sub =
    subheadline?.trim() ||
    "Booking, transfers, a special request — a real person replies within a day.";

  // Wizard FAQ first (host-authored), else the property's real policies. No
  // hardcoded generic copy — an empty list omits the whole FAQ section below.
  const authored = (faq ?? []).filter((f) => f.q && f.a);
  const faqList = authored.length ? authored : policiesToFaq(policies);
  const hasDetails = Boolean(phone || email || address);

  return (
    <div className="ovcontact">
      {/* PAGE HEAD */}
      <section className="phead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={headImg} alt={brandName} />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Contact</span>
          </div>
          <h1>Say hello</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* CONTACT */}
      <section className="section">
        <div className="wrap">
          <div className="cgrid">
            <div>
              <span className="tag">Send a message</span>
              <h2 className="lg" style={{ marginTop: 16 }}>
                Tell us about your trip
              </h2>
              <OceansContactForm
                websiteId={websiteId}
                interactive={interactive}
                rooms={rooms ?? []}
              />
            </div>

            <div>
              {hasDetails ? (
                <div className="dcard">
                  {phone ? (
                    <Row
                      icon={
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
                        </svg>
                      }
                      title={phone}
                      detail="Reservations"
                    />
                  ) : null}
                  {email ? (
                    <Row
                      icon={
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m22 7-10 6L2 7" />
                        </svg>
                      }
                      title={email}
                      detail="We reply within a day"
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
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      }
                      title={address}
                      detail={localityLabel ?? null}
                    />
                  ) : null}
                </div>
              ) : null}

              {/* A real guest review — fills the column and adds social proof
                  next to the enquiry form. Omitted when the site has no reviews. */}
              {review?.body?.trim() ? (
                <figure className="qcard">
                  <div
                    className="qstars"
                    aria-label={`${review.rating} out of 5`}
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg
                        key={i}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill={
                          i < Math.round(review.rating)
                            ? "currentColor"
                            : "none"
                        }
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
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
            </div>
          </div>
        </div>
      </section>

      {/* MAP */}
      {mapEmbedUrl ? (
        <section className="section-sm" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="mapframe">
              <iframe
                src={mapEmbedUrl}
                title={`Map to ${brandName}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      ) : address ? (
        <section className="section-sm" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="mapph">
              <span className="mappin" />
              <div className="maptag">📍 {address}</div>
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ — only when the wizard or the property's policies provide real items */}
      {faqList.length ? (
        <section className="section sand">
          <div className="wrap-read">
            <div className="sec-head center" style={{ marginBottom: 36 }}>
              <span className="tag" style={{ justifyContent: "center" }}>
                Good to know
              </span>
              <h2
                className="lg"
                style={{
                  marginTop: 16,
                  fontSize: "clamp(1.9rem, 4vw, 2.8rem)",
                }}
              >
                Frequently asked
              </h2>
            </div>
            <div>
              {faqList.map((f, i) => (
                <details className="faq" key={i} open={i === 0}>
                  <summary>
                    {f.q}
                    <span className="pm">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
