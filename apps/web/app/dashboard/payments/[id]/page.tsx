import type { Metadata } from "next";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  ExternalLink,
  FileMinus,
  FileText,
  Globe,
  Receipt,
  RotateCcw,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { PaymentManage } from "./PaymentManage";

export const metadata: Metadata = {
  title: "Payment · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function fmtDt(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const METHOD: Record<string, { label: string; icon: typeof CreditCard }> = {
  paystack: { label: "Card · via Paystack", icon: CreditCard },
  paypal: { label: "PayPal", icon: Globe },
  eft: { label: "Manual EFT", icon: Building2 },
};

const STATUS_TONES: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  authorised: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-indigo-100 text-indigo-800",
  partially_refunded: "bg-indigo-100 text-indigo-800",
  voided: "bg-slate-100 text-slate-700",
};

type BookingJoin = {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  guest_name: string | null;
  guest_email: string | null;
  check_in: string | null;
  check_out: string | null;
  session_date: string | null;
  total_amount: number;
  currency: string;
  listing:
    | { name: string; slug: string | null }
    | { name: string; slug: string | null }[];
};

export default async function PaymentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/payments/${params.id}`);

  // RLS host_read_own_payments scopes this to the host's own bookings.
  const { data: payment } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, method, status, provider_reference, eft_proof_url, created_at, captured_at, authorised_at, failed_at, booking:bookings!inner ( id, reference, status, payment_status, guest_name, guest_email, check_in, check_out, session_date, total_amount, currency, listing:listings!inner ( name, slug ) )",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!payment) notFound();

  const booking = (Array.isArray(payment.booking)
    ? payment.booking[0]
    : payment.booking) as unknown as BookingJoin;
  const listing = Array.isArray(booking.listing)
    ? booking.listing[0]
    : booking.listing;

  // The full financial picture for this payment's booking — invoices, the quote
  // it came from, credit notes, and refunds raised on this payment. This page is
  // the finance overview hub, so it pulls every related document together.
  const [
    { data: invoiceRows },
    { data: quoteRows },
    { data: creditNoteRows },
    { data: refundRows },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total_amount, currency")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select("id, quote_number, status, total_amount, currency")
      .eq("converted_booking_id", booking.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("credit_notes")
      .select("id, credit_note_number, status, total_amount, currency")
      .eq("booking_id", booking.id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("refund_requests")
      .select("id, status, requested_amount, approved_amount, currency")
      .eq("payment_id", payment.id)
      .order("created_at", { ascending: false }),
  ]);

  const invoiceRow = invoiceRows?.[0] ?? null;
  // Booking + payment anchor rows, plus every related document.
  const docCount =
    2 +
    (invoiceRows?.length ?? 0) +
    (quoteRows?.length ?? 0) +
    (creditNoteRows?.length ?? 0) +
    (refundRows?.length ?? 0);

  const method = METHOD[payment.method] ?? {
    label: payment.method,
    icon: Receipt,
  };
  const MethodIcon = method.icon;
  const tone = STATUS_TONES[payment.status] ?? "bg-brand-line text-brand-mute";

  const canManage = payment.method === "eft" && payment.status === "pending";

  const timeline: { label: string; at: string | null; done: boolean }[] = [
    { label: "Created", at: payment.created_at, done: true },
    {
      label: "Authorised",
      at: payment.authorised_at,
      done: payment.authorised_at != null,
    },
    {
      label: payment.status === "failed" ? "Failed" : "Captured / received",
      at: payment.status === "failed" ? payment.failed_at : payment.captured_at,
      done:
        payment.status === "completed" ||
        payment.status === "failed" ||
        payment.captured_at != null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-mute transition-colors hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Payments
        </Link>
      </div>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
              {fmtR(Number(payment.amount), payment.currency)}
            </h1>
            <span
              className={`rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}
            >
              {payment.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-brand-mute">
            <MethodIcon className="h-4 w-4" />
            {method.label}
            <span className="text-brand-line">·</span>
            <span className="font-mono text-xs">{booking.reference}</span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: details */}
        <div className="space-y-6">
          {/* Financial overview — every document tied to this payment. */}
          <section className="rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
              <div>
                <div className="font-display font-semibold text-brand-ink">
                  Financial overview
                </div>
                <div className="mt-0.5 text-xs text-brand-mute">
                  Every quote, invoice, credit note and refund attached to this
                  payment.
                </div>
              </div>
              <span className="rounded-pill bg-brand-accent px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
                {docCount} {docCount === 1 ? "record" : "records"}
              </span>
            </div>
            <div className="divide-y divide-brand-line">
              <DocRow
                icon={Calendar}
                kind="Booking"
                title={booking.reference}
                meta={`Booking ID ${booking.id}`}
                status={booking.status.replace(/_/g, " ")}
                href={`/dashboard/bookings/${booking.id}`}
              />
              <DocRow
                icon={CreditCard}
                kind="Payment"
                title={fmtR(Number(payment.amount), payment.currency)}
                meta={method.label}
                status={payment.status.replace(/_/g, " ")}
                href={null}
              />
              {(quoteRows ?? []).map((q) => (
                <DocRow
                  key={q.id}
                  icon={FileText}
                  kind="Quote"
                  title={q.quote_number}
                  meta={fmtR(Number(q.total_amount), q.currency)}
                  status={q.status}
                  href={`/dashboard/quotes/${q.id}`}
                />
              ))}
              {(invoiceRows ?? []).map((inv) => (
                <DocRow
                  key={inv.id}
                  icon={Receipt}
                  kind="Invoice"
                  title={inv.invoice_number}
                  meta={fmtR(Number(inv.total_amount), inv.currency)}
                  status={inv.status}
                  href={`/dashboard/invoices/${inv.id}`}
                />
              ))}
              {(creditNoteRows ?? []).map((cn) => (
                <DocRow
                  key={cn.id}
                  icon={FileMinus}
                  kind="Credit note"
                  title={cn.credit_note_number}
                  meta={`−${fmtR(Number(cn.total_amount), cn.currency)}`}
                  status={cn.status}
                  href={`/dashboard/credit-notes/${cn.id}`}
                />
              ))}
              {(refundRows ?? []).map((r) => (
                <DocRow
                  key={r.id}
                  icon={RotateCcw}
                  kind="Refund"
                  title={fmtR(
                    Number(r.approved_amount ?? r.requested_amount),
                    r.currency ?? payment.currency,
                  )}
                  meta="Refund request"
                  status={r.status}
                  href="/dashboard/refunds"
                />
              ))}
            </div>
          </section>

          {/* Financial management */}
          <section className="rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-5 py-4">
              <div className="font-display font-semibold text-brand-ink">
                Manage this payment
              </div>
              <div className="mt-0.5 text-xs text-brand-mute">
                {canManage
                  ? "Confirm once the EFT lands in your account, or reject it if it never arrived."
                  : payment.method === "eft"
                    ? "This EFT has already been settled."
                    : "Card payments settle automatically via Paystack — nothing to do here."}
              </div>
            </div>
            <div className="p-5">
              {canManage ? (
                <PaymentManage paymentId={payment.id} />
              ) : (
                <div className="flex items-center gap-3 rounded-card border border-brand-line bg-brand-light/40 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-brand-mute">
                    No manual action needed for this payment.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Payment facts */}
          <section className="rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-5 py-4 font-display font-semibold text-brand-ink">
              Payment details
            </div>
            <dl className="divide-y divide-brand-line text-sm">
              <Row label="Amount">
                <span className="font-display font-bold text-brand-ink">
                  {fmtR(Number(payment.amount), payment.currency)}
                </span>
              </Row>
              <Row label="Method">{method.label}</Row>
              <Row label="Status">
                <span
                  className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                >
                  {payment.status.replace(/_/g, " ")}
                </span>
              </Row>
              <Row label="Provider reference">
                <span className="font-mono text-xs text-brand-ink">
                  {payment.provider_reference ?? "—"}
                </span>
              </Row>
              <Row label="Created">{fmtDt(payment.created_at)}</Row>
              <Row label="Settled">{fmtDt(payment.captured_at)}</Row>
            </dl>
          </section>

          {/* EFT proof */}
          {payment.eft_proof_url ? (
            <section className="rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-5 py-4 font-display font-semibold text-brand-ink">
                Proof of payment
              </div>
              <div className="p-5">
                <a
                  href={payment.eft_proof_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded border border-brand-line px-3.5 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
                >
                  <FileText className="h-4 w-4 text-brand-primary" />
                  View uploaded proof
                  <ExternalLink className="h-3.5 w-3.5 text-brand-mute" />
                </a>
              </div>
            </section>
          ) : null}

          {/* Timeline */}
          <section className="rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-5 py-4 font-display font-semibold text-brand-ink">
              Timeline
            </div>
            <ol className="space-y-4 p-5">
              {timeline.map((t) => (
                <li key={t.label} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${t.done ? "bg-brand-primary" : "bg-brand-line"}`}
                  />
                  <div>
                    <div
                      className={`text-sm font-medium ${t.done ? "text-brand-ink" : "text-brand-mute"}`}
                    >
                      {t.label}
                    </div>
                    <div className="text-xs text-brand-mute">{fmtDt(t.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Right: linked booking */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                Linked booking
              </div>
              <div className="mt-1 font-display font-semibold text-brand-ink">
                {listing?.name ?? "Listing"}
              </div>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center gap-2 text-brand-ink">
                <User className="h-4 w-4 text-brand-mute" />
                <span className="font-medium">
                  {booking.guest_name ?? "Guest"}
                </span>
              </div>
              {booking.guest_email ? (
                <div className="truncate font-mono text-xs text-brand-mute">
                  {booking.guest_email}
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-brand-dark">
                <Calendar className="h-4 w-4 text-brand-mute" />
                {booking.session_date
                  ? fmtDt(booking.session_date)
                  : `${fmtDay(booking.check_in)} → ${fmtDay(booking.check_out)}`}
              </div>
              <div className="flex items-center justify-between border-t border-brand-line pt-3">
                <span className="text-brand-mute">Booking total</span>
                <span className="font-display font-bold text-brand-ink">
                  {fmtR(Number(booking.total_amount), booking.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-mute">Booking status</span>
                <span className="font-medium capitalize text-brand-ink">
                  {booking.status.replace(/_/g, " ")}
                </span>
              </div>
              <Link
                href={`/dashboard/bookings/${booking.id}`}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
              >
                Open booking
                <ExternalLink className="h-4 w-4" />
              </Link>
              {invoiceRow ? (
                <Link
                  href={`/dashboard/invoices/${invoiceRow.id}`}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-accent"
                >
                  Invoice {invoiceRow.invoice_number}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : null}
              {(refundRows ?? []).length > 0 ? (
                <Link
                  href="/dashboard/refunds"
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-accent"
                >
                  {refundRows!.length} refund
                  {refundRows!.length === 1 ? "" : "s"} on this payment
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DocRow({
  icon: Icon,
  kind,
  title,
  meta,
  status,
  href,
}: {
  icon: typeof CreditCard;
  kind: string;
  title: string;
  meta: string;
  status: string;
  href: string | null;
}) {
  const body = (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            {kind}
          </span>
          <span className="rounded-pill bg-brand-line/60 px-1.5 py-0.5 text-[9px] font-semibold capitalize text-brand-mute">
            {status}
          </span>
        </div>
        <div className="truncate font-medium text-brand-ink">{title}</div>
        <div className="text-xs text-brand-mute">{meta}</div>
      </div>
      {href ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-brand-mute" />
      ) : null}
    </div>
  );
  if (!href) return <div className="bg-brand-light/30">{body}</div>;
  return (
    <Link
      href={href}
      className="block transition-colors hover:bg-brand-light/50"
    >
      {body}
    </Link>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-brand-mute">{label}</dt>
      <dd className="text-right text-brand-ink">{children}</dd>
    </div>
  );
}
