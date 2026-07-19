import { BRAND, formatDate, formatMoney } from "./styles";
import { buildIssuerFromHost } from "./InvoiceDocument";
import {
  PdfPaper,
  type PdfCell,
  type PdfColumn,
  type PdfFact,
  type PdfNote,
  type PdfSummaryCell,
  type PdfTotal,
} from "./PdfPaper";

export type QuoteLineItem = {
  description: string;
  note?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type QuoteBanking = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  swiftCode?: string | null;
};

export type QuoteBusiness = {
  legalName?: string | null;
  tradingName?: string | null;
  vatNumber?: string | null;
  companyRegistrationNumber?: string | null;
  billingAddress?: string[] | null;
};

export type QuoteProps = {
  quoteNumber: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired" | "converted";
  createdAt: string;
  validUntil: string | null;
  acceptUrl: string | null;
  host: {
    displayName: string | null;
    handle: string | null;
    email: string | null;
    phone: string | null;
    banking?: QuoteBanking | null;
    business?: QuoteBusiness | null;
  };
  guest: {
    name: string;
    email: string;
    phone: string | null;
  };
  /** accommodation (stay summary) vs custom/upload (no listing/dates). */
  quoteType?: "accommodation" | "custom" | "upload";
  /** Headline for a custom/upload quote (no listing name). */
  title?: string | null;
  stay: {
    listingName: string | null;
    checkIn: string;
    checkOut: string;
    nights: number;
    headcount: number;
  };
  lines: QuoteLineItem[];
  subtotal: number;
  /** Ex-VAT total (post-discount). The grand total shown is this + vatAmount. */
  total: number;
  /** VAT rate applied when this quote converts to a booking (0 = not registered). */
  vatRate?: number;
  /** VAT added on top of the ex-VAT total (0 unless VAT-registered). */
  vatAmount?: number;
  currency: string;
  notes?: string | null;
  /** Host logo (data URI or public URL) for the branded header. */
  logoUrl?: string | null;
  /** Configurable platform brand name (see lib/brand.ts). */
  brandName: string;
};

export function QuoteDocument({ quote }: { quote: QuoteProps }) {
  const c = quote.currency;
  const isCustom = quote.quoteType === "custom" || quote.quoteType === "upload";
  const hasVat = !!quote.vatRate && quote.vatRate > 0;
  const grandTotal = quote.total + (quote.vatAmount ?? 0);
  const issuer = buildIssuerFromHost(quote.host, quote.logoUrl);

  const columns: PdfColumn[] = [
    { label: "#", flex: 0.4, align: "center" },
    { label: "Item & Description", flex: 4.2, align: "left" },
    { label: "Qty", flex: 1, align: "right" },
    { label: "Rate", flex: 1.5, align: "right" },
    { label: "Amount", flex: 1.5, align: "right" },
  ];
  const rows: PdfCell[][] = quote.lines.map((l, i) => [
    { text: String(i + 1), align: "center", color: BRAND.mute },
    { text: l.description, sub: l.note ?? null, align: "left" },
    { text: String(l.quantity), align: "right" },
    { text: formatMoney(l.unit_price, c), align: "right" },
    { text: formatMoney(l.subtotal, c), align: "right", bold: true },
  ]);

  const totals: PdfTotal[] = [
    { label: "Subtotal", value: formatMoney(quote.subtotal, c) },
  ];
  if (hasVat) {
    totals.push({
      label: `VAT (${quote.vatRate}%)`,
      value: formatMoney(quote.vatAmount ?? 0, c),
    });
  }

  const summary: PdfSummaryCell[] | null = isCustom
    ? null
    : [
        { label: "Listing", value: quote.stay.listingName ?? "—" },
        { label: "Check-in", value: formatDate(quote.stay.checkIn) },
        { label: "Check-out", value: formatDate(quote.stay.checkOut) },
        { label: "Nights", value: String(quote.stay.nights) },
        { label: "Guests", value: String(quote.stay.headcount) },
      ];

  const facts: PdfFact[] = [
    { label: "Quote date", value: formatDate(quote.createdAt) },
    ...(quote.validUntil
      ? [{ label: "Valid until", value: formatDate(quote.validUntil) }]
      : []),
    ...(isCustom
      ? []
      : [{ label: "Guests", value: String(quote.stay.headcount) }]),
  ];

  const notes: PdfNote[] = [];
  if (quote.acceptUrl) {
    notes.push({
      title: "Accept & pay online",
      body: quote.validUntil
        ? `${quote.acceptUrl}\nThis quote is valid until ${formatDate(quote.validUntil)}.`
        : quote.acceptUrl,
    });
  }
  if (quote.notes) {
    notes.push({ title: "A note from your host", body: quote.notes });
  }
  if (notes.length === 0) {
    notes.push({
      title: "Notes",
      body: "This quote is an estimate for the stay above. Prices are confirmed on acceptance.",
    });
  }

  return (
    <PdfPaper
      kind="Quote"
      number={quote.quoteNumber}
      brandName={quote.brandName}
      issuer={issuer}
      billTo={{
        label: "Prepared for",
        name: quote.guest.name,
        lines: [quote.guest.email, quote.guest.phone].filter(
          Boolean,
        ) as string[],
      }}
      facts={facts}
      balance={{ label: "Quote Total", value: formatMoney(grandTotal, c) }}
      summary={summary}
      columns={columns}
      rows={rows}
      totals={totals}
      grand={{
        label: hasVat ? "Total (incl. VAT)" : "Total",
        value: formatMoney(grandTotal, c),
      }}
      footBox={
        quote.host.banking
          ? {
              title: "Payment details",
              rows: [
                { k: "Bank", v: quote.host.banking.bankName },
                ...(quote.host.banking.accountHolder
                  ? [
                      {
                        k: "Account name",
                        v: quote.host.banking.accountHolder,
                      },
                    ]
                  : []),
                { k: "Account no.", v: quote.host.banking.accountNumber },
                ...(quote.host.banking.branchCode
                  ? [{ k: "Branch code", v: quote.host.banking.branchCode }]
                  : []),
                ...(quote.host.banking.swiftCode
                  ? [{ k: "SWIFT", v: quote.host.banking.swiftCode }]
                  : []),
                { k: "Reference", v: quote.quoteNumber },
              ],
            }
          : null
      }
      notes={notes}
      thanks={{
        title: "We look forward to hosting you.",
        subtitle: quote.host.email
          ? `Questions about this quote? Contact ${quote.host.email}.`
          : undefined,
      }}
      runningFooter={{
        left: `${issuer.name} · Quote ${quote.quoteNumber}`,
        right: `Issued via ${quote.brandName} · wielo.co.za`,
      }}
    />
  );
}
