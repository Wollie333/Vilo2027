import "./oceansContact.css";

import type { ReactNode } from "react";

import { OceansContactForm } from "./OceansContactForm";

type Faq = { q: string; a: string };

// Always-true, brand-agnostic direct-booking answers — used only when the host
// hasn't written their own FAQ. Never fabricates a property-specific claim
// (check-in times, parking, inclusions), which we can't know.
const GENERIC_FAQ: Faq[] = [
  {
    q: "How do I book?",
    a: "Book directly here on this site — choose your dates and room and you'll pay exactly the rate shown. No agent, no marketplace, no booking fee.",
  },
  {
    q: "Is it cheaper to book direct?",
    a: "Yes. Booking straight with us means the price you see is the price you pay — there's never a commission added on top the way there is on the big travel sites.",
  },
  {
    q: "How soon will I hear back?",
    a: "A real person replies to every message, usually within a day. If your dates are tight, mention it and we'll prioritise getting back to you.",
  },
];

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
 * map embed when we can build one). The FAQ comes from the host's content_profile
 * (with brand-agnostic direct-booking answers as a fallback). Renders inside the
 * themed chrome. Scoped under `.ovcontact`.
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
  rooms,
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
  rooms?: string[] | null;
}) {
  const headImg =
    heroImageUrl ||
    "https://images.unsplash.com/photo-1455587734955-081b22074882?w=2200&q=80";
  const sub =
    subheadline?.trim() ||
    "Booking, transfers, a special request — a real person replies within a day.";

  const items = (faq ?? []).filter((f) => f.q && f.a);
  const faqList = items.length ? items : GENERIC_FAQ;
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
                    title={phone ?? ""}
                    detail={phone ? "Reservations" : null}
                  />
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
              <div className="reassure">
                <span className="ic">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <p>
                  Book direct and you pay exactly what we quote — no agents, no
                  booking fees, no surprises at checkout.
                </p>
              </div>
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

      {/* FAQ */}
      <section className="section sand">
        <div className="wrap-read">
          <div className="sec-head center" style={{ marginBottom: 36 }}>
            <span className="tag" style={{ justifyContent: "center" }}>
              Good to know
            </span>
            <h2 className="lg" style={{ marginTop: 16 }}>
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
    </div>
  );
}
