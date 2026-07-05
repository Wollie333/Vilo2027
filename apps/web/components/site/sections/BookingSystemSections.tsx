import type { CSSProperties } from "react";

import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, Muted } from "./_shared";

// Builder V3 — system-page booking elements (checkout + thank-you).
//
// These render a THEME-SKINNED DEMO of the real booking form / confirmation so
// the host can see + style them on the builder canvas (via each block's
// `--el-<key>-*` element vars, with `--site-*` fallbacks so an unstyled block
// still matches the active theme). The LIVE /book + /book/thank-you routes render
// the real interactive `SiteCheckoutForm` / confirmation directly and apply the
// host's saved styling as an overlay — these demos never handle real bookings.
//
// Pure presentational server components (no state, no data): the "dynamic" fields
// are illustrative placeholders that mirror the real layout's anatomy.

type BookingFormProps = Extract<
  WebsiteSection,
  { type: "booking_form" }
>["props"];
type BookingConfirmationProps = Extract<
  WebsiteSection,
  { type: "booking_confirmation" }
>["props"];

// Shared frame for a styleable card (reads the `card` element vars).
const cardStyle: CSSProperties = {
  background: "var(--el-card-bg, var(--site-surface, #fff))",
  border: "var(--el-card-bd, 1px solid var(--site-line, #e5e7eb))",
  borderRadius: "var(--el-card-radius, var(--site-card-radius, 16px))",
  boxShadow: "var(--el-card-shadow, 0 8px 24px rgba(0,0,0,0.06))",
  padding: "var(--el-card-py, 28px) var(--el-card-px, 28px)",
  marginTop: "var(--el-card-mt, 0px)",
  marginBottom: "var(--el-card-mb, 0px)",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--site-font-heading)",
  color: "var(--el-title-fg, var(--site-ink, #111827))",
  fontSize: "var(--el-title-size, 1.6rem)",
  fontWeight: "var(--el-title-weight, 700)",
};

const fieldStyle: CSSProperties = {
  background: "var(--el-field-bg, var(--site-bg, #fff))",
  color: "var(--el-field-fg, var(--site-ink, #111827))",
  border: "var(--el-field-bd, 1px solid var(--site-line, #e5e7eb))",
  borderRadius: "var(--el-field-radius, var(--site-radius, 10px))",
};
const fieldCls = "flex flex-col gap-1.5 px-3.5 py-2.5 text-sm";

function FieldBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={fieldStyle} className={fieldCls}>
      <span
        style={{ color: "var(--site-mute, #6b7280)" }}
        className="text-[11px] font-medium uppercase tracking-wide"
      >
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/**
 * Checkout (/book) demo — the on-site booking form's anatomy: title, date/guest
 * fields, room + add-on cards, a price summary box and the pay button. Each part
 * reads its `--el-<key>-*` vars so the builder's Style tab restyles it live.
 */
