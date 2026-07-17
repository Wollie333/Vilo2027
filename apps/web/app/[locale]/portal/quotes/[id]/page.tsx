import type { Metadata } from "next";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Download,
  Luggage,
  MessageSquare,
} from "lucide-react";
import { headers } from "next/headers";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";

import { BrandName } from "@/components/brand/BrandProvider";
import { formatMoney } from "@/lib/format";
import { recordQuoteView } from "@/lib/quotes/tracking";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { QuoteActions } from "./QuoteActions";

export const metadata: Metadata = {
  title: "Your quote",
};

export const dynamic = "force-dynamic";

export default async function PortalQuotePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout gates auth; this guards the typed user.id below.
  if (!user) notFound();

  // Resolve via the admin client scoped to THIS user's id OR email, then verify
  // ownership in code — host-created quotes carry guest_email but no guest_id
  // until accepted, so an RLS-by-guest_id read would 404 them (the list shows
  // them by email, so the detail must match).
  const admin = createAdminClient();
  const email = (user.email ?? "").trim().toLowerCase();
  const { data: quote } = await admin
    .from("quotes")
    .select(
      `
      id, quote_number, status, guest_id, guest_email,
      guest_name, quote_type, title, attachment_name,
      brochure_path, brochure_name,
      check_in, check_out, headcount,
      base_amount, cleaning_fee, addons_total, total_amount, currency,
      notes, valid_until, conversation_id,
      converted_booking_id, accept_token,
      listing:properties ( name )
    `,
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  const ownsQuote =
    !!quote &&
    (quote.guest_id === user.id ||
      (quote.guest_email ?? "").toLowerCase() === email);
  if (!quote || !ownsQuote) notFound();

  // Stamp the guest's view so the "Viewed" quote stage records a timestamp + green
  // check even when they accept immediately (the accept actions don't record a
  // view, and this signed-in surface previously recorded nothing). Only while the
  // quote is still open for a decision, so pay-page revisits after accepting don't
  // inflate the count. Best-effort — never blocks the page.
  if (quote.status === "sent") {
    await recordQuoteView(admin, quote.id, headers().get("user-agent"));
  }

  const { data: addons } = await admin
    .from("quote_addons")
    .select("label, quantity, unit_price, subtotal")
    .eq("quote_id", params.id)
    .order("sort_order");

  const listingName = Array.isArray(quote.listing)
    ? quote.listing[0]?.name
    : (quote.listing as { name?: string } | null)?.name;

  // Custom/upload quotes have no listing or dates — show the title + a plain
  // "quote" framing instead of a stay.
  const isCustomQuote =
    quote.quote_type === "custom" || quote.quote_type === "upload";
  const heading = isCustomQuote
    ? (quote.title ?? "Your quote")
    : `Your stay at ${listingName ?? "—"}`;

  const expired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const actionable = quote.status === "sent" && !expired;

  // An accepted quote has already become a (pending) booking. Pull its pay
  // state so the guest can pay/secure it here instead of being stranded on a
  // bland "you've already responded" panel.
  const isAcceptedLike =
    quote.status === "accepted" || quote.status === "converted";
  let booking: {
    id: string;
    pay_token: string | null;
    payment_status: string | null;
  } | null = null;
  if (isAcceptedLike && quote.converted_booking_id) {
    const { data: b } = await admin
      .from("bookings")
      .select("id, pay_token, payment_status")
      .eq("id", quote.converted_booking_id)
      .maybeSingle();
    booking = b ?? null;
  }
  const needsPayment = !!booking && booking.payment_status !== "paid";
  // Upload quotes hand back the host's actual file; every other type renders a
  // generated PDF.
  const isUploadQuote = quote.quote_type === "upload";
  const downloadHref = isUploadQuote
    ? `/q/${quote.id}/${quote.accept_token}/file`
    : `/q/${quote.id}/${quote.accept_token}/pdf`;
  const downloadLabel = isUploadQuote
    ? (quote.attachment_name ?? "Download quote")
    : "Download PDF";
  // Optional host brochure attached to this quote — served token-gated, same as
  // the upload file.
  const brochureHref = quote.brochure_path
    ? `/q/${quote.id}/${quote.accept_token}/brochure`
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/portal/quotes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-mute transition-colors hover:text-brand-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All quotes
      </Link>

      <header className="text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
          Quote · {quote.quote_number}
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          {heading}
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Prepared for {quote.guest_name}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <a
            href={downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />{" "}
            <span className="truncate">{downloadLabel}</span>
          </a>
          {brochureHref ? (
            <a
              href={brochureHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" />{" "}
              <span className="truncate">
                {quote.brochure_name ?? "Download brochure"}
              </span>
            </a>
          ) : null}
        </div>
      </header>

      {!isCustomQuote ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                Check-in
              </div>
              <div className="font-medium text-brand-ink">{quote.check_in}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                Check-out
              </div>
              <div className="font-medium text-brand-ink">
                {quote.check_out}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                Guests
              </div>
              <div className="font-medium text-brand-ink">
                {quote.headcount}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Line items
        </h2>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-brand-line">
            <tr>
              <td className="py-2 text-brand-ink">
                {isCustomQuote ? (quote.title ?? "Quote") : "Stay — base"}
              </td>
              <td className="py-2 text-right font-medium text-brand-ink">
                {formatMoney(quote.base_amount, quote.currency)}
              </td>
            </tr>
            {quote.cleaning_fee > 0 ? (
              <tr>
                <td className="py-2 text-brand-ink">Cleaning</td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {formatMoney(quote.cleaning_fee, quote.currency)}
                </td>
              </tr>
            ) : null}
            {(addons ?? []).map((a, i) => (
              <tr key={i}>
                <td className="py-2 text-brand-ink">
                  {a.label}
                  <span className="ml-1 text-brand-mute">× {a.quantity}</span>
                </td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {formatMoney(a.subtotal, quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 font-display text-base font-bold text-brand-ink">
                Total
              </td>
              <td className="pt-3 text-right font-display text-lg font-bold text-brand-primary">
                {formatMoney(quote.total_amount, quote.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {quote.notes ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-brand-ink">
            Notes from the host
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-brand-ink">
            {quote.notes}
          </p>
        </section>
      ) : null}

      {expired ? (
        <div className="rounded-card border border-status-cancelled/30 bg-status-cancelled/5 p-5 text-center shadow-card">
          <p className="text-sm font-medium text-status-cancelled">
            This quote expired on{" "}
            {quote.valid_until &&
              new Date(quote.valid_until).toLocaleDateString("en-ZA")}
            .
          </p>
          <p className="mt-1 text-xs text-brand-mute">
            Message the host for an updated quote.
          </p>
        </div>
      ) : quote.status === "declined" ? (
        <div className="rounded-card border border-brand-line bg-white p-5 text-center shadow-card">
          <p className="text-sm font-medium text-brand-ink">
            You declined this quote.
          </p>
          <p className="mt-1 text-xs text-brand-mute">
            Changed your mind? Message the host for an updated quote.
          </p>
        </div>
      ) : isAcceptedLike && isCustomQuote ? (
        <div className="rounded-card border border-brand-line bg-white p-5 text-center shadow-card">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-status-confirmed/10 text-status-confirmed">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-brand-ink">
            You accepted this quote.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-brand-mute">
            The host will be in touch about next steps and payment.
          </p>
        </div>
      ) : isAcceptedLike && needsPayment && booking?.pay_token ? (
        <div className="rounded-card border border-brand-primary/30 bg-brand-accent/20 p-5 text-center shadow-card">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-brand-ink">
            You accepted — your dates are held.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-brand-mute">
            Secure your booking by paying now. You can also come back to it any
            time from your trips.
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link
              href={`/pay/${booking.pay_token}`}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary sm:w-auto"
            >
              <CreditCard className="h-4 w-4" /> Pay now &amp; confirm
            </Link>
            <Link
              href={`/portal/trips/${booking.id}`}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-pill border border-brand-line px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-white sm:w-auto"
            >
              <Luggage className="h-4 w-4" /> View your trip
            </Link>
          </div>
        </div>
      ) : isAcceptedLike ? (
        <div className="rounded-card border border-brand-line bg-white p-5 text-center shadow-card">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-status-confirmed/10 text-status-confirmed">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-brand-ink">
            You&rsquo;re booked! 🎉
          </p>
          <p className="mt-1 text-xs text-brand-mute">
            This quote is confirmed and paid.
          </p>
          {booking?.id ? (
            <Link
              href={`/portal/trips/${booking.id}`}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              <Luggage className="h-4 w-4" /> View your trip
            </Link>
          ) : null}
        </div>
      ) : actionable ? (
        <QuoteActions quoteId={quote.id} />
      ) : (
        <div className="rounded-card border border-brand-line bg-white p-5 text-center shadow-card">
          <p className="text-sm font-medium text-brand-ink">
            This quote isn&rsquo;t ready to respond to yet.
          </p>
          <p className="mt-1 text-xs text-brand-mute">
            The host is still preparing it — you&rsquo;ll be notified when
            it&rsquo;s sent.
          </p>
        </div>
      )}

      {quote.conversation_id ? (
        <div className="text-center">
          <Link
            href={`/portal/inbox/${quote.conversation_id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary transition-colors hover:text-brand-secondary"
          >
            <MessageSquare className="h-4 w-4" /> Message the host about this
            quote
          </Link>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-brand-mute">
        Sent via <BrandName />
      </p>
    </div>
  );
}
