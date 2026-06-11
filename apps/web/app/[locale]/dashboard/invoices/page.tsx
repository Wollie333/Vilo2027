import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

import { notFound } from "next/navigation";

import { getMyHostId } from "@/lib/host/current";
import { throwOnError } from "@/lib/supabase/query";
import { createServerClient } from "@/lib/supabase/server";

import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "../quotes/schemas";

export const metadata: Metadata = {
  title: "Invoices",
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<InvoiceStatus, string> = {
  draft: "bg-brand-line text-brand-mute",
  issued: "bg-status-pending/15 text-status-pending",
  paid: "bg-status-confirmed/15 text-status-confirmed",
  cancelled: "bg-status-cancelled/15 text-status-cancelled",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const supabase = createServerClient();
  const myHostId = await getMyHostId(supabase);
  if (!myHostId) notFound();
  const q = (searchParams?.q ?? "").trim();
  const status = (searchParams?.status ?? "").trim();

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, issued_at, total_amount, currency, booking_id, guest_snapshot",
    )
    .eq("host_id", myHostId)
    .order("issued_at", { ascending: false });

  if (q.length > 0) {
    query = query.ilike("invoice_number", `%${q}%`);
  }
  if (status.length > 0) {
    query = query.eq("status", status);
  }

  const invoices = await throwOnError(query, "dashboard/invoices");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          One invoice per confirmed booking. Auto-created when the booking
          lands. Download or share via the hosted URL.
        </p>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-center gap-3 rounded-card border border-brand-line bg-white p-3 shadow-card"
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by invoice number"
          className="min-w-[260px] flex-1 rounded border border-brand-line px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm"
        >
          <option value="">Any status</option>
          {Object.entries(INVOICE_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded border border-brand-line bg-brand-light px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
        >
          Apply
        </button>
      </form>

      {!invoices || invoices.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No invoices yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Invoices appear here the moment a booking transitions to confirmed.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-brand-light/60 text-left text-[11px] uppercase tracking-wider text-brand-mute">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {invoices.map((inv) => {
                const tone = STATUS_TONE[inv.status as InvoiceStatus];
                const guest = inv.guest_snapshot as {
                  name?: string;
                  email?: string;
                } | null;
                return (
                  <tr key={inv.id} className="hover:bg-brand-light/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/invoices/${inv.id}`}
                        className="font-medium text-brand-primary hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-brand-ink">
                        {guest?.name ?? "—"}
                      </div>
                      <div className="text-xs text-brand-mute">
                        {guest?.email ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-mute">
                      {new Date(inv.issued_at).toLocaleDateString("en-ZA")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-brand-ink">
                      {inv.currency}{" "}
                      {Math.round(inv.total_amount)
                        .toLocaleString("en-ZA")
                        .replace(/,/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}
                      >
                        {INVOICE_STATUS_LABEL[inv.status as InvoiceStatus]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
