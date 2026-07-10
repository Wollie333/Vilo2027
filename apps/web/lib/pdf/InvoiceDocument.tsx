import { Document, Page, Text, View } from "@react-pdf/renderer";

import { DocHeader } from "./DocHeader";
import { formatDate, formatMoney, styles } from "./styles";

export type InvoiceLineItem = {
  description: string;
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
  /** e.g. "3 season-priced nights · 2 weekend nights" — the "why". */
  seasonSummary?: string | null;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string | null;
  /** Host logo (data URI or public URL) for the branded header. */
  logoUrl?: string | null;
  /** Configurable platform brand name (see lib/brand.ts). */
  brandName: string;
};

export function InvoiceDocument({ invoice }: { invoice: InvoiceProps }) {
  const statusLabel =
    invoice.status === "paid"
      ? "Paid"
      : invoice.status === "cancelled"
        ? "Cancelled"
        : invoice.status === "draft"
          ? "Draft"
          : "Issued";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <DocHeader
            logoUrl={invoice.logoUrl}
            brandName={invoice.brandName}
            businessName={
              invoice.host.business?.tradingName ??
              invoice.host.business?.legalName ??
              invoice.host.displayName ??
              invoice.brandName
            }
          />
          <View style={styles.docMeta}>
            <Text style={styles.docKind}>
              {invoice.vatAmount > 0 ? "Tax Invoice" : "Invoice"}
            </Text>
            <Text style={styles.docNumber}>{invoice.invoiceNumber}</Text>
            <Text style={styles.docDate}>
              Issued {formatDate(invoice.issuedAt)}
            </Text>
            <Text style={styles.statusPill}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={styles.partyName}>
              {invoice.host.business?.tradingName ??
                invoice.host.business?.legalName ??
                invoice.host.displayName ??
                "—"}
            </Text>
            {invoice.host.business?.legalName &&
            invoice.host.business?.tradingName &&
            invoice.host.business.legalName !==
              invoice.host.business.tradingName ? (
              <Text style={styles.partyLine}>
                {invoice.host.business.legalName}
              </Text>
            ) : null}
            {invoice.host.handle ? (
              <Text style={styles.partyLine}>@{invoice.host.handle}</Text>
            ) : null}
            {invoice.host.business?.billingAddress?.map((line, i) => (
              <Text key={`addr-${i}`} style={styles.partyLine}>
                {line}
              </Text>
            ))}
            {invoice.host.email ? (
              <Text style={styles.partyLine}>{invoice.host.email}</Text>
            ) : null}
            {invoice.host.phone ? (
              <Text style={styles.partyLine}>{invoice.host.phone}</Text>
            ) : null}
            {invoice.host.business?.companyRegistrationNumber ? (
              <Text style={styles.partyLine}>
                Reg {invoice.host.business.companyRegistrationNumber}
              </Text>
            ) : null}
            {invoice.host.business?.vatNumber ? (
              <Text style={styles.partyLine}>
                VAT {invoice.host.business.vatNumber}
              </Text>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Billed to</Text>
            <Text style={styles.partyName}>{invoice.guest.name ?? "—"}</Text>
            {invoice.guest.email ? (
              <Text style={styles.partyLine}>{invoice.guest.email}</Text>
            ) : null}
            {invoice.guest.phone ? (
              <Text style={styles.partyLine}>{invoice.guest.phone}</Text>
            ) : null}
          </View>
        </View>

        {invoice.stay ? (
          <View style={styles.staySummaryBox}>
            <View style={styles.staySummaryItem}>
              <Text style={styles.staySummaryLabel}>Listing</Text>
              <Text style={styles.staySummaryValue}>
                {invoice.stay.listingName ?? "—"}
              </Text>
            </View>
            <View style={styles.staySummaryItem}>
              <Text style={styles.staySummaryLabel}>Check-in</Text>
              <Text style={styles.staySummaryValue}>
                {formatDate(invoice.stay.checkIn)}
              </Text>
            </View>
            <View style={styles.staySummaryItem}>
              <Text style={styles.staySummaryLabel}>Check-out</Text>
              <Text style={styles.staySummaryValue}>
                {formatDate(invoice.stay.checkOut)}
              </Text>
            </View>
            <View style={styles.staySummaryItem}>
              <Text style={styles.staySummaryLabel}>Nights</Text>
              <Text style={styles.staySummaryValue}>
                {invoice.stay.nights ?? "—"}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDesc]}>Description</Text>
          <Text style={[styles.th, styles.colQty]}>Qty</Text>
          <Text style={[styles.th, styles.colUnit]}>Unit price</Text>
          <Text style={[styles.th, styles.colTotal]}>Total</Text>
        </View>

        {invoice.lines.map((line, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
            <Text style={[styles.td, styles.colQty]}>{line.quantity}</Text>
            <Text style={[styles.td, styles.colUnit]}>
              {formatMoney(line.unit_price, invoice.currency)}
            </Text>
            <Text style={[styles.td, styles.colTotal]}>
              {formatMoney(line.subtotal, invoice.currency)}
            </Text>
          </View>
        ))}

        {invoice.seasonSummary ? (
          <Text style={[styles.td, { marginTop: 6, color: "#6B7280" }]}>
            Includes {invoice.seasonSummary}.
          </Text>
        ) : null}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>
              {formatMoney(invoice.subtotal, invoice.currency)}
            </Text>
          </View>
          {invoice.discountAmount && invoice.discountAmount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>
                −{formatMoney(invoice.discountAmount, invoice.currency)}
              </Text>
            </View>
          ) : null}
          {invoice.vatAmount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>VAT</Text>
              <Text style={styles.totalsValue}>
                {formatMoney(invoice.vatAmount, invoice.currency)}
              </Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total due</Text>
            <Text style={styles.grandTotalValue}>
              {formatMoney(invoice.totalAmount, invoice.currency)}
            </Text>
          </View>
        </View>

        {invoice.host.banking ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Payment details</Text>
            <Text style={styles.notesBody}>
              Bank: {invoice.host.banking.bankName}
            </Text>
            {invoice.host.banking.accountHolder ? (
              <Text style={styles.notesBody}>
                Account name: {invoice.host.banking.accountHolder}
              </Text>
            ) : null}
            <Text style={styles.notesBody}>
              Account no: {invoice.host.banking.accountNumber}
            </Text>
            {invoice.host.banking.branchCode ? (
              <Text style={styles.notesBody}>
                Branch: {invoice.host.banking.branchCode}
              </Text>
            ) : null}
            {invoice.host.banking.swiftCode ? (
              <Text style={styles.notesBody}>
                SWIFT: {invoice.host.banking.swiftCode}
              </Text>
            ) : null}
            <Text
              style={[styles.notesBody, { marginTop: 4, color: "#4A7C6A" }]}
            >
              Ref #: {invoice.invoiceNumber}
            </Text>
          </View>
        ) : null}

        {invoice.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesBody}>{invoice.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated by {invoice.brandName} · Reference {invoice.invoiceNumber}
        </Text>
      </Page>
    </Document>
  );
}
