import { Document, Page, Text, View } from "@react-pdf/renderer";

import { formatDate, formatMoney, styles } from "./styles";

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
  };
  guest: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  stay: {
    listingName: string | null;
    checkIn: string | null;
    checkOut: string | null;
    nights: number | null;
  };
  lines: InvoiceLineItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string | null;
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
          <View style={styles.brandBlock}>
            <Text style={styles.brandSquare}>V</Text>
            <View>
              <Text style={styles.brandWordmark}>VILO</Text>
              <Text style={styles.brandTag}>Direct booking platform</Text>
            </View>
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docKind}>Invoice</Text>
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
              {invoice.host.displayName ?? "—"}
            </Text>
            {invoice.host.handle ? (
              <Text style={styles.partyLine}>@{invoice.host.handle}</Text>
            ) : null}
            {invoice.host.email ? (
              <Text style={styles.partyLine}>{invoice.host.email}</Text>
            ) : null}
            {invoice.host.phone ? (
              <Text style={styles.partyLine}>{invoice.host.phone}</Text>
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

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>
              {formatMoney(invoice.subtotal, invoice.currency)}
            </Text>
          </View>
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

        {invoice.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesBody}>{invoice.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated by Vilo · viloplatform.com · Reference{" "}
          {invoice.invoiceNumber}
        </Text>
      </Page>
    </Document>
  );
}
