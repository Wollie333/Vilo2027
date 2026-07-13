import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  History,
  PenSquare,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { formatMoney } from "@/lib/format";

// A quote rendered inline in a conversation thread, shown to both host and
// guest. The thread is event-sourced: each lifecycle transition is its own
// message, so each renders its OWN immutable card via `kind` —
//   request   → the guest's enquiry (greys out once an official quote exists)
//   issued    → an official sent/revised quote (older versions grey as superseded)
//   accepted  → a compact "accepted" status line
//   declined  → a compact "declined" status line
//   converted → the booking card (a booking now exists)
// `viewer` switches the call-to-action and what financials are emphasised.

export type QuoteCardKind =
  | "request"
  | "issued"
  | "accepted"
  | "declined"
  | "converted";

export type ThreadQuote = {
  id: string;
  quoteNumber: string | null;
  status: string; // draft | sent | accepted | declined | converted | expired
  currency: string;
  total: number;
  checkIn: string | null;
  checkOut: string | null;
  headcount: number | null;
  scope: string | null;
  depositType: string | null;
  depositAmount: number | null;
  balanceAmount: number | null;
  validUntil: string | null;
  acceptToken: string | null;
  convertedBookingId: string | null;
  viewCount?: number;
  lastViewedAt?: string | null;
  // The room (or whole listing) the quote is for — drives the card's cover
  // thumbnail + subtitle. Optional so callers that don't supply it still render.
  subjectName?: string | null;
  subjectImage?: string | null;
  subjectDetail?: string | null;
};

