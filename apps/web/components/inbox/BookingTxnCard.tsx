import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Home,
  PartyPopper,
  Receipt,
  RotateCcw,
  Users,
  Wallet,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

import type { ThreadBooking } from "./ThreadQuoteCard";

// One rich, self-contained booking transaction card, rendered inline in the
// guest↔host thread for every money event on a booking:
//   paid      → payment received & confirmed  (receipt + invoice to download)
//   pending   → EFT awaiting the transfer      (invoice to download, Pay CTA)
//   refunded  → a refund was issued            (credit note to download)
// Both viewers see the same facts; only the note + CTA differ. Shares the layout
// so all booking cards look and behave consistently.

export type BookingTxnVariant = "paid" | "pending" | "refunded";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(
    `${iso.length <= 10 ? `${iso}T00:00:00Z` : iso}`,
  ).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function nights(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

const METHOD_LABEL: Record<string, string> = {
  paystack: "Card",
  paypal: "PayPal",
  eft: "EFT bank transfer",
  manual: "Recorded by host",
  cash: "Cash",
};

const TONE: Record<
  BookingTxnVariant,
  { card: string; head: string; icon: string; badge: string; amount: string }
> = {
  paid: {
    card: "border-status-confirmed/30",
    head: "border-status-confirmed/20 bg-status-confirmed/10",
    icon: "text-status-confirmed",
    badge: "bg-status-confirmed/15 text-status-confirmed",
    amount: "text-status-confirmed",
  },
  pending: {
    card: "border-amber-300",
    head: "border-amber-200 bg-amber-50",
    icon: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    amount: "text-amber-700",
  },
  refunded: {
    card: "border-brand-line",
    head: "border-brand-line bg-brand-light/60",
    icon: "text-brand-secondary",
    badge: "bg-brand-accent text-brand-secondary",
    amount: "text-brand-secondary",
  },
};

type DocLink = {
  href: string;
  label: string;
  number: string | null;
  Icon: typeof Receipt;
};

export function BookingTxnCard({
  booking,
  viewer,
  variant = "paid",
}: {
  booking: ThreadBooking;
  viewer: "host" | "guest";
  variant?: BookingTxnVariant;
}) {
  const tone = TONE[variant];
  const n = nights(booking.checkIn, booking.checkOut);
  const balanceDue = booking.balanceDue ?? 0;
  const paid = Math.max(0, booking.total - balanceDue);
  const fullyPaid = balanceDue <= 0.5;
  const methodLabel = booking.paymentMethod
    ? (METHOD_LABEL[booking.paymentMethod] ?? booking.paymentMethod)
    : null;

  const receiptDoc: DocLink | null = booking.receiptToken
    ? {
        href: `/receipt/${booking.receiptToken}/pdf`,
        label: "Receipt",
        number: booking.receiptNumber,
        Icon: Receipt,
      }
    : null;
  const invoiceDoc: DocLink | null = booking.invoiceToken
    ? {
        href: `/invoice/${booking.invoiceToken}/pdf`,
        label: "Invoice",
        number: booking.invoiceNumber,
        Icon: FileText,
      }
    : null;
  const creditNoteDoc: DocLink | null = booking.creditNoteToken
    ? {
        href: `/credit-note/${booking.creditNoteToken}/pdf`,
        label: "Credit note",
        number: booking.creditNoteNumber,
        Icon: FileText,
      }
    : null;

  // Per-variant content.
  const StatusIcon =
    variant === "paid"
      ? CheckCircle2
      : variant === "pending"
        ? Clock
        : RotateCcw;
  const NoteIcon =
    variant === "paid"
      ? PartyPopper
      : variant === "pending"
        ? Clock
        : RotateCcw;
  const badgeLabel =
    variant === "paid"
      ? fullyPaid
        ? "Paid"
        : "Confirmed"
      : variant === "pending"
        ? "Awaiting payment"
        : "Refunded";
  const note =
    variant === "paid"
      ? viewer === "guest"
        ? "Thank you — your payment is confirmed and your stay is booked. We can’t wait to host you!"
        : "Payment received — this booking is now confirmed."
      : variant === "pending"
        ? viewer === "guest"
          ? "We’re awaiting your EFT — your booking is held until the transfer reflects."
          : "The guest chose EFT — awaiting the transfer. It’ll confirm here once it reflects."
        : viewer === "guest"
          ? "A refund has been issued to you for this booking."
          : "A refund was issued to the guest for this booking.";
  const amountLabel =
    variant === "paid"
      ? fullyPaid
        ? "Amount paid"
        : "Paid so far"
      : variant === "pending"
        ? "Amount due"
        : "Refunded";
  const amountValue =
    variant === "paid"
      ? paid
      : variant === "pending"
        ? balanceDue > 0
          ? balanceDue
          : booking.total
        : (booking.refundedTotal ?? 0);
  const docs = (
    variant === "paid"
      ? [receiptDoc, invoiceDoc]
      : variant === "pending"
        ? [invoiceDoc]
        : [creditNoteDoc, invoiceDoc]
  ).filter((d): d is DocLink => d !== null);
  const cta =
    variant === "pending" && viewer === "guest"
      ? { href: `/booking/${booking.id}/pay`, label: "Complete payment" }
      : viewer === "host"
        ? { href: `/dashboard/bookings/${booking.id}`, label: "Open booking" }
        : { href: `/portal/trips/${booking.id}`, label: "View your trip" };

  return (
    <div
      className={`mx-auto w-full max-w-[420px] overflow-hidden rounded-card border bg-white shadow-card ${tone.card}`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 border-b px-4 py-2.5 ${tone.head}`}
      >
        <StatusIcon className={`h-4 w-4 shrink-0 ${tone.icon}`} />
        <span className="font-display text-[13px] font-bold text-brand-ink">
          Booking {booking.reference}
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${tone.badge}`}
        >
          <StatusIcon className="h-3 w-3" />
          {badgeLabel}
        </span>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        {/* Note */}
        <div className="flex items-start gap-2">
          <NoteIcon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} />
          <p className="text-[13px] font-medium leading-snug text-brand-ink">
            {note}
          </p>
        </div>

        {/* Listing + host */}
        {booking.listingName ? (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-brand-ink">
            <Home className="h-3.5 w-3.5 shrink-0 text-brand-mute" />
            <span className="font-medium">{booking.listingName}</span>
            {viewer === "guest" && booking.hostName ? (
              <span className="text-brand-mute">
                · hosted by {booking.hostName}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Stay details */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-brand-ink">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-brand-mute" />
            {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}
            {n > 0 ? (
              <span className="text-brand-mute">
                · {n} night{n === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
          {booking.headcount ? (
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-brand-mute" />
              {booking.headcount} guest{booking.headcount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {/* Amount breakdown */}
        <div className="space-y-1.5 rounded-[10px] bg-brand-light/60 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-brand-mute">
              <Receipt className="h-3.5 w-3.5" />
              {amountLabel}
            </span>
            <span
              className={`num font-display text-base font-bold ${tone.amount}`}
            >
              {variant === "refunded" ? "− " : ""}
              {formatMoney(amountValue, booking.currency)}
            </span>
          </div>
          {methodLabel && variant !== "refunded" ? (
            <div className="flex items-center justify-between text-[11.5px] text-brand-mute">
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                {variant === "pending" ? "Pay via" : "Paid via"}
              </span>
              <span className="font-medium text-brand-ink">{methodLabel}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-brand-line/70 pt-1.5 text-[11.5px]">
            <span className="text-brand-mute">
              {variant === "paid" && !fullyPaid
                ? "Balance due before check-in"
                : "Booking total"}
            </span>
            <span className="num font-semibold text-brand-ink">
              {formatMoney(
                variant === "paid" && !fullyPaid ? balanceDue : booking.total,
                booking.currency,
              )}
            </span>
          </div>
        </div>

        {/* Downloadable financial documents for the transaction */}
        {docs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {docs.map((d) => (
              <a
                key={d.label}
                href={d.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-ink transition hover:border-brand-primary/50 hover:bg-brand-light"
              >
                <d.Icon className="h-3.5 w-3.5 text-brand-mute" />
                {d.label}
                {d.number ? (
                  <span className="font-normal text-brand-mute">
                    {d.number}
                  </span>
                ) : null}
                <Download className="h-3 w-3 text-brand-primary" />
              </a>
            ))}
          </div>
        ) : null}

        {/* CTA */}
        <Link
          href={cta.href}
          className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          {cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
