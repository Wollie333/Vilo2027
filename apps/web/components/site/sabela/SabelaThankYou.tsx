import "./sabelaThankYou.css";

import type { ConfirmationRow } from "../BookingConfirmationCard";

const CheckIcon = (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ClockIcon = (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

/**
 * Sabela Lodge thank-you / confirmation page — the founder's bespoke dark
 * editorial "Lodge" reference (docs/themes/sabela/pages/Thank You.html), serving
 * BOTH a booking confirmation (gold tick + summary + total + optional EFT banking
 * rows) and a simple form/goal thank-you (tick + eyebrow + heading + message +
 * CTAs). Twin of MarmaladeThankYou — same interface + structure, restyled into
 * Sabela's Ebony-and-gold language. The caller bakes any name/email into the
 * strings; this component adds no email logic of its own.
 */
export function SabelaThankYou({
  brandName,
  handLine,
  heading,
  message,
  confirmed = true,
  reference,
  roomName,
  roomImageUrl,
  summaryNote,
  rows,
  total,
  eft,
  heroImageUrl,
  primaryCta,
  secondaryCta,
  footnote,
}: {
  brandName: string;
  handLine: string;
  heading: string;
  message: string;
  confirmed?: boolean;
  reference?: string | null;
  roomName?: string | null;
  roomImageUrl?: string | null;
  summaryNote?: string | null;
  rows?: ConfirmationRow[] | null;
  total?: string | null;
  eft?: ConfirmationRow[] | null;
  heroImageUrl?: string | null;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string } | null;
  footnote?: string | null;
}) {
  const heroImg =
    heroImageUrl ||
    "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2000&q=80";

  const rowList = rows ?? [];
  const eftList = eft ?? [];
  const hasSummary = Boolean(
    roomName || rowList.length || total || eftList.length,
  );

  return (
    <div className="sbty">
      <section className="tyhero">
        <div
          className="bg"
          style={{ backgroundImage: `url('${heroImg}')` }}
          aria-hidden
        />

        <div className="tycard">
          <div className={confirmed ? "tychk" : "tychk pending"}>
            {confirmed ? CheckIcon : ClockIcon}
          </div>

          <span className="eyebrow center no-rule ty-eye">{handLine}</span>
          <h1>{heading}</h1>
          <p className="muted ty-msg">{message}</p>

          {reference ? (
            <div className="tyref">
              <span>Reference</span>
              <b>{reference}</b>
            </div>
          ) : null}

          {hasSummary ? (
            <div className="tysum">
              {roomName ? (
                <div className="tysum-top">
                  {roomImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={roomImageUrl} alt={roomName} />
                  ) : null}
                  <div>
                    <span className="tysum-eye">{brandName}</span>
                    <h3>{roomName}</h3>
                    {summaryNote ? (
                      <div className="tysum-note">{summaryNote}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {rowList.map((r) => (
                <div className="tyrow" key={r.label}>
                  <span>{r.label}</span>
                  <b>{r.value}</b>
                </div>
              ))}

              {total ? (
                <div className="tyrow tytotal">
                  <span>Total paid</span>
                  <b>{total}</b>
                </div>
              ) : null}

              {eftList.length ? (
                <div className="tybank">
                  <div className="tybank-head">Banking details</div>
                  {eftList.map((r) => (
                    <div className="tyrow" key={r.label}>
                      <span>{r.label}</span>
                      <b>{r.value}</b>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="tyacts">
            <a href={primaryCta.href} className="btn btn-accent btn-lg">
              {primaryCta.label}
            </a>
            {secondaryCta ? (
              <a href={secondaryCta.href} className="btn btn-ghost btn-lg">
                {secondaryCta.label}
              </a>
            ) : null}
          </div>

          {footnote ? <p className="muted tyfoot">{footnote}</p> : null}
        </div>
      </section>
    </div>
  );
}