// The booking a quote becomes once accepted — drives the later card states
// (pay now → paid → booking info).
export type ThreadBooking = {
  id: string;
  reference: string;
  status: string; // pending | pending_eft | confirmed | checked_in | completed | cancelled_*
  paymentStatus: string | null;
  paymentMethod: string | null;
  total: number;
  depositAmount: number | null;
  balanceDue: number | null;
  currency: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function nights(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

type StatusMeta = { label: string; cls: string; icon: typeof FileText };
function statusMeta(status: string): StatusMeta {
  switch (status) {
    case "draft":
      return {
        label: "Draft",
        cls: "bg-[#FEF3C7] text-[#92400E]",
        icon: PenSquare,
      };
    case "sent":
      return {
        label: "Quote sent",
        cls: "bg-brand-accent text-brand-secondary",
        icon: FileText,
      };
    case "accepted":
    case "converted":
      return {
        label: status === "converted" ? "Booked" : "Accepted",
        cls: "bg-status-confirmed/15 text-status-confirmed",
        icon: CheckCircle2,
      };
    case "declined":
      return {
        label: "Declined",
        cls: "bg-[#FEE2E2] text-[#991B1B]",
        icon: XCircle,
      };
    case "expired":
      return {
        label: "Expired",
        cls: "bg-brand-light text-brand-mute",
        icon: Clock,
      };
    default:
      return {
        label: status,
        cls: "bg-brand-light text-brand-mute",
        icon: FileText,
      };
  }
}

// Booking-state meta once the quote has been accepted (a booking exists).
function bookingStateMeta(
  b: ThreadBooking,
  viewer: "host" | "guest",
): { kind: "payable" | "active" | "cancelled"; meta: StatusMeta } {
  const paid = b.paymentStatus === "completed";
  const cancelled =
    b.status.startsWith("cancelled") ||
    b.status === "declined" ||
    b.status === "expired" ||
    b.status === "no_show";
  if (cancelled) {
    return {
      kind: "cancelled",
      meta: {
        label: "Cancelled",
        cls: "bg-[#FEE2E2] text-[#991B1B]",
        icon: XCircle,
      },
    };
  }
  if (!paid && (b.status === "pending" || b.status === "pending_eft")) {
    return {
      kind: "payable",
      meta: {
        label: viewer === "guest" ? "Pay to confirm" : "Awaiting payment",
        cls: "bg-[#FEF3C7] text-[#92400E]",
        icon: Clock,
      },
    };
  }
  const label =
    b.status === "checked_in"
      ? "Checked in"
      : b.status === "completed"
        ? "Completed"
        : "Confirmed";
  return {
    kind: "active",
    meta: {
      label,
      cls: "bg-status-confirmed/15 text-status-confirmed",
      icon: CheckCircle2,
    },
  };
}

export function ThreadQuoteCard({
  quote,
  booking,
  viewer,
  kind = "issued",
  superseded = false,
  snapshotBody = null,
}: {
  quote: ThreadQuote;
  booking?: ThreadBooking | null;
  viewer: "host" | "guest";
  // Which lifecycle event this card represents (see file header).
  kind?: QuoteCardKind;
  // An older issued version (or a request now answered) — render greyed/inactive.
  superseded?: boolean;
  // The event message body, used as the frozen snapshot label on superseded /
  // status cards (e.g. "Quote QF-12 sent · R3 960").
  snapshotBody?: string | null;
}) {
  const n = nights(quote.checkIn, quote.checkOut);

  // ── Compact status-event cards (accept / decline) ─────────────────────
  if (kind === "accepted" || kind === "declined") {
    const accepted = kind === "accepted";
    const Icon = accepted ? CheckCircle2 : XCircle;
    return (
      <div
        className={`mx-auto flex w-full max-w-[420px] items-center gap-2 rounded-card border px-4 py-2.5 text-[12.5px] font-medium ${
          accepted
            ? "border-status-confirmed/30 bg-status-confirmed/10 text-status-confirmed"
            : "border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-brand-ink">
          {snapshotBody || (accepted ? "Quote accepted." : "Quote declined.")}
        </span>
      </div>
    );
  }

  // ── Superseded request / issued card (a newer version exists) ─────────
  if (superseded) {
    const title =
      kind === "request"
        ? "Quote request"
        : `Quote ${quote.quoteNumber ?? ""}`.trim();
    return (
      <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-card border border-brand-line bg-brand-light/40 opacity-75">
        <div className="flex items-center gap-2 border-b border-brand-line px-4 py-2.5">
          <FileText className="h-4 w-4 text-brand-mute" />
          <span className="font-display text-[13px] font-bold text-brand-mute">
            {title}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
            <History className="h-3 w-3" />
            {kind === "request" ? "Answered" : "Superseded"}
          </span>
        </div>
        <div className="px-4 py-3 text-[12px] text-brand-mute">
          <div>
            {snapshotBody ||
              (kind === "request"
                ? "The host replied with a quote below."
                : "Replaced by a revised quote below.")}
          </div>
          <div className="mt-1 inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {fmtDate(quote.checkIn)} → {fmtDate(quote.checkOut)}
            {n > 0 ? (
              <span>
                · {n} night{n === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ── Booking-state card (converted → booking exists) ───────────────────
  if (booking) {
    const { kind, meta } = bookingStateMeta(booking, viewer);
    const StatusIcon = meta.icon;
    const depositDue =
      booking.depositAmount != null &&
      booking.depositAmount > 0 &&
      booking.depositAmount < booking.total
        ? booking.depositAmount
        : null;
    return (
      <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex items-center gap-2 border-b border-brand-line bg-brand-light/50 px-4 py-2.5">
          <FileText className="h-4 w-4 text-brand-primary" />
          <span className="font-display text-[13px] font-bold text-brand-ink">
            Booking {booking.reference}
          </span>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}
          >
            <StatusIcon className="h-3 w-3" />
            {meta.label}
          </span>
        </div>
        <div className="space-y-2.5 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-brand-ink">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-brand-mute" />
              {fmtDate(quote.checkIn)} → {fmtDate(quote.checkOut)}
              {n > 0 ? (
                <span className="text-brand-mute">
                  · {n} night{n === 1 ? "" : "s"}
                </span>
              ) : null}
            </span>
            {quote.headcount ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-brand-mute" />
                {quote.headcount} guest{quote.headcount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <div className="rounded-[10px] bg-brand-light/60 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-brand-mute">Total</span>
              <span className="num font-display text-base font-bold text-brand-ink">
                {formatMoney(booking.total, booking.currency)}
              </span>
            </div>
            {kind === "payable" && depositDue ? (
              <div className="mt-1 flex items-center justify-between text-[11.5px] text-brand-mute">
                <span>Deposit due now</span>
                <span className="num">
                  {formatMoney(depositDue, booking.currency)}
                </span>
              </div>
            ) : null}
            {kind === "active" &&
            booking.balanceDue != null &&
            booking.balanceDue > 0 ? (
              <div className="mt-1 flex items-center justify-between text-[11.5px] text-brand-mute">
                <span>Balance due before check-in</span>
                <span className="num">
                  {formatMoney(booking.balanceDue, booking.currency)}
                </span>
              </div>
            ) : null}
          </div>

          {/* CTA */}
          {kind === "payable" && viewer === "guest" ? (
            <Link
              href={`/booking/${booking.id}/pay`}
              className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary"
            >
              Pay now <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : kind === "payable" && viewer === "host" ? (
            <p className="text-[11.5px] text-brand-mute">
              Waiting for the guest to pay — you&rsquo;ll be notified when it
              confirms.
            </p>
          ) : (
            <Link
              href={
                viewer === "host"
                  ? `/dashboard/bookings/${booking.id}`
                  : `/portal/trips/${booking.id}`
              }
              className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-line bg-white text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
            >
              {viewer === "host" ? "Open booking" : "View booking"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── Quote-state card (no booking yet) ─────────────────────────────────
  const isDraft = quote.status === "draft";
  const meta = statusMeta(quote.status);
  const StatusIcon = meta.icon;
  const expiresIn = daysUntil(quote.validUntil);
  const expired =
    quote.validUntil != null && expiresIn != null && expiresIn < 0;

  // Title reflects whose perspective: a draft is "the request"; once sent it's
  // a real quote.
  const title = isDraft
    ? viewer === "host"
      ? "Quote request (draft)"
      : "Your request"
    : `Quote ${quote.quoteNumber ?? ""}`.trim();

  // A draft request goes straight to the editor (no detour via the detail page)
  // so "Complete & send quote" is one click; a sent quote opens its detail view.
  const hostHref = isDraft
    ? `/dashboard/quotes/${quote.id}/edit`
    : `/dashboard/quotes/${quote.id}`;
  const guestHref = quote.acceptToken
    ? `/q/${quote.id}/${quote.acceptToken}`
    : null;

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-brand-line bg-brand-light/50 px-4 py-2.5">
        <FileText className="h-4 w-4 text-brand-primary" />
        <span className="font-display text-[13px] font-bold text-brand-ink">
          {title}
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}
        >
          <StatusIcon className="h-3 w-3" />
          {meta.label}
        </span>
      </div>

      {/* Body */}
      <div className="space-y-3 px-4 py-3.5">
        {/* Subject — the room (or whole place) the quote is for */}
        {quote.subjectName ? (
          <div className="flex items-center gap-3">
            {quote.subjectImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={quote.subjectImage}
                alt=""
                className="h-12 w-12 shrink-0 rounded-[10px] border border-brand-line object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent/40 text-brand-primary">
                <BedDouble className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-display text-[13.5px] font-bold text-brand-ink">
                {quote.subjectName}
              </div>
              {quote.subjectDetail ? (
                <div className="truncate text-[11.5px] text-brand-mute">
                  {quote.subjectDetail}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Stay details */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-brand-ink">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-brand-mute" />
            {fmtDate(quote.checkIn)} → {fmtDate(quote.checkOut)}
            {n > 0 ? (
              <span className="text-brand-mute">
                · {n} night{n === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
          {quote.headcount ? (
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-brand-mute" />
              {quote.headcount} guest{quote.headcount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {/* Price (host, or any sent quote) vs waiting-for-quote (guest draft).
            A draft's total is already priced by the seasonal engine, so the
            host's figure is a real auto-calculated suggestion. */}
        {!(isDraft && viewer === "guest") ? (
          <div className="rounded-[10px] border border-brand-line bg-brand-light/60 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-brand-mute">
                {isDraft ? "Suggested price" : "Total"}
              </span>
              <span className="num font-display text-base font-bold text-brand-ink">
                {formatMoney(quote.total, quote.currency)}
              </span>
            </div>
            {isDraft ? (
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand-primary">
                <Sparkles className="h-3 w-3" />
                Auto-calculated from your rates &amp; calendar
              </div>
            ) : quote.depositAmount != null && quote.depositAmount > 0 ? (
              <div className="mt-1 flex items-center justify-between text-[11.5px] text-brand-mute">
                <span>Due now (deposit)</span>
                <span className="num">
                  {formatMoney(quote.depositAmount, quote.currency)}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-[10px] border border-brand-line bg-brand-light/60 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent/50 text-brand-primary">
              <Clock className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-brand-ink">
                Waiting for the quote
              </div>
              <div className="text-[11.5px] text-brand-mute">
                The host is preparing your tailored price.
              </div>
            </div>
          </div>
        )}

        {/* Validity / seen meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-mute">
          {quote.status === "sent" && quote.validUntil ? (
            <span
              className={`inline-flex items-center gap-1 ${expired ? "text-status-cancelled" : ""}`}
            >
              <Clock className="h-3 w-3" />
              {expired
                ? "Expired"
                : expiresIn === 0
                  ? "Expires today"
                  : `Valid ${expiresIn} more day${expiresIn === 1 ? "" : "s"}`}
            </span>
          ) : null}
          {viewer === "host" && (quote.viewCount ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1 text-brand-primary">
              <Eye className="h-3 w-3" />
              Seen {quote.viewCount}×
            </span>
          ) : null}
        </div>

        {/* CTA */}
        {viewer === "host" ? (
          <Link
            href={hostHref}
            className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary"
          >
            {isDraft ? (
              <>
                <PenSquare className="h-3.5 w-3.5" /> Complete &amp; send quote
              </>
            ) : (
              <>
                Open quote <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Link>
        ) : !isDraft && guestHref ? (
          <Link
            href={guestHref}
            className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary"
          >
            {quote.status === "sent" ? (
              <>
                View &amp; accept <ArrowRight className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                View quote <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
