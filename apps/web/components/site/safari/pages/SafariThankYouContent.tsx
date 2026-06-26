/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element -- verbatim NenGama design port: copy uses literal apostrophes/quotes and external Unsplash imagery. */

export interface SafariThankYouEft {
  account_holder: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_type: string;
}

export interface SafariThankYouProps {
  /** Outcome — drives the heading, icon and which extras show. "form" is the
   *  post-form-submission thank-you (same design, no booking summary). */
  state: "confirmed" | "eft" | "processing" | "form";
  firstName?: string | null;
  reference?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
  nights?: number | null;
  /** Pre-formatted total (currency applied by the caller). */
  total?: string | null;
  /** Banking details for the awaiting-transfer (EFT) state. */
  eft?: SafariThankYouEft | null;
  /** The host's form success message (form state only). */
  message?: string | null;
  /** Form state: eyebrow + heading override (type-aware copy from the route). */
  eyebrow?: string | null;
  headingText?: string | null;
  /** Preview-aware nav targets. */
  homeHref?: string;
  contactHref?: string;
  roomsHref?: string;
}

const STOCK_HERO =
  "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2200&q=80";

const COPY = {
  confirmed: {
    eyebrow: "Reservation confirmed",
    heading: (n: string) => (
      <>
        You're booked, <span>{n || "traveller"}</span>
      </>
    ),
    lead: "A confirmation is on its way to your inbox. We can't wait to welcome you.",
  },
  eft: {
    eyebrow: "Awaiting your transfer",
    heading: () => <>Almost there</>,
    lead: "Your booking is reserved. Make the transfer below using your reference and the host will confirm once it reflects.",
  },
  processing: {
    eyebrow: "Confirming payment",
    heading: () => <>We're confirming your payment</>,
    lead: "This can take a moment. We'll email your confirmation as soon as it's settled.",
  },
  form: {
    eyebrow: "Message received",
    heading: (n: string) =>
      n ? (
        <>
          Thank you, <span>{n}</span>
        </>
      ) : (
        <>Thank you</>
      ),
    lead: "We've got your message and a real person at the lodge will reply soon.",
  },
} as const;

export function SafariThankYouContent({
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
  contactHref = "/contact",
  roomsHref,
}: SafariThankYouProps) {
  const copy = COPY[state];
  const isBooking = state !== "form";
  const lead = state === "form" ? message?.trim() || copy.lead : copy.lead;
  const eyebrowText =
    state === "form" && eyebrow?.trim() ? eyebrow.trim() : copy.eyebrow;

  return (
    <>
      <section className="ty-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bgimg" src={STOCK_HERO} alt="" />
        <div className="ty-card">
          <div className="ty-check">
            {state === "confirmed" || state === "form" ? (
              <svg
                width="36"
                height="36"
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
                width="36"
                height="36"
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
            style={{ marginTop: "20px", display: "inline-flex" }}
          >
            {eyebrowText}
          </span>
          <h1
            className="display"
            style={{ fontSize: "clamp(2.2rem,5vw,3.4rem)", marginTop: "14px" }}
          >
            {state === "form" && headingText?.trim()
              ? headingText.trim()
              : copy.heading(firstName?.trim() || "")}
          </h1>
          <p
            className="muted"
            style={{
              marginTop: "14px",
              maxWidth: "46ch",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {lead}
          </p>
          {reference ? (
            <div className="ty-ref">
              Booking reference <b>{reference}</b>
            </div>
          ) : null}

          {/* SUMMARY — real booking dates / guests / total (booking only) */}
          {isBooking ? (
            <div className="ty-summary">
              <div className="ty-row">
                <span>Check in</span>
                <b>{checkIn || "—"}</b>
              </div>
              <div className="ty-row">
                <span>Check out</span>
                <b>{checkOut || "—"}</b>
              </div>
              <div className="ty-row">
                <span>Guests · nights</span>
                <b>
                  {guests ?? "—"} {guests === 1 ? "guest" : "guests"}
                  {nights != null ? (
                    <>
                      {" · "}
                      {nights} {nights === 1 ? "night" : "nights"}
                    </>
                  ) : null}
                </b>
              </div>
              {total ? (
                <div className="ty-total">
                  <span
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: "12px",
                      letterSpacing: ".16em",
                      textTransform: "uppercase",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {state === "confirmed" ? "Total paid" : "Total due"}
                  </span>
                  <span className="amt">{total}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* EFT banking details (awaiting-transfer state) */}
          {state === "eft" && eft ? (
            <div className="ty-summary" style={{ marginTop: "16px" }}>
              <div className="ty-row">
                <span>Account holder</span>
                <b>{eft.account_holder}</b>
              </div>
              <div className="ty-row">
                <span>Bank</span>
                <b>{eft.bank_name}</b>
              </div>
              <div className="ty-row">
                <span>Account number</span>
                <b>{eft.account_number}</b>
              </div>
              <div className="ty-row">
                <span>Branch code</span>
                <b>{eft.branch_code}</b>
              </div>
              <div className="ty-row">
                <span>Account type</span>
                <b>{eft.account_type}</b>
              </div>
              {reference ? (
                <div className="ty-row">
                  <span>Use as reference</span>
                  <b>{reference}</b>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* NEXT STEPS — confirmed state only */}
          {state === "confirmed" ? (
            <div className="ty-next">
              <div className="n">
                <div className="ic">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-10 6L2 7" />
                  </svg>
                </div>
                <h4>Check your email</h4>
                <p>Your itinerary and what to pack are on the way.</p>
              </div>
              <div className="n">
                <div className="ic">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 4.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                  </svg>
                </div>
                <h4>We'll arrange transfers</h4>
                <p>Send your flights and we'll meet you at the airstrip.</p>
              </div>
              <div className="n">
                <div className="ic">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                  </svg>
                </div>
                <h4>Then, simply arrive</h4>
                <p>The bush, the fire and your ranger will be ready.</p>
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: "14px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: "32px",
            }}
          >
            <a href={homeHref} className="btn btn-primary btn-lg">
              <span>Back to home</span>
            </a>
            {isBooking ? (
              <a href={contactHref} className="btn btn-ghost btn-lg">
                <span>Send our team your flights</span>
              </a>
            ) : roomsHref ? (
              <a href={roomsHref} className="btn btn-ghost btn-lg">
                <span>Browse the suites</span>
              </a>
            ) : null}
          </div>
          {isBooking ? (
            <p
              className="muted"
              style={{ fontSize: "12.5px", marginTop: "22px" }}
            >
              Free cancellation up to 14 days before arrival · no booking fees
              were charged.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
