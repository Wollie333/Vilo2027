import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { Download, ExternalLink, History, Pencil } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { QuoteActions } from "./QuoteActions";
import { QuoteShare } from "./QuoteShare";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "../schemas";

export const metadata: Metadata = {
  title: "Quote · Vilo",
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

function fmt(amount: number, currency = "ZAR"): string {
  const symbol = currency === "ZAR" ? "R" : currency + " ";
  return `${symbol} ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

export default async function QuoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/quotes/${params.id}`);

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `
      id, quote_number, status,
      guest_name, guest_email, guest_phone,
      check_in, check_out, headcount, scope,
      base_amount, cleaning_fee, addons_total, total_amount, currency,
      notes, accept_token, valid_until,
      sent_at, accepted_at, declined_at, converted_at, converted_booking_id,
      created_at,
      listing:listings ( id, name, slug )
    `,
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!quote) notFound();

  const { data: addons } = await supabase
    .from("quote_addons")
    .select("label, quantity, unit_price, subtotal")
    .eq("quote_id", params.id)
    .order("sort_order");

  // Prior issued versions (snapshotted on each edit of a sent quote).
  const { data: versions } = await supabase
    .from("quote_versions")
    .select("id, version_no, total_amount, currency, created_at")
    .eq("quote_id", params.id)
    .order("version_no", { ascending: false });

  const status = quote.status as QuoteStatus;
  const tone = STATUS_TONE[status];

  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const acceptUrl = `${proto}://${host}/q/${quote.id}/${quote.accept_token}`;

  const listingName = Array.isArray(quote.listing)
    ? quote.listing[0]?.name
    : (quote.listing as { name?: string } | null)?.name;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Quote
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            {quote.quote_number}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}
            >
              {QUOTE_STATUS_LABEL[status]}
            </span>
            <span className="text-xs text-brand-mute">
              For {listingName ?? "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === "draft" || status === "sent" ? (
            <Link
              href={`/dashboard/quotes/${quote.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          ) : null}
          <Link
            href={`/quote/${quote.id}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Link>
          {quote.converted_booking_id ? (
            <Link
              href={`/dashboard/bookings/${quote.converted_booking_id}`}
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
            >
              View booking
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Guest
          </div>
          <div className="mt-1 font-medium text-brand-ink">
            {quote.guest_name}
          </div>
          <div className="text-xs text-brand-mute">{quote.guest_email}</div>
          {quote.guest_phone ? (
            <div className="text-xs text-brand-mute">{quote.guest_phone}</div>
          ) : null}
        </div>
        <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Stay
          </div>
          <div className="mt-1 font-medium text-brand-ink">
            {quote.check_in} → {quote.check_out}
          </div>
          <div className="text-xs text-brand-mute">
            {quote.headcount} guest{quote.headcount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Total
          </div>
          <div className="mt-1 font-display text-xl font-bold text-brand-primary">
            {fmt(quote.total_amount, quote.currency)}
          </div>
          {quote.valid_until ? (
            <div className="text-xs text-brand-mute">
              Valid until{" "}
              {new Date(quote.valid_until).toLocaleDateString("en-ZA")}
            </div>
          ) : null}
        </div>
      </div>

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
            <tr>
              <td className="py-2 text-brand-ink">Stay — base</td>
              <td className="py-2 text-right text-brand-mute">1</td>
              <td className="py-2 text-right text-brand-mute">
                {fmt(quote.base_amount, quote.currency)}
              </td>
              <td className="py-2 text-right font-medium text-brand-ink">
                {fmt(quote.base_amount, quote.currency)}
              </td>
            </tr>
            {quote.cleaning_fee > 0 ? (
              <tr>
                <td className="py-2 text-brand-ink">Cleaning</td>
                <td className="py-2 text-right text-brand-mute">1</td>
                <td className="py-2 text-right text-brand-mute">
                  {fmt(quote.cleaning_fee, quote.currency)}
                </td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {fmt(quote.cleaning_fee, quote.currency)}
                </td>
              </tr>
            ) : null}
            {(addons ?? []).map((a, i) => (
              <tr key={i}>
                <td className="py-2 text-brand-ink">{a.label}</td>
                <td className="py-2 text-right text-brand-mute">
                  {a.quantity}
                </td>
                <td className="py-2 text-right text-brand-mute">
                  {fmt(a.unit_price, quote.currency)}
                </td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {fmt(a.subtotal, quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={3}
                className="pt-3 text-right font-display text-base font-bold text-brand-ink"
              >
                Total
              </td>
              <td className="pt-3 text-right font-display text-lg font-bold text-brand-primary">
                {fmt(quote.total_amount, quote.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {quote.notes ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-brand-ink">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-brand-ink">
            {quote.notes}
          </p>
        </section>
      ) : null}

      <QuoteShare
        quoteId={quote.id}
        acceptUrl={acceptUrl}
        guestName={quote.guest_name}
        guestEmail={quote.guest_email}
        guestPhone={quote.guest_phone}
        quoteNumber={quote.quote_number}
        listingName={listingName ?? "your stay"}
        total={quote.total_amount}
        currency={quote.currency}
      />

      {versions && versions.length > 0 ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-brand-ink">
            <History className="h-4 w-4 text-brand-mute" /> Version history
          </h2>
          <p className="mt-1 text-xs text-brand-mute">
            Each edit after sending keeps the previous version and its PDF. The
            current quote above is the latest.
          </p>
          <ul className="mt-3 divide-y divide-brand-line">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-brand-ink">
                    Version {v.version_no}
                  </span>
                  <span className="ml-2 text-xs text-brand-mute">
                    {new Intl.DateTimeFormat("en-ZA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(v.created_at))}{" "}
                    · {fmt(Number(v.total_amount), v.currency)}
                  </span>
                </div>
                <Link
                  href={`/quote/${quote.id}/pdf?v=${v.version_no}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-2.5 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <QuoteActions quoteId={quote.id} status={status} />
    </div>
  );
}
