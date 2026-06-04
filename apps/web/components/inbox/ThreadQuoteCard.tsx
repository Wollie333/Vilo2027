import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  PenSquare,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { formatMoney } from "@/lib/format";

// A quote rendered inline in a conversation thread. The SAME card is shown to
// the host and the guest; it reflects the quote's LIVE state, so a draft (the
// guest's request) becomes a full, priced quote in place once the host sends
// it. `viewer` switches the call-to-action and what financials are emphasised.

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
  viewCount?: number;
  lastViewedAt?: string | null;
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

export function ThreadQuoteCard({
  quote,
  viewer,
}: {
  quote: ThreadQuote;
  viewer: "host" | "guest";
}) {
  const isDraft = quote.status === "draft";
  const meta = statusMeta(quote.status);
  const StatusIcon = meta.icon;
  const n = nights(quote.checkIn, quote.checkOut);
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

  const hostHref = `/dashboard/quotes/${quote.id}`;
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

        {/* Pricing — hidden for a guest while it's still a draft (the host
            hasn't finalised/sent it). The host always sees the working total. */}
        {!(isDraft && viewer === "guest") ? (
          <div className="rounded-[10px] bg-brand-light/60 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-brand-mute">
                {isDraft ? "Suggested total" : "Total"}
              </span>
              <span className="num font-display text-base font-bold text-brand-ink">
                {formatMoney(quote.total, quote.currency)}
              </span>
            </div>
            {!isDraft &&
            quote.depositAmount != null &&
            quote.depositAmount > 0 ? (
              <div className="mt-1 flex items-center justify-between text-[11.5px] text-brand-mute">
                <span>Due now (deposit)</span>
                <span className="num">
                  {formatMoney(quote.depositAmount, quote.currency)}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[12px] text-brand-mute">
            Your request is with the host — they’ll reply here with a tailored
            quote.
          </p>
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