export function BookingFormSection({ props }: { props: BookingFormProps }) {
  const heading = props.heading?.trim() || "Complete your booking";
  const body = props.body?.trim();
  return (
    <SectionShell width="narrow">
      <div style={cardStyle} data-el="booking-form">
        <h2 style={titleStyle}>{heading}</h2>
        {body ? <Muted className="mt-1.5 text-sm">{body}</Muted> : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <FieldBox label="Check in" value="Select date" />
          <FieldBox label="Check out" value="Select date" />
          <FieldBox label="Guests" value="2 guests" />
          <FieldBox label="Room" value="Any room" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {["Breakfast basket", "Airport transfer"].map((name) => (
            <div
              key={name}
              style={{
                background: "var(--el-addon-bg, var(--site-bg, #fafafa))",
                border:
                  "var(--el-addon-bd, 1px solid var(--site-line, #e5e7eb))",
                borderRadius: "var(--el-addon-radius, 12px)",
              }}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span className="font-medium">{name}</span>
              <span style={{ color: "var(--site-mute, #6b7280)" }}>+ R150</span>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "var(--el-summary-bg, var(--site-bg, #fafafa))",
            color: "var(--el-summary-fg, var(--site-ink, #111827))",
            border: "var(--el-summary-bd, 1px solid var(--site-line, #e5e7eb))",
            borderRadius: "var(--el-summary-radius, 14px)",
          }}
          className="mt-6 space-y-2 p-4 text-sm"
        >
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--site-mute, #6b7280)" }}>
              3 nights · Garden Room
            </span>
            <span>R3 600</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--site-mute, #6b7280)" }}>Add-ons</span>
            <span>R300</span>
          </div>
          <div
            style={{ borderColor: "var(--site-line, #e5e7eb)" }}
            className="flex items-center justify-between border-t pt-2.5"
          >
            <span className="font-semibold">Total</span>
            <span
              style={{
                color: "var(--el-price-fg, var(--site-ink, #111827))",
                fontSize: "var(--el-price-size, 1.25rem)",
                fontWeight: "var(--el-price-weight, 700)",
              }}
            >
              R3 900
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled
          style={{
            background: "var(--el-button-bg, var(--site-accent, #10b981))",
            color: "var(--el-button-fg, var(--site-accent-ink, #fff))",
            border: "var(--el-button-bd, none)",
            borderRadius: "var(--el-button-radius, var(--site-radius, 10px))",
            padding: "var(--el-button-py, 14px) var(--el-button-px, 20px)",
          }}
          className="mt-6 w-full text-center text-sm font-semibold"
        >
          Pay &amp; confirm booking
        </button>
      </div>
    </SectionShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--site-mute, #6b7280)" }}>{label}</span>
      <span
        style={{
          color: "var(--el-row-fg, var(--site-ink, #111827))",
          fontSize: "var(--el-row-size, 0.875rem)",
        }}
        className="text-right font-medium"
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Thank-you (/book/thank-you) demo — the post-payment confirmation's anatomy:
 * title + message, the booking detail rows, the total, and the EFT banking-details
 * box. Each part reads its `--el-<key>-*` vars for the builder's Style tab.
 */
export function BookingConfirmationSection({
  props,
}: {
  props: BookingConfirmationProps;
}) {
  const heading = props.heading?.trim() || "You're booked in 🎉";
  const body =
    props.body?.trim() || "A confirmation is on its way to your email.";
  return (
    <SectionShell width="narrow">
      <h2 style={{ ...titleStyle, textAlign: "center" }}>{heading}</h2>
      <Muted className="mb-6 mt-2 text-center text-base">{body}</Muted>

      <div style={cardStyle} data-el="booking-confirmation">
        <div className="space-y-2.5 text-sm">
          <Row label="Reference" value="WLO-4827" />
          <Row label="Dates" value="12 Aug → 15 Aug" />
          <Row label="Guests" value="2" />
          <div
            style={{ borderColor: "var(--site-line, #e5e7eb)" }}
            className="mt-2 flex items-center justify-between border-t pt-3"
          >
            <span
              style={{ color: "var(--el-total-fg, var(--site-ink, #111827))" }}
              className="font-semibold"
            >
              Total
            </span>
            <span
              style={{
                color: "var(--el-total-fg, var(--site-ink, #111827))",
                fontSize: "var(--el-total-size, 1.125rem)",
                fontWeight: "var(--el-total-weight, 700)",
              }}
            >
              R3 900
            </span>
          </div>
        </div>

        <div
          style={{
            background: "var(--el-bank-bg, var(--site-bg, #fafafa))",
            color: "var(--el-bank-fg, var(--site-ink, #111827))",
            border: "var(--el-bank-bd, 1px solid var(--site-line, #e5e7eb))",
            borderRadius: "var(--el-bank-radius, 12px)",
          }}
          className="mt-5 space-y-2 p-4 text-sm"
        >
          <h3 className="mb-1 text-sm font-semibold">Banking details</h3>
          <Row label="Account holder" value="Your Guesthouse" />
          <Row label="Bank" value="Standard Bank" />
          <Row label="Use reference" value="WLO-4827" />
        </div>
      </div>
    </SectionShell>
  );
}
