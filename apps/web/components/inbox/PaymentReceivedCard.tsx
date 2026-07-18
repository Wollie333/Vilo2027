import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Home,
  PartyPopper,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

import type { ThreadBooking } from "./ThreadQuoteCard";

// A rich, self-contained "payment received — booking confirmed" card rendered
// inline in the guest↔host thread. Reusable for any booking that has settled:
// shows the listing + host, the stay + party, the payment breakdown and status,
// a short thank-you, and a link to the booking. Both viewers see the same facts;
// only the tone of the note + the CTA target differ.

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

export function PaymentReceivedCard({
  booking,
  viewer,
}: {
  booking: ThreadBooking;
  viewer: "host" | "guest";
}) {
  const n = nights(booking.checkIn, booking.checkOut);
  const balanceDue = booking.balanceDue ?? 0;
  const paid = Math.max(0, booking.total - balanceDue);
  const fullyPaid = balanceDue <= 0.5;
  const methodLabel = booking.paymentMethod
    ? (METHOD_LABEL[booking.paymentMethod] ?? booking.paymentMethod)
    : null;

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-card border border-status-confirmed/30 bg-white shadow-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-status-confirmed/20 bg-status-confirmed/10 px-4 py-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-confirmed" />
        <span className="font-display text-[13px] font-bold text-brand-ink">
          Booking {booking.reference}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-pill bg-status-confirmed/15 px-2 py-0.5 text-[10.5px] font-semibold text-status-confirmed">
          <CheckCircle2 className="h-3 w-3" />
          {fullyPaid ? "Paid" : "Confirmed"}
        </span>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        {/* Thank-you note */}
        <div className="flex items-start gap-2">
          <PartyPopper className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
          <p className="text-[13px] font-medium leading-snug text-brand-ink">
            {viewer === "guest"
              ? "Thank you — your payment is confirmed and your stay is booked. We can’t wait to host you!"
              : "Payment received — this booking is now confirmed."}
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

        {/* Payment breakdown */}
        <div className="space-y-1.5 rounded-[10px] bg-brand-light/60 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-brand-mute">
              <Receipt className="h-3.5 w-3.5" />
              {fullyPaid ? "Amount paid" : "Paid so far"}
            </span>
            <span className="num font-display text-base font-bold text-status-confirmed">
              {formatMoney(paid, booking.currency)}
            </span>
          </div>
          {methodLabel ? (
            <div className="flex items-center justify-between text-[11.5px] text-brand-mute">
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Paid via
              </span>
              <span className="font-medium text-brand-ink">{methodLabel}</span>
            </div>
          ) : null}
          {!fullyPaid && balanceDue > 0 ? (
            <div className="flex items-center justify-between border-t border-brand-line/70 pt-1.5 text-[11.5px]">
              <span className="text-brand-mute">
                Balance due before check-in
              </span>
              <span className="num font-semibold text-brand-ink">
                {formatMoney(balanceDue, booking.currency)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-brand-line/70 pt-1.5 text-[11.5px]">
              <span className="text-brand-mute">Total</span>
              <span className="num font-semibold text-brand-ink">
                {formatMoney(booking.total, booking.currency)}
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        <Link
          href={
            viewer === "host"
              ? `/dashboard/bookings/${booking.id}`
              : `/portal/trips/${booking.id}`
          }
          className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          {viewer === "host" ? "Open booking" : "View your trip"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
