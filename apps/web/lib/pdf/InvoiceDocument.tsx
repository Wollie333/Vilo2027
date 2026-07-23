import { BRAND, formatDate, formatMoneyExact } from "./styles";
import {
  PdfPaper,
  type PdfCell,
  type PdfColumn,
  type PdfFact,
  type PdfFootRow,
  type PdfMark,
  type PdfNote,
  type PdfTotal,
} from "./PdfPaper";

export type InvoiceLineItem = {
  description: string;
  /** Optional second line under the item name. */
  note?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type InvoiceBanking = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  swiftCode?: string | null;
  reference?: string | null;
};

export type InvoiceBusiness = {
  legalName?: string | null;
  tradingName?: string | null;
  vatNumber?: string | null;
  companyRegistrationNumber?: string | null;
  billingAddress?: string[] | null;
};

export type InvoiceProps = {
  invoiceNumber: string;
  status: "draft" | "issued" | "paid" | "cancelled";
  issuedAt: string;
  host: {
    displayName: string | null;
    handle: string | null;
    email: string | null;
    phone: string | null;
    banking?: InvoiceBanking | null;
    business?: InvoiceBusiness | null;
  };
  guest: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  /** Booking stay summary. Omit/null for non-stay invoices (e.g. Wielo products). */
  stay?: {
    listingName: string | null;
    checkIn: string | null;
    checkOut: string | null;
    nights: number | null;
  } | null;
  lines: InvoiceLineItem[];
  subtotal: number;
  discountAmount?: number;
  discountLabel?: string | null;
  /** Non-coupon (stay/LOS or manual-quote) discount, itemised separately. */
  stayDiscount?: number;
  seasonSummary?: string | null;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  /** Facts card rows (Invoice date / Terms / Due date / Booking ref…). */
  facts?: PdfFact[] | null;
  /** Notes / Terms shown in the foot. Defaults to a generic booking note. */
  notes?: PdfNote[] | null;
  /** Thanks band (bottom). Falls back to a generic thank-you. */
  thanks?: { title: string; subtitle?: string } | null;
  /** Very-small-print legal line under the footer. */
  legalLine?: string | null;
  /** Host logo (data URI or public URL) for the branded header. */
  logoUrl?: string | null;
  /** Header mark when no logo is set — Wielo docs pass `{ kind: "wielo" }`. */
  fallbackMark?: PdfMark | null;
  /** Configurable platform brand name (see lib/brand.ts). */
  brandName: string;
};

export function buildIssuerFromHost(
  host: {
    displayName: string | null;
    handle: string | null;
    email: string | null;
    phone: string | null;
    business?: InvoiceBusiness | null;
  },
  logoUrl?: string | null,
  /** Mark to use when no logo is set (defaults to gradient initials). Wielo's
   *  own documents pass `{ kind: "wielo" }` so the roundel shows, not "MP". */
  fallbackMark?: PdfMark | null,
) {
  const name =
    host.business?.tradingName ??
    host.business?.legalName ??
    host.displayName ??
    "—";
  const meta: string[] = [];
  if (host.business?.legalName && host.business.legalName !== name)
    meta.push(host.business.legalName);
  if (host.handle) meta.push(`@${host.handle}`);
  for (const l of host.business?.billingAddress ?? []) meta.push(l);
  if (host.email) meta.push(host.email);
  if (host.phone) meta.push(host.phone);
  if (host.business?.companyRegistrationNumber)
    meta.push(`Reg ${host.business.companyRegistrationNumber}`);
  if (host.business?.vatNumber) meta.push(`VAT ${host.business.vatNumber}`);
  const mark: PdfMark = logoUrl
    ? { kind: "logo", url: logoUrl }
    : (fallbackMark ?? { kind: "initials", text: initials(name) });
  return { mark, name, metaLines: meta };
}

