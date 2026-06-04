import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ExternalLink } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import {
  CREDIT_NOTE_STATUS_LABEL,
  type CreditNoteStatus,
} from "../../quotes/schemas";

import { CreditNoteActions } from "./CreditNoteActions";

export const metadata: Metadata = {
  title: "Credit note",
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<CreditNoteStatus, string> = {
  draft: "bg-brand-line text-brand-mute",
  issued: "bg-status-confirmed/15 text-status-confirmed",
  cancelled: "bg-status-cancelled/15 text-status-cancelled",
};

function fmt(amount: number, currency = "ZAR"): string {
  const symbol = currency === "ZAR" ? "R" : currency + " ";
  return `${symbol} ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

type Snap = {
  display_name?: string;
  handle?: string;
  email?: string;
  phone?: string;
};
type GuestSnap = { name?: string; email?: string; phone?: string };
type Line = { label: string; amount: number };

export default async function CreditNoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/credit-notes/${params.id}`);

  const { data: cn } = await supabase
    .from("credit_notes")
    .select(
      "id, credit_note_number, status, origin, issued_at, cancelled_at, subtotal, vat_amount, total_amount, currency, reason, host_snapshot, guest_snapshot, line_items, invoice_id, booking_id, hosted_token",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!cn) notFound();

  const host = cn.host_snapshot as Snap;
  const guest = cn.guest_snapshot as GuestSnap;
  const status = cn.status as CreditNoteStatus;
  const lines = (cn.line_items as Line[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Credit note
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            {cn.credit_note_number}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status]}`}
            >
              {CREDIT_NOTE_STATUS_LABEL[status]}
            </span>
            <span className="text-xs text-brand-mute">
              {cn.origin === "refund_auto"
                ? "From a completed refund"
                : "Issued manually"}
            </span>
            <span className="text-xs text-brand-mute">
              · Issued {new Date(cn.issued_at).toLocaleDateString("en-ZA")}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/credit-note/${cn.hosted_token}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            Download PDF
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/credit-note/${cn.hosted_token}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
          >
            Share link
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/dashboard/invoices/${cn.invoice_id}`}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
          >
            View invoice
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/dashboard/bookings/${cn.booking_id}`}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
          >
            View booking
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            From
          </div>
          <div className="mt-1 font-medium text-brand-ink">
            {host.display_name ?? "—"}
          </div>
          {host.handle ? (
            <div className="text-xs text-brand-mute">@{host.handle}</div>
          ) : null}
          {host.email ? (
            <div className="text-xs text-brand-mute">{host.email}</div>
          ) : null}
        </div>
        <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Credited to
          </div>
          <div className="mt-1 font-medium text-brand-ink">
            {guest.name ?? "—"}
          </div>
          {guest.email ? (
            <div className="text-xs text-brand-mute">{guest.email}</div>
          ) : null}
          {guest.phone ? (
            <div className="text-xs text-brand-mute">{guest.phone}</div>
          ) : null}
        </div>
      </div>

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Credited items
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-brand-mute">
            <tr>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {lines.length === 0 ? (
              <tr>
                <td className="py-2 text-brand-ink">{cn.reason ?? "Credit"}</td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {fmt(cn.total_amount, cn.currency)}
                </td>
              </tr>
            ) : (
              lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-2 text-brand-ink">{l.label}</td>
                  <td className="py-2 text-right font-medium text-brand-ink">
                    {fmt(l.amount, cn.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 text-right text-brand-mute">Subtotal</td>
              <td className="pt-3 text-right text-brand-ink">
                {fmt(cn.subtotal, cn.currency)}
              </td>
            </tr>
            {cn.vat_amount > 0 ? (
              <tr>
                <td className="pt-1 text-right text-brand-mute">VAT</td>
                <td className="pt-1 text-right text-brand-ink">
                  {fmt(cn.vat_amount, cn.currency)}
                </td>
              </tr>
            ) : null}
            <tr>
              <td className="pt-3 text-right font-display text-base font-bold text-brand-ink">
                Total credited
              </td>
              <td className="pt-3 text-right font-display text-lg font-bold text-brand-primary">
                {fmt(cn.total_amount, cn.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <CreditNoteActions creditNoteId={cn.id} status={status} />
    </div>
  );
}
