import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  FinancialDocument,
  type DocLine,
  type DocTone,
} from "@/components/finance/FinancialDocument";
import { getBrandName } from "@/lib/brand";
import { getHostParty } from "@/lib/finance/doc-party";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

import { QuoteResponseActions } from "./QuoteResponseActions";

export const metadata: Metadata = {
  title: "Your quote",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function deviceFromUserAgent(ua: string | null): string {
  if (!ua) return "unknown";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso));
}

export default async function PublicQuotePage({
  params,
}: {
  params: { id: string; token: string };
}) {
  const supabase = createAdminClient();
  const brandName = await getBrandName();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `
      id, quote_number, status, accept_token, host_id,
      guest_name, guest_email, guest_phone,
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

  const party = await getHostParty(supabase, quote.host_id);
  const c = quote.currency;

  const expired =
    !!quote.valid_until && new Date(quote.valid_until) < new Date();
  const decided = ["accepted", "declined", "converted"].includes(quote.status);

  const nights =
    quote.check_in && quote.check_out
      ? Math.max(
          1,
          Math.round(
            (new Date(quote.check_out).getTime() -
              new Date(quote.check_in).getTime()) /
              86_400_000,
          ),
        )
      : null;

  const lineRows: DocLine[] = [
    {
      title: `${listingName ?? "Stay"} — base`,
      sub: nights ? `${nights} night${nights === 1 ? "" : "s"}` : null,
      amount: formatMoney(quote.base_amount, c),
    },
  ];
  if (quote.cleaning_fee > 0) {
    lineRows.push({
      title: "Cleaning",
      amount: formatMoney(quote.cleaning_fee, c),
    });
  }
  for (const a of addons ?? []) {
    lineRows.push({
      title: a.label,
      mid: a.quantity > 1 ? `× ${a.quantity}` : null,
      amount: formatMoney(a.subtotal, c),
    });
  }

  const tone: DocTone = expired
    ? "grey"
    : quote.status === "accepted" || quote.status === "converted"
      ? "green"
      : quote.status === "declined"
        ? "red"
        : quote.status === "sent"
          ? "amber"
          : "grey";
  const statusLabel = expired
    ? "Expired"
    : quote.status.charAt(0).toUpperCase() + quote.status.slice(1);

  return (
    <FinancialDocument
      kind="Quote"
      number={quote.quote_number}
      status={{ label: statusLabel, tone }}
      brandName={brandName}
      brandTagline="Your stay quote"
      from={{ name: party.name, lines: party.lines }}
      to={{
        label: "Prepared for",
        party: {
          name: quote.guest_name ?? "Guest",
          lines: [quote.guest_email, quote.guest_phone].filter(
            Boolean,
          ) as string[],
        },
      }}
      metaRows={[
        { label: "Guests", value: String(quote.headcount) },
        ...(quote.valid_until
          ? [{ label: "Valid until", value: fmtDate(quote.valid_until) }]
          : []),
      ]}
      stay={{
        listingName: listingName ?? null,
        checkIn: fmtDate(quote.check_in),
        checkOut: fmtDate(quote.check_out),
        nights: String(nights ?? "—"),
      }}
      lineHeaders={{ desc: "Description", amount: "Amount" }}
      lines={lineRows}
      totals={[]}
      grandTotal={{
        label: "Total",
        value: formatMoney(quote.total_amount, c),
      }}
      banking={expired || decided ? null : party.banking}
      pdfHref={`/q/${quote.id}/${quote.accept_token}/pdf`}
      footerTitle={quote.notes ? "A note from your host" : undefined}
      footerNote={quote.notes ?? undefined}
      belowPaper={
        expired ? (
          <div className="rounded-card border border-status-cancelled/30 bg-status-cancelled/5 p-5 text-center shadow-card">
            <p className="text-sm font-medium text-status-cancelled">
              This quote expired on {fmtDate(quote.valid_until)}.
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
        )
      }
    />
  );
}
