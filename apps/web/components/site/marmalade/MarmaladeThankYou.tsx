import "./marmaladeThankYou.css";

import { siteImageUrl } from "@/lib/site/image";

import type { ConfirmationRow } from "../BookingConfirmationCard";

const CheckIcon = (
  <svg
    width="32"
    height="32"
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

const ClockIcon = (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

/**
 * Marmalade House thank-you / confirmation page — the founder's bespoke
 * "Postcards" reference design, serving BOTH a booking confirmation (check +
 * summary + total + optional EFT banking rows) and a simple form/goal
 * thank-you (check + hand + heading + message + CTAs). The caller bakes any
 * name/email into the strings; this component adds no email logic of its own.
 */
export function MarmaladeThankYou({
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
  const brandInitial = (brandName.trim()[0] || "M").toUpperCase();
  const heroImg =
    heroImageUrl ||
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=2000&q=80";

  const rowList = rows ?? [];
  const eftList = eft ?? [];
  const hasSummary = Boolean(
    roomName || rowList.length || total || eftList.length,
  );

  return (
    <div className="mmty">
      <section className="tyhero">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={siteImageUrl(heroImg, { width: 2000 })} alt={brandName} />
        </div>

        <div className="tycard">
          <span className="stamp">{brandInitial}</span>

          <div className={confirmed ? "tychk" : "tychk pending"}>
            {confirmed ? CheckIcon : ClockIcon}
          </div>

          <span className="hand lg ty-hand">{handLine}</span>
          <h1>{heading}</h1>
          <p className="muted ty-msg">{message}</p>

          {reference ? (
            <div className="tyref">
              Reference <b>{reference}</b>
            </div>
          ) : null}

          {hasSummary ? (
            <div className="tysum">
              {roomName ? (
                <div className="tysum-top">
                  {roomImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteImageUrl(roomImageUrl, { width: 800 })}
                      alt={roomName}
                      loading="lazy"
                      decoding="async"
                    />
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
                <div className="tyrow">
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
            <a href={primaryCta.href} className="btn btn-accent">
              {primaryCta.label}
            </a>
            {secondaryCta ? (
              <a href={secondaryCta.href} className="btn btn-ghost">
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
