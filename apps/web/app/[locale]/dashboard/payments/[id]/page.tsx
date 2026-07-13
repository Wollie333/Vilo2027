import type { Metadata } from "next";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  ExternalLink,
  FileMinus,
  FileText,
  Globe,
  Info,
  Receipt,
  RotateCcw,
  ShieldCheck,
  User,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";

import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { getMyHostId } from "@/lib/host/current";
import { sumPaidFromRows } from "@/lib/payments/ledger";
import { createServerClient } from "@/lib/supabase/server";

import { PaymentManage } from "./PaymentManage";

export const metadata: Metadata = {
  title: "Payment",
};

export const dynamic = "force-dynamic";

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
  });
}

function initials(name: string | null): string {
  if (!name) return "G";
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "G"
  );
}

const METHOD: Record<string, { label: string; icon: typeof CreditCard }> = {
  paystack: { label: "Card · via Paystack", icon: CreditCard },
  paypal: { label: "PayPal", icon: Globe },
  eft: { label: "Manual EFT", icon: Building2 },
};

const STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  completed: {
    label: "Captured",
    tone: "bg-status-confirmed/12 text-status-confirmed ring-1 ring-status-confirmed/25",
    dot: "bg-status-confirmed",
  },
  authorised: {
    label: "Authorised",
    tone: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Pending",
    tone: "bg-status-pending/12 text-amber-700 ring-1 ring-status-pending/25",
    dot: "bg-status-pending",
  },
  failed: {
    label: "Failed",
    tone: "bg-status-cancelled/12 text-status-cancelled ring-1 ring-status-cancelled/25",
    dot: "bg-status-cancelled",
  },
  refunded: {
    label: "Refunded",
    tone: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
    dot: "bg-indigo-500",
  },
  partially_refunded: {
    label: "Part-refunded",
    tone: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
    dot: "bg-indigo-500",
  },
  voided: {
    label: "Voided",
    tone: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    dot: "bg-slate-400",
  },
};

// Timeline entry palette — one colour family per event kind, so a host can scan
// the paper trail and tell money-in from money-out from documents at a glance.
const EV_TONE: Record<string, { dot: string; tag: string }> = {
  green: {
    dot: "bg-status-confirmed",
    tag: "bg-status-confirmed/12 text-status-confirmed",
  },
  amber: {
    dot: "bg-status-pending",
    tag: "bg-status-pending/15 text-amber-700",
  },
  red: {
    dot: "bg-status-cancelled",
    tag: "bg-status-cancelled/12 text-status-cancelled",
  },
  indigo: { dot: "bg-indigo-500", tag: "bg-indigo-100 text-indigo-700" },
  blue: {
    dot: "bg-brand-secondary",
    tag: "bg-brand-accent/60 text-brand-secondary",
  },
  slate: { dot: "bg-brand-mute", tag: "bg-brand-line text-brand-mute" },
  violet: { dot: "bg-violet-500", tag: "bg-violet-100 text-violet-700" },
};

