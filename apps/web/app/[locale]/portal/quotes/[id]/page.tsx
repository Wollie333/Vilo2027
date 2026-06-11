import type { Metadata } from "next";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";

import { BrandName } from "@/components/brand/BrandProvider";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { QuoteActions } from "./QuoteActions";

export const metadata: Metadata = {
  title: "Your quote",
};

export const dynamic = "force-dynamic";

export default async function PortalQuotePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout gates auth; this guards the typed user.id below.
  if (!user) notFound();

  // Resolve via the admin client scoped to THIS user's id OR email, then verify
  // ownership in code — host-created quotes carry guest_email but no guest_id
  // until accepted, so an RLS-by-guest_id read would 404 them (the list shows
  // them by email, so the detail must match).
  const admin = createAdminClient();
  const email = (user.email ?? "").trim().toLowerCase();
  const { data: quote } = await admin
    .from("quotes")
    .select(
      `
      id, quote_number, status, guest_id, guest_email,
      guest_name,
      check_in, check_out, headcount,
      base_amount, cleaning_fee, addons_total, total_amount, currency,
      notes, valid_until, conversation_id,
      listing:listings ( name )
    `,
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  const ownsQuote =
    !!quote &&
    (quote.guest_id === user.id ||
      (quote.guest_email ?? "").toLowerCase() === email);
  if (!quote || !ownsQuote) notFound();

  const { data: addons } = await admin
    .from("quote_addons")
    .select("label, quantity, unit_price, subtotal")
    .eq("quote_id", params.id)
    .order("sort_order");

  const listingName = Array.isArray(quote.listing)
    ? quote.listing[0]?.name
    : (quote.listing as { name?: string } | null)?.name;

  const expired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const decided = ["accepted", "declined", "converted"].includes(quote.status);
  const actionable = quote.status === "sent" && !expired;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/portal/quotes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-mute transition-colors hover:text-brand-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All quotes
      </Link>

      <header className="text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
          Quote · {quote.quote_number}
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Your stay at {listingName ?? "—"}
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Prepared for {quote.guest_name}
        </p>
      </header>

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-brand-mute">
              Check-in
            </div>
            <div className="font-medium text-brand-ink">{quote.check_in}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-brand-mute">
              Check-out
            </div>
            <div className="font-medium text-brand-ink">{quote.check_out}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-brand-mute">
              Guests
            </div>
            <div className="font-medium text-brand-ink">{quote.headcount}</div>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Line items
        </h2>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-brand-line">
            <tr>
              <td className="py-2 text-brand-ink">Stay — base</td>
              <td className="py-2 text-right font-medium text-brand-ink">
                {formatMoney(quote.base_amount, quote.currency)}
              </td>
            </tr>
            {quote.cleaning_fee > 0 ? (
              <tr>
                <td className="py-2 text-brand-ink">Cleaning</td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {formatMoney(quote.cleaning_fee, quote.currency)}
                </td>
              </tr>
            ) : null}
            {(addons ?? []).map((a, i) => (
              <tr key={i}>
                <td className="py-2 text-brand-ink">
                  {a.label}
                  <span className="ml-1 text-brand-mute">× {a.quantity}</span>
                </td>
                <td className="py-2 text-right font-medium text-brand-ink">
                  {formatMoney(a.subtotal, quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 font-display text-base font-bold text-brand-ink">
                Total
              </td>
              <td className="pt-3 text-right font-display text-lg font-bold text-brand-primary">
                {formatMoney(quote.total_amount, quote.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {quote.notes ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-brand-ink">
            Notes from the host
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-brand-ink">
            {quote.notes}
          </p>
        </section>
      ) : null}

      {expired ? (
        <div className="rounded-card border border-status-cancelled/30 bg-status-cancelled/5 p-5 text-center shadow-card">
          <p className="text-sm font-medium text-status-cancelled">
            This quote expired on{" "}
            {quote.valid_until &&
              new Date(quote.valid_until).toLocaleDateString("en-ZA")}
            .
          </p>
          <p className="mt-1 text-xs text-brand-mute">
            Message the host for an updated quote.
          </p>
        </div>
      ) : decided ? (
        <div className="rounded-card border border-brand-line bg-white p-5 text-center shadow-card">
          <p className="text-sm font-medium text-brand-ink">
            You&rsquo;ve already responded to this quote.
          </p>
          <p className="mt-1 text-xs capitalize text-brand-mute">
            Status: {quote.status}
          </p>
        </div>
      ) : actionable ? (
        <QuoteActions quoteId={quote.id} />
      ) : (
        <div className="rounded-card border border-brand-line bg-white p-5 text-center shadow-card">
          <p className="text-sm font-medium text-brand-ink">
            This quote isn&rsquo;t ready to respond to yet.
          </p>
          <p className="mt-1 text-xs text-brand-mute">
            The host is still preparing it — you&rsquo;ll be notified when
            it&rsquo;s sent.
          </p>
        </div>
      )}

      {quote.conversation_id ? (
        <div className="text-center">
          <Link
            href={`/portal/inbox/${quote.conversation_id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary transition-colors hover:text-brand-secondary"
          >
            <MessageSquare className="h-4 w-4" /> Message the host about this
            quote
          </Link>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-brand-mute">
        Sent via <BrandName />
      </p>
    </div>
  );
}
