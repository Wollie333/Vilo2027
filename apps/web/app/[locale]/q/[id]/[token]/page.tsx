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
import { effectiveVatRate, grossVat, vatOf } from "@/lib/pricing/vat";
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
  params: { id: string; token: string; locale: string };
}) {
  const supabase = createAdminClient();
  const brandName = await getBrandName();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `
      id, quote_number, status, accept_token, host_id, quote_type, title,
      attachment_name, brochure_path, brochure_name,
      guest_name, guest_email, guest_phone,
      check_in, check_out, headcount,
      base_amount, cleaning_fee, addons_total, total_amount, currency,
      notes, valid_until,
      listing:properties ( name, business_id, vat_number, vat_rate )
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

  const quoteListing = Array.isArray(quote.listing)
    ? quote.listing[0]
    : quote.listing;
  const listingName = (quoteListing as { name?: string } | null)?.name;
  const isCustomQuote =
    quote.quote_type === "custom" || quote.quote_type === "upload";
  const quoteBusinessId =
    (quoteListing as { business_id?: string | null } | null)?.business_id ??
    null;

  // VAT is added "at the end" when this quote converts to a booking (the
  // apply_booking_vat trigger grosses the ex-VAT total up). Show the same
  // VAT-inclusive total + VAT line here so what the guest agrees to == what they
  // are charged. Non-VAT listings (rate 0) render exactly as before.
  const vatRate = effectiveVatRate(
    (quoteListing as {
      vat_number?: string | null;
      vat_rate?: number;
    } | null) ?? {},
  );
  const exVatTotal = Number(quote.total_amount);
  const vatAmount = vatOf(exVatTotal, vatRate);
  const grossTotal = grossVat(exVatTotal, vatRate);

  const party = await getHostParty(
    supabase,
    quote.host_id,
    null,
    undefined,
    quoteBusinessId,
  );
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
      title: isCustomQuote
        ? (quote.title ?? "Quote")
        : `${listingName ?? "Stay"} — base`,
      sub:
        !isCustomQuote && nights
          ? `${nights} night${nights === 1 ? "" : "s"}`
          : null,
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
        ...(isCustomQuote
          ? [{ label: "Quote", value: quote.title ?? "Custom quote" }]
          : [{ label: "Guests", value: String(quote.headcount) }]),
        ...(quote.valid_until
          ? [{ label: "Valid until", value: fmtDate(quote.valid_until) }]
          : []),
      ]}
      stay={
        isCustomQuote
          ? undefined
          : {
              listingName: listingName ?? null,
              checkIn: fmtDate(quote.check_in),
              checkOut: fmtDate(quote.check_out),
              nights: String(nights ?? "—"),
            }
      }
      lineHeaders={{ desc: "Description", amount: "Amount" }}
      lines={lineRows}
      totals={
        vatRate > 0
          ? [
              { label: "Subtotal", value: formatMoney(exVatTotal, c) },
              {
                label: `VAT (${vatRate}%)`,
                value: formatMoney(vatAmount, c),
              },
            ]
          : []
      }
      grandTotal={{
        label: vatRate > 0 ? "Total (incl. VAT)" : "Total",
        value: formatMoney(vatRate > 0 ? grossTotal : exVatTotal, c),
      }}
      banking={expired || decided ? null : party.banking}
      pdfHref={`/${params.locale}/q/${quote.id}/${quote.accept_token}/pdf`}
      footerTitle={quote.notes ? "A note from your host" : undefined}
      footerNote={quote.notes ?? undefined}
      belowPaper={
        <>
          {isCustomQuote && quote.quote_type === "upload" ? (
            <a
              href={`/q/${quote.id}/${quote.accept_token}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 flex items-center justify-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light"
            >
              Download the quote
              {quote.attachment_name ? ` · ${quote.attachment_name}` : ""}
            </a>
          ) : null}
          {quote.brochure_path ? (
            <a
              href={`/q/${quote.id}/${quote.accept_token}/brochure`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 flex items-center justify-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light"
            >
              Download brochure
              {quote.brochure_name ? ` · ${quote.brochure_name}` : ""}
            </a>
          ) : null}
          {expired ? (
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
            <QuoteResponseActions
              quoteId={quote.id}
              token={quote.accept_token}
            />
          )}
        </>
      }
    />
  );
}
