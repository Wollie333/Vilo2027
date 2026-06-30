/* eslint-disable react/no-unescaped-entities -- copy uses literal apostrophes. */
import type { CSSProperties } from "react";

export interface SabelaThankYouEft {
  account_holder: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_type: string;
}

export interface SabelaThankYouProps {
  state: "confirmed" | "eft" | "processing" | "form";
  firstName?: string | null;
  reference?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
  nights?: number | null;
  total?: string | null;
  eft?: SabelaThankYouEft | null;
  message?: string | null;
  eyebrow?: string | null;
  headingText?: string | null;
  homeHref?: string;
  contactHref?: string;
  roomsHref?: string;
}

const COPY = {
  confirmed: {
    eyebrow: "Reservation confirmed",
    heading: (n: string) => `You're booked, ${n || "traveller"}`,
    lead: "A confirmation is on its way to your inbox. We can't wait to welcome you to the bush.",
  },
  eft: {
    eyebrow: "Awaiting your transfer",
    heading: () => "Almost there",
    lead: "Your booking is reserved. Make the transfer below using your reference and the host will confirm once it reflects.",
  },
  processing: {
    eyebrow: "Confirming payment",
    heading: () => "We're confirming your payment",
    lead: "This can take a moment. We'll email your confirmation as soon as it's settled.",
  },
  form: {
    eyebrow: "Message received",
    heading: (n: string) => (n ? `Thank you, ${n}` : "Thank you"),
    lead: "We've got your message and a real person at the lodge will reply soon.",
  },
} as const;

const ROW: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  padding: "12px 0",
  borderTop: "1px solid var(--site-line)",
  fontSize: 14.5,
};

export function SabelaThankYouContent({
  state,
  firstName,
  reference,
  checkIn,
  checkOut,
  guests,
  nights,
  total,
  eft,
  message,
  eyebrow,
  headingText,
  homeHref = "/",
  roomsHref,
}: SabelaThankYouProps) {
  const copy = COPY[state];
  const isBooking = state !== "form";
  const lead = state === "form" ? message?.trim() || copy.lead : copy.lead;
  const eyebrowText =
    state === "form" && eyebrow?.trim() ? eyebrow.trim() : copy.eyebrow;
  const heading =
    state === "form" && headingText?.trim()
      ? headingText.trim()
      : copy.heading(firstName?.trim() || "");

  return (
    <section className="section" data-section="thank_you">
      <div className="wrap wrap-narrow">
        <div
          style={{
            background: "var(--site-surface)",
            border: "1px solid var(--site-line)",
            borderRadius: "var(--site-radius-lg, 14px)",
            padding: "clamp(32px,5vw,56px)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto",
              borderRadius: "9999px",
              background: "var(--site-tint, rgba(201,162,74,.15))",
              color: "var(--site-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {state === "confirmed" || state === "form" ? (
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            )}
          </div>
          <span
            className="eyebrow center no-rule"
            style={{ marginTop: 20, display: "inline-flex" }}
          >
            {eyebrowText}
          </span>
          <h1 style={{ marginTop: 12, fontSize: "clamp(2.2rem,5vw,3.4rem)" }}>
            {heading}
          </h1>
          <p
            className="muted"
            style={{
              marginTop: 14,
              maxWidth: "46ch",
              marginInline: "auto",
            }}
          >
            {lead}
          </p>
          {reference ? (
            <div
              style={{
                marginTop: 22,
                display: "inline-block",
                border: "1px solid var(--site-line)",
                borderRadius: "var(--site-radius-sm, 4px)",
                padding: "10px 18px",
                fontSize: 14,
                color: "var(--site-mute)",
              }}
            >
              Booking reference{" "}
              <b style={{ color: "var(--site-ink)" }}>{reference}</b>
            </div>
          ) : null}

          {isBooking ? (
            <div
              style={{
                marginTop: 28,
                textAlign: "left",
                maxWidth: 460,
                marginInline: "auto",
              }}
            >
              <div style={ROW}>
                <span className="muted">Check in</span>
                <b>{checkIn || "—"}</b>
              </div>
              <div style={ROW}>
                <span className="muted">Check out</span>
                <b>{checkOut || "—"}</b>
              </div>
              <div style={ROW}>
                <span className="muted">Guests · nights</span>
                <b>
                  {guests ?? "—"} {guests === 1 ? "guest" : "guests"}
                  {nights != null
                    ? ` · ${nights} ${nights === 1 ? "night" : "nights"}`
                    : ""}
                </b>
              </div>
              {total ? (
                <div
                  style={{
                    ...ROW,
                    borderTop: "1px solid var(--site-line)",
                    paddingTop: 16,
                    marginTop: 4,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      letterSpacing: ".16em",
                      textTransform: "uppercase",
                      color: "var(--site-mute)",
                    }}
                  >
                    {state === "confirmed" ? "Total paid" : "Total due"}
                  </span>
                  <span className="price" style={{ fontSize: "1.5rem" }}>
                    {total}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {state === "eft" && eft ? (
            <div
              style={{
                marginTop: 16,
                textAlign: "left",
                maxWidth: 460,
                marginInline: "auto",
              }}
            >
              <div style={ROW}>
                <span className="muted">Account holder</span>
                <b>{eft.account_holder}</b>
              </div>
              <div style={ROW}>
                <span className="muted">Bank</span>
                <b>{eft.bank_name}</b>
              </div>
              <div style={ROW}>
                <span className="muted">Account number</span>
                <b>{eft.account_number}</b>
              </div>
              <div style={ROW}>
                <span className="muted">Branch code</span>
                <b>{eft.branch_code}</b>
              </div>
              <div style={ROW}>
                <span className="muted">Account type</span>
                <b>{eft.account_type}</b>
              </div>
              {reference ? (
                <div style={ROW}>
                  <span className="muted">Use as reference</span>
                  <b>{reference}</b>
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 32,
            }}
          >
            <a href={homeHref} className="btn btn-primary btn-lg">
              <span>Back to home</span>
            </a>
            {roomsHref ? (
              <a href={roomsHref} className="btn btn-ghost btn-lg">
                <span>Browse the suites</span>
              </a>
            ) : null}
          </div>
          {isBooking ? (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 22 }}>
              Free cancellation up to 14 days before arrival · no booking fees
              were charged.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
