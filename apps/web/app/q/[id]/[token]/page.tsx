import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

import { QuoteResponseActions } from "./QuoteResponseActions";

export const metadata: Metadata = {
  title: "Your quote · Vilo",
};

export const dynamic = "force-dynamic";

function fmt(amount: number, currency = "ZAR"): string {
  const symbol = currency === "ZAR" ? "R" : currency + " ";
  return `${symbol} ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

// Coarse, non-PII device bucket from the user agent — drives the host's
// activity log ("opened on mobile"). No IP, no fingerprinting.
function deviceFromUserAgent(ua: string | null): string {
  if (!ua) return "unknown";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

// Record a guest open of a sent quote as a quote_view_events row (the source of
// truth for the host's open count + activity). Runs with the service role (the
// token already authed the page). Best-effort — never blocks or breaks render.
async function recordQuoteView(
  supabase: ReturnType<typeof createAdminClient>,
  quoteId: string,
): Promise<void> {
  try {
    const ua = headers().get("user-agent");
    await supabase
      .from("quote_view_events")
      .insert({ quote_id: quoteId, device: deviceFromUserAgent(ua) });
  } catch {
    // Tracking must never affect the guest's view of the quote.
  }
}

export default async function PublicQuotePage({
  params,
}: {
  params: { id: string; token: string };
}) {
  // Service-role bypasses RLS — the token is the auth.
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `
      id, quote_number, status, accept_token,
      guest_name, guest_email,
      check_in, check_out, headcount,
      base_amount, cleaning_fee, addons_total, total_amount, currency,
      notes, valid_until,
      listing:listings ( name )
    `,
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!quote || quote.accept_token !== params.token) {
    notFound();
  }

  // Track the open (best-effort) — powers the host's view count, stepper and
  // activity log. Only count a live quote the guest can still act on.
  if (!["accepted", "declined", "converted"].includes(quote.status)) {
    await recordQuoteView(supabase, quote.id);
  }

  const { data: addons } = await supabase
    .from("quote_addons")
    .select("label, quantity, unit_price, subtotal")
    .eq("quote_id", params.id)
    .order("sort_order");

  const listingName = Array.isArray(quote.listing)
    ? quote.listing[0]?.name
    : (quote.listing as { name?: string } | null)?.name;

  const expired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const decided = ["accepted", "declined", "converted"].includes(quote.status);

  return (
    <div className="min-h-screen bg-brand-light px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded bg-brand-primary text-2xl font-bold text-white">
            V
          </div>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
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
              <div className="font-medium text-brand-ink">
                {quote.check_out}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                Guests
              </div>
              <div className="font-medium text-brand-ink">
                {quote.headcount}
              </div>
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
                  {fmt(quote.base_amount, quote.currency)}
                </td>
              </tr>
              {quote.cleaning_fee > 0 ? (
                <tr>
                  <td className="py-2 text-brand-ink">Cleaning</td>
                  <td className="py-2 text-right font-medium text-brand-ink">
                    {fmt(quote.cleaning_fee, quote.currency)}
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
                    {fmt(a.subtotal, quote.currency)}
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
                  {fmt(quote.total_amount, quote.currency)}
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
              Reach out to the host for an updated quote.
            </p>
          </div>
        ) : decided ? (
          <div className="rounded-card border border-brand-line bg-white p-5 text-center shadow-card">
            <p className="text-sm font-medium text-brand-ink">
              You&rsquo;ve already responded to this quote.
            </p>
            <p className="mt-1 text-xs text-brand-mute">
              Status: {quote.status}
            </p>
          </div>
        ) : (
          <QuoteResponseActions quoteId={quote.id} token={quote.accept_token} />
        )}

        <p className="text-center text-[11px] text-brand-mute">
          Sent via{" "}
          <span className="font-semibold text-brand-primary">VILO</span> ·
          viloplatform.com
        </p>
      </div>
    </div>
  );
}
