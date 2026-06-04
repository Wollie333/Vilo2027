import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Download } from "lucide-react";

import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  INVOICE_STATUS_LABEL,
  type InvoiceStatus,
} from "../../dashboard/quotes/schemas";

export const metadata: Metadata = {
  title: "Invoice",
};

export const dynamic = "force-dynamic";

type Lines = {
  listing_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  scope: string;
  base_amount: number;
  cleaning_fee: number;
  discount_amount?: number;
  rooms: { room_name: string; base_amount: number; cleaning_fee: number }[];
  addons: {
    label: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
};
type HostSnap = { display_name?: string; handle?: string; email?: string };
type GuestSnap = { name?: string; email?: string };

export default async function PublicInvoicePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, issued_at, paid_at, total_amount, subtotal, vat_amount, currency, host_snapshot, guest_snapshot, line_items, hosted_token",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!invoice) notFound();

  const lines = invoice.line_items as Lines;
  const host = invoice.host_snapshot as HostSnap;
  const guest = invoice.guest_snapshot as GuestSnap;
  const status = invoice.status as InvoiceStatus;
  const brandName = await getBrandName();

  return (
    <div className="min-h-screen bg-brand-light px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-brand-primary text-2xl font-bold text-white">
              {brandName[0]?.toUpperCase() ?? "V"}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                Invoice
              </div>
              <div className="font-display text-xl font-bold text-brand-ink">
                {invoice.invoice_number}
              </div>
            </div>
          </div>
          <Link
            href={`/invoice/${invoice.hosted_token}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Link>
        </header>

        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-brand-mute">
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
            <div>
              <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                Billed to
              </div>
              <div className="mt-1 font-medium text-brand-ink">
                {guest.name ?? "—"}
              </div>
              {guest.email ? (
                <div className="text-xs text-brand-mute">{guest.email}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-brand-ink">
              Stay summary
            </h2>
            <span className="rounded-full bg-brand-accent px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
              {INVOICE_STATUS_LABEL[status]}
            </span>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <Box label="Listing" value={lines.listing_name ?? "—"} />
            <Box label="Check-in" value={lines.check_in ?? "—"} />
            <Box label="Check-out" value={lines.check_out ?? "—"} />
            <Box label="Nights" value={String(lines.nights ?? "—")} />
          </div>
        </div>

        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-brand-ink">
            Line items
          </h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-brand-line">
              <tr>
                <td className="py-2 text-brand-ink">Stay — base</td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {formatMoney(lines.base_amount, invoice.currency)}
                </td>
              </tr>
              {lines.cleaning_fee > 0 ? (
                <tr>
                  <td className="py-2 text-brand-ink">Cleaning</td>
                  <td className="py-2 text-right font-medium text-brand-ink">
                    {formatMoney(lines.cleaning_fee, invoice.currency)}
                  </td>
                </tr>
              ) : null}
              {(lines.addons ?? []).map((a, i) => (
                <tr key={i}>
                  <td className="py-2 text-brand-ink">
                    {a.label}
                    <span className="ml-1 text-brand-mute">× {a.quantity}</span>
                  </td>
                  <td className="py-2 text-right font-medium text-brand-ink">
                    {formatMoney(a.subtotal, invoice.currency)}
                  </td>
                </tr>
              ))}
              {lines.discount_amount && lines.discount_amount > 0 ? (
                <tr>
                  <td className="py-2 text-emerald-700">Discount</td>
                  <td className="py-2 text-right font-medium text-emerald-700">
                    − {formatMoney(lines.discount_amount, invoice.currency)}
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 font-display text-base font-bold text-brand-ink">
                  Total
                </td>
                <td className="pt-3 text-right font-display text-lg font-bold text-brand-primary">
                  {formatMoney(invoice.total_amount, invoice.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-center text-[11px] text-brand-mute">
          Issued via{" "}
          <span className="font-semibold text-brand-primary">{brandName}</span>
        </p>
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="mt-0.5 font-medium text-brand-ink">{value}</div>
    </div>
  );
}