type TxEvent = {
  at: string;
  title: string;
  kind: string;
  tone: keyof typeof EV_TONE;
  amount?: number;
  flow?: "in" | "out";
  meta?: string;
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
  nights: number | null;
  session_date: string | null;
  base_amount: number | null;
  cleaning_fee: number | null;
  discount_amount: number | null;
  balance_due: number | null;
  total_amount: number;
  currency: string;
  created_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
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
  const brandName = await getBrandName();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/payments/${params.id}`);

  const myHostId = await getMyHostId(supabase);
  if (!myHostId) notFound();

  const { data: payment } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, method, status, provider_reference, eft_proof_url, recorded_by, created_at, captured_at, authorised_at, failed_at, booking:bookings!inner ( id, reference, status, payment_status, guest_name, guest_email, check_in, check_out, nights, session_date, base_amount, cleaning_fee, discount_amount, balance_due, total_amount, currency, created_at, confirmed_at, cancelled_at, listing:properties!inner ( name, slug ) )",
    )
    .eq("id", params.id)
    .eq("booking.host_id", myHostId)
    .maybeSingle();

  if (!payment) notFound();

  const booking = (Array.isArray(payment.booking)
    ? payment.booking[0]
    : payment.booking) as unknown as BookingJoin;
  const listing = Array.isArray(booking.listing)
    ? booking.listing[0]
    : booking.listing;

  const [
    { data: addonRows },
    { data: invoiceRows },
    { data: quoteRows },
    { data: creditNoteRows },
    { data: refundRows },
    { data: bookingPayRows },
  ] = await Promise.all([
    supabase
      .from("booking_addons")
      .select("label, subtotal")
      .eq("booking_id", booking.id)
      .order("sort_order"),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, total_amount, currency, created_at, paid_at, hosted_token",
      )
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select(
        "id, quote_number, status, total_amount, currency, sent_at, converted_at",
      )
      .eq("converted_booking_id", booking.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("credit_notes")
      .select(
        "id, credit_note_number, status, total_amount, currency, issued_at, reason",
      )
      .eq("booking_id", booking.id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("refund_requests")
      .select(
        "id, reference, status, requested_amount, approved_amount, currency, created_at, actioned_at, actioned_by, decline_reason, payment_id, initiated_by",
      )
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("amount, kind, status, voided_at, refunded_amount")
      .eq("booking_id", booking.id),
  ]);

  // Resolve the people behind the money — who recorded/authorised the payment
  // (payments.recorded_by) and who approved/declined each refund
  // (refund_requests.actioned_by) — to display names.
  const actorIds = Array.from(
    new Set(
      [
        payment.recorded_by,
        ...(refundRows ?? []).map((r) => r.actioned_by),
      ].filter((v): v is string => Boolean(v)),
    ),
  );
  const nameById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actorRows } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const a of actorRows ?? [])
      nameById.set(a.id, a.full_name || a.email || "Team member");
  }
  const recordedByName = payment.recorded_by
    ? (nameById.get(payment.recorded_by) ?? "Team member")
    : null;

  // Balance still due — derived from the booking's COMPLETED payments (canonical
  // sumPaidFromRows), not the stored balance_due column, so it can't show stale.
  const bookingBalanceDue =
    Math.round(
      Math.max(
        0,
        Number(booking.total_amount) -
          sumPaidFromRows(
            (bookingPayRows ?? []).map((p) => ({
              amount: Number(p.amount),
              kind: p.kind,
              status: p.status,
              voided_at: p.voided_at,
              refunded_amount: Number(p.refunded_amount ?? 0),
            })),
          ),
      ) * 100,
    ) / 100;

  const invoiceRow = invoiceRows?.[0] ?? null;
  const ccy = payment.currency;
  const method = METHOD[payment.method] ?? {
    label: payment.method,
    icon: Receipt,
  };
  const MethodIcon = method.icon;
  const canManage = payment.method === "eft" && payment.status === "pending";

  // ── What the guest paid — the booking's own line items. ──
  const refundedTotal = (refundRows ?? [])
    .filter((r) => r.status === "completed" && r.payment_id === payment.id)
    .reduce(
      (s, r) => s + Number(r.approved_amount ?? r.requested_amount ?? 0),
      0,
    );
  const hasOpenRefund = (refundRows ?? []).some(
    (r) =>
      r.status === "pending" ||
      r.status === "approved" ||
      r.status === "processing",
  );

  // Display status reflects refund state: a captured payment that's been fully
  // or partly refunded reads as Refunded / Part-refunded (payments.status stays
  // "completed"; refunds are tracked via refunded_amount, not the status column).
  const displayStatusKey =
    payment.status === "completed" && refundedTotal > 0
      ? refundedTotal >= Number(payment.amount) - 0.005
        ? "refunded"
        : "partially_refunded"
      : payment.status;
  const st = STATUS[displayStatusKey] ?? {
    label: payment.status.replace(/_/g, " "),
    tone: "bg-brand-line text-brand-mute",
    dot: "bg-brand-mute",
  };

  // Money has landed — a captured payment stays captured after a (partial)
  // refund, so don't gate "captured" copy on status === "completed".
  const isCaptured =
    Boolean(payment.captured_at) ||
    ["completed", "partially_refunded", "refunded"].includes(payment.status);

  // Booking settlement state. A terminal booking is "closed & handled" once no
  // refund is still in flight and there's nothing genuinely left to collect.
  // Note: a cancelled / declined / no-show booking writes off any unpaid
  // remainder (retained = revenue, outstanding written off) — that leftover is
  // NOT "still to collect". Only a live booking or an actual stay
  // (completed / checked_out) leaves a collectable balance.
  const TERMINAL_BOOKING = new Set([
    "completed",
    "checked_out",
    "cancelled_by_host",
    "cancelled_by_guest",
    "no_show",
    "declined",
    "expired",
  ]);
  const isWrittenOff = [
    "cancelled_by_host",
    "cancelled_by_guest",
    "no_show",
    "declined",
    "expired",
  ].includes(booking.status);
  const stillToCollect = !isWrittenOff && bookingBalanceDue > 0;
  const bookingClosed =
    TERMINAL_BOOKING.has(booking.status) && !hasOpenRefund && !stillToCollect;
  const paidLines: { label: string; amount: number }[] = [];
  if (Number(booking.base_amount ?? 0) > 0)
    paidLines.push({
      label: "Accommodation",
      amount: Number(booking.base_amount),
    });
  if (Number(booking.cleaning_fee ?? 0) > 0)
    paidLines.push({
      label: "Cleaning fee",
      amount: Number(booking.cleaning_fee),
    });
  for (const a of addonRows ?? [])
    paidLines.push({ label: a.label, amount: Number(a.subtotal) });
  if (Number(booking.discount_amount ?? 0) > 0)
    paidLines.push({
      label: "Discount",
      amount: -Number(booking.discount_amount),
    });

  // ── History — a chronological audit trail. Every money event on the booking:
  // quotes, the booking lifecycle, payments, invoices, CREDIT NOTES (the
  // reversal/write-down paper trail — previously missing), and refunds. ──
  const m = (n: number) => formatMoney(n, ccy);
  const history: TxEvent[] = [];
  const log = (at: string | null, e: Omit<TxEvent, "at">) => {
    if (at) history.push({ at, ...e });
  };
  const joinMeta = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(" · ") || undefined;

  for (const q of quoteRows ?? []) {
    log(q.sent_at, {
      title: `Quote ${q.quote_number} sent`,
      kind: "Quote",
      tone: "violet",
      amount: Number(q.total_amount),
    });
    log(q.converted_at, {
      title: `Quote ${q.quote_number} accepted`,
      kind: "Quote",
      tone: "violet",
      meta: "converted to a booking",
    });
  }
  log(booking.created_at, {
    title: `Booking ${booking.reference} created`,
    kind: "Booking",
    tone: "slate",
    amount: Number(booking.total_amount),
  });
  log(booking.confirmed_at, {
    title: "Booking confirmed",
    kind: "Booking",
    tone: "green",
  });
  log(booking.cancelled_at, {
    title: "Booking cancelled",
    kind: "Booking",
    tone: "red",
  });
  log(payment.created_at, {
    title: "Payment initiated",
    kind: "Payment",
    tone: "amber",
    amount: Number(payment.amount),
    meta: method.label.split(" · ")[0],
  });
  log(payment.authorised_at, {
    title: "Card authorised",
    kind: "Payment",
    tone: "blue",
  });
  log(payment.captured_at, {
    title: "Funds captured",
    kind: "Payment",
    tone: "green",
    amount: Number(payment.amount),
    flow: "in",
    meta: joinMeta(
      payment.provider_reference ? `ref ${payment.provider_reference}` : null,
      recordedByName ? `by ${recordedByName}` : null,
    ),
  });
  log(payment.failed_at, {
    title: "Payment failed",
    kind: "Payment",
    tone: "red",
  });
  for (const inv of invoiceRows ?? []) {
    log(inv.created_at, {
      title: `Invoice ${inv.invoice_number} issued`,
      kind: "Invoice",
      tone: "blue",
      amount: Number(inv.total_amount),
    });
    log(inv.paid_at, {
      title: `Invoice ${inv.invoice_number} marked paid`,
      kind: "Invoice",
      tone: "green",
      flow: "in",
    });
  }
  for (const cn of creditNoteRows ?? []) {
    log(cn.issued_at, {
      title: `Credit note ${cn.credit_note_number} issued`,
      kind: "Credit note",
      tone: "indigo",
      amount: Number(cn.total_amount),
      flow: "out",
      meta: cn.reason ?? undefined,
    });
  }
  const DECLINE_LABEL: Record<string, string> = {
    outside_policy: "outside policy",
    no_show: "no-show",
    terms_violated: "terms violated",
    services_rendered: "services rendered",
    other: "other",
  };
  for (const r of refundRows ?? []) {
    const ref = r.reference ? ` ${r.reference}` : "";
    const approved = Number(r.approved_amount ?? r.requested_amount ?? 0);
    const who = r.actioned_by ? nameById.get(r.actioned_by) : null;
    const byMeta = who ? `by ${who}` : null;
    log(r.created_at, {
      title: `Refund${ref} requested`,
      kind: "Refund",
      tone: "amber",
      amount: Number(r.requested_amount),
      meta: r.initiated_by === "guest" ? "requested by the guest" : undefined,
    });
    if (r.status === "declined") {
      const why = r.decline_reason
        ? (DECLINE_LABEL[r.decline_reason] ??
          r.decline_reason.replace(/_/g, " "))
        : null;
      log(r.actioned_at, {
        title: `Refund${ref} declined`,
        kind: "Refund",
        tone: "red",
        meta: joinMeta(why, byMeta),
      });
    } else if (r.status === "approved" || r.status === "completed") {
      // Push the payout first so, at the same actioned_at, it sorts above the
      // approval line (newest-first).
      if (r.status === "completed")
        log(r.actioned_at, {
          title: `Refund${ref} paid out`,
          kind: "Refund",
          tone: "green",
          amount: approved,
          flow: "out",
        });
      log(r.actioned_at, {
        title: `Refund${ref} approved`,
        kind: "Refund",
        tone: "indigo",
        amount: approved,
        meta: byMeta ?? undefined,
      });
    }
  }
  history.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const cardCls =
    "overflow-hidden rounded-card border border-brand-line bg-white shadow-card";
  const eyebrow =
    "text-[10px] font-bold uppercase tracking-[0.1em] text-brand-mute";

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-[12.5px]">
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center gap-1.5 text-brand-mute hover:text-brand-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All payments
        </Link>
        <ChevronRight className="h-3 w-3 text-brand-line" />
        <span className="font-mono font-semibold text-brand-ink">
          {booking.reference}
        </span>
      </div>

      {/* ===== HEADER CARD ===== */}
      <section className={cardCls}>
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-7">
          <div className="min-w-0">
            <div className={eyebrow}>
              {isCaptured ? "Payment received" : "Payment"}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
              <h1 className="font-display text-[38px] font-extrabold leading-none tracking-tight text-brand-ink lg:text-[44px]">
                {formatMoney(Number(payment.amount), ccy)}
              </h1>
              <span
                className={`mb-1 inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ${st.tone}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{" "}
                {st.label}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-brand-mute">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {booking.guest_name ?? "Guest"}
              </span>
              <span className="h-1 w-1 rounded-full bg-brand-line" />
              <span className="inline-flex items-center gap-1.5">
                <MethodIcon className="h-3.5 w-3.5" /> {method.label}
              </span>
              <span className="h-1 w-1 rounded-full bg-brand-line" />
              <span>{fmtDt(payment.captured_at ?? payment.created_at)}</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {invoiceRow?.hosted_token ? (
              <Link
                href={`/invoice/${invoiceRow.hosted_token}/pdf`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-secondary px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-ink"
              >
                <Download className="h-4 w-4" /> Receipt
              </Link>
            ) : null}
            <Link
              href={`/dashboard/bookings/${booking.id}`}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light/60"
            >
              <Calendar className="h-4 w-4" /> Booking
            </Link>
          </div>
        </div>

        {/* key facts strip */}
        <div className="grid grid-cols-2 divide-x divide-brand-line border-t border-brand-line sm:grid-cols-4">
          <Fact
            label="Reference"
            mono
            value={payment.provider_reference ?? booking.reference}
          />
          <Fact label="Method" value={method.label.split(" · ")[0]} />
          <Fact label="Booking" value={booking.status.replace(/_/g, " ")} />
          <Fact
            label={refundedTotal > 0 ? "Net of refunds" : "Net to you"}
            value={formatMoney(Number(payment.amount) - refundedTotal, ccy)}
            strong
          />
        </div>

        {/* Booking settlement ribbon — is anything still outstanding? */}
        {bookingClosed ? (
          <div className="bg-status-confirmed/8 flex items-center gap-2 border-t border-brand-line px-6 py-3 text-[12.5px] font-semibold text-status-confirmed">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Closed &amp; handled —
            nothing outstanding on this booking.
          </div>
        ) : hasOpenRefund ? (
          <div className="flex items-center gap-2 border-t border-brand-line bg-indigo-50 px-6 py-3 text-[12.5px] font-semibold text-indigo-700">
            <RotateCcw className="h-4 w-4 shrink-0" /> A refund is in progress
            on this booking.
          </div>
        ) : stillToCollect ? (
          <div className="flex items-center gap-2 border-t border-brand-line bg-status-pending/10 px-6 py-3 text-[12.5px] font-semibold text-amber-700">
            <Info className="h-4 w-4 shrink-0" />{" "}
            {formatMoney(bookingBalanceDue, ccy)} still to collect on this
            booking.
          </div>
        ) : null}
      </section>

      {/* ===== TWO-COLUMN GRID ===== */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_350px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-6">
          {/* Money story */}
          <section className={cardCls}>
            <div className="flex items-center justify-between border-b border-brand-line px-6 py-4">
              <div>
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  Where the money went
                </div>
                <div className="mt-0.5 text-[12px] text-brand-mute">
                  What {booking.guest_name?.split(" ")[0] ?? "the guest"} paid
                  for this booking
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent/50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-secondary">
                <Banknote className="h-3.5 w-3.5" /> {ccy}
              </span>
            </div>
            <div className="p-6">
              <ul className="space-y-3 text-[13px]">
                {paidLines.map((l, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-brand-mute">{l.label}</span>
                    <span
                      className={`font-medium ${l.amount < 0 ? "text-brand-primary" : "text-brand-ink"}`}
                    >
                      {l.amount < 0 ? "−" : ""}
                      {formatMoney(Math.abs(l.amount), ccy)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between border-t border-dashed border-brand-line pt-3">
                  <span className="font-semibold text-brand-ink">
                    {isCaptured ? "Gross captured" : "Total"}
                  </span>
                  <span className="font-display text-[18px] font-bold text-brand-ink">
                    {formatMoney(Number(booking.total_amount), ccy)}
                  </span>
                </li>
                {refundedTotal > 0 ? (
                  <li className="flex items-center justify-between">
                    <span className="text-status-cancelled">Refunded</span>
                    <span className="font-medium text-status-cancelled">
                      −{formatMoney(refundedTotal, ccy)}
                    </span>
                  </li>
                ) : null}
                {stillToCollect ? (
                  <li className="flex items-center justify-between rounded-[10px] bg-status-pending/10 px-3 py-2">
                    <span className="font-semibold text-amber-700">
                      Balance still due
                    </span>
                    <span className="font-semibold text-amber-700">
                      {formatMoney(bookingBalanceDue, ccy)}
                    </span>
                  </li>
                ) : isWrittenOff && bookingBalanceDue > 0 ? (
                  <li className="flex items-center justify-between rounded-[10px] bg-brand-light px-3 py-2">
                    <span className="font-semibold text-brand-mute">
                      Written off (booking {booking.status.replace(/_/g, " ")})
                    </span>
                    <span className="font-semibold text-brand-mute">
                      {formatMoney(bookingBalanceDue, ccy)}
                    </span>
                  </li>
                ) : null}
              </ul>
              <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-brand-light px-3 py-2 text-[11.5px] text-brand-mute">
                <Info className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                {brandName} takes no commission — you keep the full amount. Card
                processing fees (if any) are deducted by the provider at payout.
              </div>
            </div>
          </section>

          {/* Transaction details */}
          <section className={cardCls}>
            <div className="border-b border-brand-line px-6 py-4 font-display text-[15px] font-bold text-brand-ink">
              Transaction details
            </div>
            <div className="grid grid-cols-1 gap-x-10 p-6 sm:grid-cols-2">
              <Detail
                label="Processor"
                value={method.label.split(" · ").pop() ?? method.label}
              />
              <Detail label="Method" value={method.label.split(" · ")[0]} />
              <Detail
                label="Reference"
                mono
                value={payment.provider_reference ?? "—"}
              />
              <Detail label="Status" value={st.label} />
              {recordedByName ? (
                <Detail label="Authorised by" value={recordedByName} />
              ) : null}
              <Detail label="Initiated" value={fmtDt(payment.created_at)} />
              <Detail label="Authorised" value={fmtDt(payment.authorised_at)} />
              <Detail
                label="Captured / received"
                value={fmtDt(payment.captured_at)}
                last
              />
              {payment.failed_at ? (
                <Detail label="Failed" value={fmtDt(payment.failed_at)} last />
              ) : null}
            </div>
            {payment.eft_proof_url ? (
              <div className="border-t border-brand-line px-6 py-4">
                <a
                  href={payment.eft_proof_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 text-[13px] font-medium text-brand-primary hover:underline"
                >
                  <FileText className="h-4 w-4" /> View proof of payment
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : null}
          </section>

          {/* Timeline */}
          <section className={cardCls}>
            <div className="border-b border-brand-line px-6 py-4">
              <div className="font-display text-[15px] font-bold text-brand-ink">
                Payment timeline
              </div>
              <div className="mt-0.5 text-[12px] text-brand-mute">
                Every financial event on this booking, newest first.
              </div>
            </div>
            <div className="p-6">
              <ol className="relative space-y-4 border-l-2 border-brand-line pl-5">
                {history.map((e, i) => {
                  const tone = EV_TONE[e.tone] ?? EV_TONE.slate;
                  return (
                    <li key={i}>
                      <span
                        className={`absolute -left-[7px] mt-0.5 h-3 w-3 rounded-full border-2 border-white ${tone.dot}`}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-brand-ink">
                            {e.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-brand-mute">
                            <span
                              className={`rounded-pill px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${tone.tag}`}
                            >
                              {e.kind}
                            </span>
                            {e.meta ? (
                              <span className="max-w-[240px] truncate">
                                {e.meta}
                              </span>
                            ) : null}
                            <span className="text-brand-line">·</span>
                            <span>{fmtDt(e.at)}</span>
                          </div>
                        </div>
                        {typeof e.amount === "number" ? (
                          <div
                            className={`shrink-0 font-display text-[13px] font-bold ${
                              e.flow === "in"
                                ? "text-status-confirmed"
                                : e.flow === "out"
                                  ? "text-status-cancelled"
                                  : "text-brand-ink"
                            }`}
                          >
                            {e.flow === "out"
                              ? "−"
                              : e.flow === "in"
                                ? "+"
                                : ""}
                            {m(Math.abs(e.amount))}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
                {history.length === 0 ? (
                  <li className="text-sm text-brand-mute">No events yet.</li>
                ) : null}
              </ol>
            </div>
          </section>
        </div>

        {/* RIGHT RAIL */}
        <div className="space-y-6">
          <div className="space-y-6 xl:sticky xl:top-[88px]">
            {/* EFT manage (when applicable) */}
            {canManage ? (
              <section className={cardCls}>
                <div className="border-b border-brand-line px-5 py-3.5">
                  <div className={eyebrow}>Confirm this EFT</div>
                </div>
                <div className="p-5">
                  <p className="mb-3 text-[12.5px] text-brand-mute">
                    Mark as received once the transfer lands, or reject it.
                  </p>
                  <PaymentManage paymentId={payment.id} />
                </div>
              </section>
            ) : null}

            {/* Linked booking */}
            <section className={cardCls}>
              <div className="border-b border-brand-line px-5 py-3.5">
                <div className={eyebrow}>Linked booking</div>
              </div>
              <Link
                href={`/dashboard/bookings/${booking.id}`}
                className="flex items-center gap-3 px-5 py-4 transition hover:bg-brand-light/60"
              >
                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-brand-mute">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-brand-ink">
                    {listing?.name ?? "Listing"}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-brand-mute">
                    {booking.session_date
                      ? fmtDt(booking.session_date)
                      : `${fmtDay(booking.check_in)} → ${fmtDay(booking.check_out)}`}
                    {booking.nights
                      ? ` · ${booking.nights} night${booking.nights === 1 ? "" : "s"}`
                      : ""}
                  </div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-brand-mute">
                    {booking.reference}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
              </Link>
              <div className="flex items-center gap-3 border-t border-brand-line px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[12px] font-bold text-white">
                  {initials(booking.guest_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-brand-ink">
                    {booking.guest_name ?? "Guest"}
                  </div>
                  <div className="truncate text-[11px] text-brand-mute">
                    {booking.guest_email ?? "—"}
                  </div>
                </div>
              </div>
            </section>

            {/* Related documents */}
            {(invoiceRows?.length ?? 0) +
              (quoteRows?.length ?? 0) +
              (creditNoteRows?.length ?? 0) +
              (refundRows?.length ?? 0) >
            0 ? (
              <section className={cardCls}>
                <div className="border-b border-brand-line px-5 py-3.5">
                  <div className={eyebrow}>Related documents</div>
                </div>
                <div className="divide-y divide-brand-line">
                  {(quoteRows ?? []).map((q) => (
                    <DocLink
                      key={q.id}
                      icon={FileText}
                      kind="Quote"
                      title={q.quote_number}
                      href={`/dashboard/quotes/${q.id}`}
                    />
                  ))}
                  {(invoiceRows ?? []).map((inv) => (
                    <DocLink
                      key={inv.id}
                      icon={Receipt}
                      kind="Invoice"
                      title={inv.invoice_number}
                      href={`/dashboard/invoices/${inv.id}`}
                    />
                  ))}
                  {(creditNoteRows ?? []).map((cn) => (
                    <DocLink
                      key={cn.id}
                      icon={FileMinus}
                      kind="Credit note"
                      title={cn.credit_note_number}
                      href={`/dashboard/credit-notes/${cn.id}`}
                    />
                  ))}
                  {(refundRows ?? []).map((r) => (
                    <DocLink
                      key={r.id}
                      icon={RotateCcw}
                      kind="Refund"
                      title={
                        r.reference ??
                        formatMoney(
                          Number(r.approved_amount ?? r.requested_amount),
                          ccy,
                        )
                      }
                      href="/dashboard/refunds"
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Refunds */}
            <section className={cardCls}>
              <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
                <div className={eyebrow}>Refunds</div>
                {refundedTotal > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                    {formatMoney(refundedTotal, ccy)} refunded
                  </span>
                ) : hasOpenRefund ? (
                  <span className="bg-status-pending/12 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    <RotateCcw className="h-3 w-3" /> In progress
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10px] font-semibold text-status-confirmed">
                    <ShieldCheck className="h-3 w-3" /> None
                  </span>
                )}
              </div>
              <div className="p-5">
                <p className="text-[12.5px] text-brand-mute">
                  {isCaptured
                    ? `${formatMoney(Number(payment.amount), ccy)} captured.`
                    : "This payment isn't captured yet."}{" "}
                  Issue a refund from the booking.
                </p>
                <Link
                  href={`/dashboard/bookings/${booking.id}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-line px-3 py-2 text-[12.5px] font-medium text-brand-ink transition hover:bg-brand-light"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Manage refunds
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="px-6 py-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-mute">
        {label}
      </div>
      <div
        className={`mt-1 truncate text-[13px] capitalize ${strong ? "font-bold text-brand-ink" : "font-semibold text-brand-ink"} ${mono ? "font-mono text-[12.5px] normal-case" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-dashed border-brand-line py-3 ${last ? "" : "border-b"}`}
    >
      <span className="text-[12.5px] text-brand-mute">{label}</span>
      <span
        className={`text-[13px] font-semibold text-brand-ink ${mono ? "font-mono text-[12.5px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function DocLink({
  icon: Icon,
  kind,
  title,
  href,
}: {
  icon: typeof FileText;
  kind: string;
  title: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-3 transition hover:bg-brand-light/50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-brand-accent text-brand-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          {kind}
        </span>
        <span className="block truncate text-[12.5px] font-medium text-brand-ink">
          {title}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
    </Link>
  );
}
