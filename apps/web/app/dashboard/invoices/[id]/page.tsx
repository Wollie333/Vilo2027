import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Download, ExternalLink } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "../../quotes/schemas";

import { CreateCreditNote } from "./CreateCreditNote";
import { InvoiceActions } from "./InvoiceActions";

export const metadata: Metadata = {
  title: "Invoice",
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<InvoiceStatus, string> = {
  draft: "bg-brand-line text-brand-mute",
  issued: "bg-status-pending/15 text-status-pending",
  paid: "bg-status-confirmed/15 text-status-confirmed",
  cancelled: "bg-status-cancelled/15 text-status-cancelled",
};

function fmt(amount: number, currency = "ZAR"): string {
  const symbol = currency === "ZAR" ? "R" : currency + " ";
  return `${symbol} ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

type InvoiceLines = {
  listing_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  scope: string;
  base_amount: number;
  cleaning_fee: number;
  rooms: { room_name: string; base_amount: number; cleaning_fee: number }[];
  addons: {
    label: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
};

type Snap = {
  display_name?: string;
  handle?: string;
  email?: string;
  phone?: string;
};
type GuestSnap = { name?: string; email?: string; phone?: string };

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/invoices/${params.id}`);

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, issued_at, paid_at, total_amount, subtotal, vat_amount, currency, host_snapshot, guest_snapshot, line_items, booking_id, hosted_token, pdf_storage_path",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!invoice) notFound();

  // Credit notes raised against this invoice (auto from refunds + manual).
  const { data: creditNotes } = await supabase
    .from("credit_notes")
    .select(
      "id, credit_note_number, status, origin, total_amount, currency, issued_at",
    )
    .eq("invoice_id", invoice.id)
    .order("issued_at", { ascending: false });

  // The bound payment, for a quick cross-link.
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("id")
    .eq("booking_id", invoice.booking_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lines = invoice.line_items as InvoiceLines;
  const host = invoice.host_snapshot as Snap;
  const guest = invoice.guest_snapshot as GuestSnap;
  const status = invoice.status as InvoiceStatus;

  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const hostedUrl = `${proto}://${baseHost}/invoice/${invoice.hosted_token}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Invoice
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            {invoice.invoice_number}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status]}`}
            >
              {INVOICE_STATUS_LABEL[status]}
            </span>
            <span className="text-xs text-brand-mute">
              Issued {new Date(invoice.issued_at).toLocaleDateString("en-ZA")}
            </span>
            {invoice.paid_at ? (
              <span className="text-xs text-brand-mute">
                · Paid {new Date(invoice.paid_at).toLocaleDateString("en-ZA")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/invoice/${invoice.hosted_token}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Link>
          <Link
            href={`/dashboard/bookings/${invoice.booking_id}`}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
          >
            View booking
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {paymentRow ? (
            <Link
              href={`/dashboard/payments/${paymentRow.id}`}
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
            >
              View payment
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
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
            Billed to
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
          Stay
        </h2>
        <div className="mt-2 grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-brand-mute">
              Listing
            </div>
            <div className="font-medium text-brand-ink">
              {lines.listing_name ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-brand-mute">
              Check-in
            </div>
            <div className="font-medium text-brand-ink">
              {lines.check_in ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-brand-mute">
              Check-out
            </div>
            <div className="font-medium text-brand-ink">
              {lines.check_out ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-brand-mute">
              Nights
            </div>
            <div className="font-medium text-brand-ink">
              {lines.nights ?? "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Line items
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-brand-mute">
            <tr>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {lines.scope === "rooms" && lines.rooms?.length > 0 ? (
              lines.rooms.map((r, i) => (
                <tr key={`room-${i}`}>
                  <td className="py-2 text-brand-ink">
                    {lines.listing_name} — {r.room_name}
                  </td>
                  <td className="py-2 text-right text-brand-mute">1</td>
                  <td className="py-2 text-right text-brand-mute">
                    {fmt(r.base_amount, invoice.currency)}
                  </td>
                  <td className="py-2 text-right font-medium text-brand-ink">
                    {fmt(r.base_amount, invoice.currency)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-2 text-brand-ink">
                  {lines.listing_name ?? "Stay"} — base
                </td>
                <td className="py-2 text-right text-brand-mute">1</td>
                <td className="py-2 text-right text-brand-mute">
                  {fmt(lines.base_amount, invoice.currency)}
                </td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {fmt(lines.base_amount, invoice.currency)}
                </td>
              </tr>
            )}
            {lines.cleaning_fee > 0 ? (
              <tr>
                <td className="py-2 text-brand-ink">Cleaning</td>
                <td className="py-2 text-right text-brand-mute">1</td>
                <td className="py-2 text-right text-brand-mute">
                  {fmt(lines.cleaning_fee, invoice.currency)}
                </td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {fmt(lines.cleaning_fee, invoice.currency)}
                </td>
              </tr>
            ) : null}
            {(lines.addons ?? []).map((a, i) => (
              <tr key={`addon-${i}`}>
                <td className="py-2 text-brand-ink">{a.label}</td>
                <td className="py-2 text-right text-brand-mute">
                  {a.quantity}
                </td>
                <td className="py-2 text-right text-brand-mute">
                  {fmt(a.unit_price, invoice.currency)}
                </td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {fmt(a.subtotal, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right text-brand-mute">
                Subtotal
              </td>
              <td className="pt-3 text-right text-brand-ink">
                {fmt(invoice.subtotal, invoice.currency)}
              </td>
            </tr>
            {invoice.vat_amount > 0 ? (
              <tr>
                <td colSpan={3} className="pt-1 text-right text-brand-mute">
                  VAT
                </td>
                <td className="pt-1 text-right text-brand-ink">
                  {fmt(invoice.vat_amount, invoice.currency)}
                </td>
              </tr>
            ) : null}
            <tr>
              <td
                colSpan={3}
                className="pt-3 text-right font-display text-base font-bold text-brand-ink"
              >
                Total
              </td>
              <td className="pt-3 text-right font-display text-lg font-bold text-brand-primary">
                {fmt(invoice.total_amount, invoice.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Share with guest
        </h2>
        <p className="mt-1 text-xs text-brand-mute">
          Guests can view this URL without an account. It links to the same PDF
          download.
        </p>
        <code className="mt-3 block overflow-x-auto rounded border border-brand-line bg-brand-light/40 px-3 py-2 font-mono text-[11px] text-brand-ink">
          {hostedUrl}
        </code>
      </section>

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-brand-ink">
              Credit notes
            </h2>
            <p className="mt-1 text-xs text-brand-mute">
              Money credited back against this invoice. Refunds create these
              automatically; you can also raise one manually.
            </p>
          </div>
          <CreateCreditNote
            invoiceId={invoice.id}
            invoiceTotal={invoice.total_amount}
            currency={invoice.currency}
          />
        </div>

        {creditNotes && creditNotes.length > 0 ? (
          <ul className="mt-4 divide-y divide-brand-line">
            {creditNotes.map((cn) => (
              <li
                key={cn.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <Link
                    href={`/dashboard/credit-notes/${cn.id}`}
                    className="font-medium text-brand-primary hover:underline"
                  >
                    {cn.credit_note_number}
                  </Link>
                  <span className="ml-2 text-xs text-brand-mute">
                    {cn.origin === "refund_auto" ? "Refund" : "Manual"} ·{" "}
                    {new Date(cn.issued_at).toLocaleDateString("en-ZA")}
                    {cn.status === "cancelled" ? " · cancelled" : ""}
                  </span>
                </div>
                <span className="font-medium text-brand-ink">
                  {fmt(cn.total_amount, cn.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-brand-mute">
            No credit notes raised against this invoice yet.
          </p>
        )}
      </section>

      <InvoiceActions invoiceId={invoice.id} status={status} />
    </div>
  );
}
