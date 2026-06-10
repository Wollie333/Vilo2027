import type { Metadata } from "next";
import Link from "next/link";

import { notFound } from "next/navigation";

import { formatMoney } from "@/lib/format";
import { getMyHostId } from "@/lib/host/current";
import { throwOnError } from "@/lib/supabase/query";
import { createServerClient } from "@/lib/supabase/server";

import {
  CREDIT_NOTE_STATUS_LABEL,
  type CreditNoteStatus,
} from "../quotes/schemas";

export const metadata: Metadata = {
  title: "Credit notes",
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<CreditNoteStatus, string> = {
  draft: "bg-brand-line text-brand-mute",
  issued: "bg-status-confirmed/15 text-status-confirmed",
  cancelled: "bg-status-cancelled/15 text-status-cancelled",
};

export default async function CreditNotesPage({
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
    .from("credit_notes")
    .select(
      "id, credit_note_number, status, origin, issued_at, total_amount, currency, invoice_id, guest_snapshot",
    )
    .eq("host_id", myHostId)
    .order("issued_at", { ascending: false });

  if (q.length > 0) query = query.ilike("credit_note_number", `%${q}%`);
  if (status.length > 0) query = query.eq("status", status);

  const notes = await throwOnError(query, "dashboard/credit-notes");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Credit notes
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Money credited back to a guest against an invoice. Auto-created when a
          refund completes, or issued manually from an invoice.
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
          placeholder="Search by credit-note number"
          className="min-w-[260px] flex-1 rounded border border-brand-line px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm"
        >
          <option value="">Any status</option>
          {Object.entries(CREDIT_NOTE_STATUS_LABEL).map(([v, l]) => (
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

      {!notes || notes.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No credit notes yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Credit notes appear here when a refund completes, or when you create
            one from an invoice.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-brand-light/60 text-left text-[11px] uppercase tracking-wider text-brand-mute">
              <tr>
                <th className="px-4 py-3">Credit note</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {notes.map((cn) => {
                const tone = STATUS_TONE[cn.status as CreditNoteStatus];
                const guest = cn.guest_snapshot as {
                  name?: string;
                  email?: string;
                } | null;
                return (
                  <tr key={cn.id} className="hover:bg-brand-light/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/credit-notes/${cn.id}`}
                        className="font-medium text-brand-primary hover:underline"
                      >
                        {cn.credit_note_number}
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
                      {cn.origin === "refund_auto" ? "Refund" : "Manual"}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-mute">
                      {new Date(cn.issued_at).toLocaleDateString("en-ZA")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-brand-ink">
                      {formatMoney(cn.total_amount, cn.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}
                      >
                        {
                          CREDIT_NOTE_STATUS_LABEL[
                            cn.status as CreditNoteStatus
                          ]
                        }
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