export function bankingFootRows(
  banking: InvoiceBanking | null | undefined,
  reference: string,
): PdfFootRow[] {
  if (!banking) return [];
  const rows: PdfFootRow[] = [{ k: "Bank", v: banking.bankName }];
  if (banking.accountHolder)
    rows.push({ k: "Account name", v: banking.accountHolder });
  rows.push({ k: "Account no.", v: banking.accountNumber });
  if (banking.branchCode)
    rows.push({ k: "Branch code", v: banking.branchCode });
  if (banking.swiftCode) rows.push({ k: "SWIFT", v: banking.swiftCode });
  rows.push({ k: "Reference", v: banking.reference || reference });
  return rows;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "W";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function InvoiceDocument({ invoice }: { invoice: InvoiceProps }) {
  const c = invoice.currency;
  const isPaid = invoice.status === "paid";
  const isTax = invoice.vatAmount > 0;
  const kind = isTax ? "Tax Invoice" : "Invoice";
  const issuer = buildIssuerFromHost(
    invoice.host,
    invoice.logoUrl,
    invoice.fallbackMark,
  );

  const columns: PdfColumn[] = [
    { label: "#", flex: 0.4, align: "center" },
    { label: "Item & Description", flex: 4.2, align: "left" },
    { label: "Qty", flex: 1, align: "right" },
    { label: "Rate", flex: 1.5, align: "right" },
    { label: "Amount", flex: 1.5, align: "right" },
  ];
  const rows: PdfCell[][] = invoice.lines.map((l, i) => [
    { text: String(i + 1), align: "center", color: BRAND.mute },
    { text: l.description, sub: l.note ?? null, align: "left" },
    { text: String(l.quantity), align: "right" },
    { text: formatMoneyExact(l.unit_price, c), align: "right" },
    { text: formatMoneyExact(l.subtotal, c), align: "right", bold: true },
  ]);

  const totals: PdfTotal[] = [
    { label: "Subtotal", value: formatMoneyExact(invoice.subtotal, c) },
  ];
  if (invoice.stayDiscount && invoice.stayDiscount > 0) {
    totals.push({
      label: "Discount",
      value: `- ${formatMoneyExact(invoice.stayDiscount, c)}`,
      mute: true,
    });
  }
  if (invoice.discountAmount && invoice.discountAmount > 0) {
    totals.push({
      label: invoice.discountLabel
        ? `Discount (${invoice.discountLabel})`
        : "Discount",
      value: `- ${formatMoneyExact(invoice.discountAmount, c)}`,
      mute: true,
    });
  }
  if (invoice.seasonSummary) {
    totals.push({
      label: `Incl. ${invoice.seasonSummary}`,
      value: "",
      mute: true,
    });
  }
  if (isTax)
    totals.push({
      label: "VAT",
      value: formatMoneyExact(invoice.vatAmount, c),
    });

  const facts: PdfFact[] = invoice.facts ?? [
    { label: "Invoice date", value: formatDate(invoice.issuedAt) },
  ];

  const notes: PdfNote[] = invoice.notes ?? [
    {
      title: "Notes",
      body: "Thank you for your booking. Please keep this invoice for your records.",
    },
    {
      title: "Terms & Conditions",
      body: "This invoice is issued for the booking shown above. Cancellation and refund terms are those set out in your booking confirmation.",
    },
  ];

  return (
    <PdfPaper
      kind={kind}
      number={invoice.invoiceNumber}
      brandName={invoice.brandName}
      issuer={issuer}
      billTo={{
        label: "Billed to",
        name: invoice.guest.name ?? "—",
        lines: [invoice.guest.email, invoice.guest.phone].filter(
          Boolean,
        ) as string[],
      }}
      facts={facts}
      balance={{
        label: isPaid ? "Amount Paid" : "Balance Due",
        value: formatMoneyExact(invoice.totalAmount, c),
        positive: isPaid,
      }}
      summary={
        invoice.stay
          ? [
              { label: "Listing", value: invoice.stay.listingName ?? "—" },
              { label: "Check-in", value: formatDate(invoice.stay.checkIn) },
              { label: "Check-out", value: formatDate(invoice.stay.checkOut) },
              { label: "Nights", value: String(invoice.stay.nights ?? "—") },
            ]
          : null
      }
      columns={columns}
      rows={rows}
      totals={totals}
      grand={{
        label: isPaid ? "Total paid" : "Total due",
        value: formatMoneyExact(invoice.totalAmount, c),
      }}
      footBox={
        invoice.host.banking
          ? {
              title: isPaid ? "Banking details" : "Payment details",
              rows: bankingFootRows(
                invoice.host.banking,
                invoice.invoiceNumber,
              ),
            }
          : null
      }
      notes={notes}
      thanks={
        invoice.thanks ?? {
          title: "Thank you for booking direct.",
          subtitle: invoice.host.email
            ? `Questions about this ${kind.toLowerCase()}? Contact ${invoice.host.email}.`
            : undefined,
        }
      }
      stamp={isPaid ? "Paid" : null}
      runningFooter={{
        left: `${issuer.name} · ${kind} ${invoice.invoiceNumber}`,
        right: `Issued via ${invoice.brandName} · wielo.co.za`,
      }}
      legalLine={invoice.legalLine}
    />
  );
}
