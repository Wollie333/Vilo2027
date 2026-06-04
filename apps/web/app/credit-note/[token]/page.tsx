import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Download } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Credit note",
};

export const dynamic = "force-dynamic";

type HostSnap = {
  display_name?: string;
  handle?: string;
  email?: string;
  business?: {
    trading_name?: string | null;
    legal_name?: string | null;
  } | null;
};
type GuestSnap = { name?: string; email?: string };
type CnLine = { label: string; amount: number | string };

export default async function PublicCreditNotePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createAdminClient();
  const { data: cn } = await supabase
    .from("credit_notes")
    .select(
      "credit_note_number, status, issued_at, currency, total_amount, reason, host_snapshot, guest_snapshot, line_items, hosted_token, invoice:invoices!inner ( invoice_number )",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!cn) notFound();

  const host = cn.host_snapshot as HostSnap;
  const guest = cn.guest_snapshot as GuestSnap;
  const lines = (cn.line_items as CnLine[]) ?? [];
  const businessName =
    host.business?.trading_name ??
    host.business?.legal_name ??
    host.display_name ??
    "—";
  const invoiceNumber =
    (cn.invoice as unknown as { invoice_number?: string } | null)
      ?.invoice_number ?? null;

  return (
    <div className="min-h-screen bg-brand-light px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-rose-600 text-2xl font-bold text-white">
              {(businessName[0] ?? "V").toUpperCase()}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                Credit note
              </div>
              <div className="font-display text-xl font-bold text-brand-ink">
                {cn.credit_note_number}
              </div>
            </div>
          </div>
          <Link
            href={`/credit-note/${cn.hosted_token}/pdf`}
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
                {businessName}
              </div>
              {host.email ? (
                <div className="text-xs text-brand-mute">{host.email}</div>
              ) : null}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                Credited to
              </div>
              <div className="mt-1 font-medium text-brand-ink">
                {guest.name ?? "—"}
              </div>
              {guest.email ? (
                <div className="text-xs text-brand-mute">{guest.email}</div>
              ) : null}
            </div>
          </div>

          {invoiceNumber ? (
            <p className="mt-4 text-xs text-brand-mute">
              Against invoice{" "}
              <span className="font-mono text-brand-dark">{invoiceNumber}</span>
            </p>
          ) : null}

          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-brand-line">
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-2 text-brand-ink">{l.label}</td>
                  <td className="py-2 text-right font-medium text-rose-700">
                    − {formatMoney(Number(l.amount), cn.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 font-display text-base font-bold text-brand-ink">
                  Total credited
                </td>
                <td className="pt-3 text-right font-display text-lg font-bold text-rose-700">
                  − {formatMoney(Number(cn.total_amount), cn.currency)}
                </td>
              </tr>
            </tfoot>
          </table>

          {cn.reason ? (
            <div className="mt-4 rounded border border-brand-line bg-brand-light/40 px-3 py-2 text-[12.5px] text-brand-dark">
              <span className="font-semibold">Reason:</span> {cn.reason}
            </div>
          ) : null}
        </div>

        <p className="text-center text-[11px] text-brand-mute">
          Generated by Vilo · viloplatform.com
        </p>
      </div>
    </div>
  );
}
