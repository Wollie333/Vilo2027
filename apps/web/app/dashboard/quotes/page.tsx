import type { Metadata } from "next";
import Link from "next/link";

import { Plus } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { QUOTE_STATUS_LABEL, type QuoteStatus } from "./schemas";

export const metadata: Metadata = {
  title: "Quotes",
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<QuoteStatus, string> = {
  draft: "bg-brand-line text-brand-mute",
  sent: "bg-status-pending/15 text-status-pending",
  accepted: "bg-status-confirmed/15 text-status-confirmed",
  declined: "bg-status-cancelled/15 text-status-cancelled",
  expired: "bg-status-draft/15 text-status-draft",
  converted: "bg-brand-accent text-brand-primary",
};

export default async function QuotesListPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const supabase = createServerClient();

  const q = (searchParams?.q ?? "").trim();
  const status = (searchParams?.status ?? "").trim();

  let query = supabase
    .from("quotes")
    .select(
      "id, quote_number, guest_name, guest_email, check_in, check_out, total_amount, currency, status, created_at, listing:listings ( name )",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (q.length > 0) {
    // Search across quote_number, guest_name, guest_email.
    query = query.or(
      [
        `quote_number.ilike.%${q}%`,
        `guest_name.ilike.%${q}%`,
        `guest_email.ilike.%${q}%`,
      ].join(","),
    );
  }
  if (status.length > 0) {
    query = query.eq("status", status);
  }

  const { data: quotes } = await query;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Quotes
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Send a prospect a quote. Accepted quotes become bookings with an
            invoice attached.
          </p>
        </div>
        <Link
          href="/dashboard/quotes/new"
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" />
          New quote
        </Link>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-center gap-3 rounded-card border border-brand-line bg-white p-3 shadow-card"
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by number, guest name or email"
          className="min-w-[260px] flex-1 rounded border border-brand-line px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm"
        >
          <option value="">Any status</option>
          {Object.entries(QUOTE_STATUS_LABEL).map(([v, l]) => (
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

      {!quotes || quotes.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No quotes yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Send a quote to lock in a stay for a guest who isn&rsquo;t ready to
            book yet.
          </p>
          <Link
            href="/dashboard/quotes/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" />
            New quote
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-brand-light/60 text-left text-[11px] uppercase tracking-wider text-brand-mute">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {quotes.map((q) => {
                const tone = STATUS_TONE[q.status as QuoteStatus];
                return (
                  <tr key={q.id} className="hover:bg-brand-light/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/quotes/${q.id}`}
                        className="font-medium text-brand-primary hover:underline"
                      >
                        {q.quote_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-brand-ink">
                        {q.guest_name}
                      </div>
                      <div className="text-xs text-brand-mute">
                        {q.guest_email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-ink">
                      {Array.isArray(q.listing)
                        ? (q.listing[0]?.name ?? "—")
                        : ((q.listing as { name?: string } | null)?.name ??
                          "—")}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-mute">
                      {q.check_in} → {q.check_out}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-brand-ink">
                      {q.currency}{" "}
                      {Math.round(q.total_amount)
                        .toLocaleString("en-ZA")
                        .replace(/,/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}
                      >
                        {QUOTE_STATUS_LABEL[q.status as QuoteStatus]}
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
