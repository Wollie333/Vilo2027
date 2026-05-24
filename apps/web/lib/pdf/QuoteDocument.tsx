import { Document, Page, Text, View } from "@react-pdf/renderer";

import { formatDate, formatMoney, styles } from "./styles";

export type QuoteLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
  };
  guest: {
    name: string;
    email: string;
    phone: string | null;
  };
  stay: {
    listingName: string | null;
    checkIn: string;
    checkOut: string;
    nights: number;
    headcount: number;
  };
  lines: QuoteLineItem[];
  subtotal: number;
  total: number;
  currency: string;
  notes?: string | null;
};

export function QuoteDocument({ quote }: { quote: QuoteProps }) {
  const statusLabel =
    quote.status === "accepted"
      ? "Accepted"
      : quote.status === "declined"
        ? "Declined"
        : quote.status === "expired"
          ? "Expired"
          : quote.status === "converted"
            ? "Converted"
            : quote.status === "sent"
              ? "Awaiting reply"
              : "Draft";

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
            <Text style={styles.docKind}>Quote</Text>
            <Text style={styles.docNumber}>{quote.quoteNumber}</Text>
            <Text style={styles.docDate}>
              Drawn {formatDate(quote.createdAt)}
            </Text>
            <Text style={styles.statusPill}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={styles.partyName}>
              {quote.host.displayName ?? "—"}
            </Text>
            {quote.host.handle ? (
              <Text style={styles.partyLine}>@{quote.host.handle}</Text>
            ) : null}
            {quote.host.email ? (
              <Text style={styles.partyLine}>{quote.host.email}</Text>
            ) : null}
            {quote.host.phone ? (
              <Text style={styles.partyLine}>{quote.host.phone}</Text>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Prepared for</Text>
            <Text style={styles.partyName}>{quote.guest.name}</Text>
            <Text style={styles.partyLine}>{quote.guest.email}</Text>
            {quote.guest.phone ? (
              <Text style={styles.partyLine}>{quote.guest.phone}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.staySummaryBox}>
          <View style={styles.staySummaryItem}>
            <Text style={styles.staySummaryLabel}>Listing</Text>
            <Text style={styles.staySummaryValue}>
              {quote.stay.listingName ?? "—"}
            </Text>
          </View>
          <View style={styles.staySummaryItem}>
            <Text style={styles.staySummaryLabel}>Check-in</Text>
            <Text style={styles.staySummaryValue}>
              {formatDate(quote.stay.checkIn)}
            </Text>
          </View>
          <View style={styles.staySummaryItem}>
            <Text style={styles.staySummaryLabel}>Check-out</Text>
            <Text style={styles.staySummaryValue}>
              {formatDate(quote.stay.checkOut)}
            </Text>
          </View>
          <View style={styles.staySummaryItem}>
            <Text style={styles.staySummaryLabel}>Nights</Text>
            <Text style={styles.staySummaryValue}>{quote.stay.nights}</Text>
          </View>
          <View style={styles.staySummaryItem}>
            <Text style={styles.staySummaryLabel}>Guests</Text>
            <Text style={styles.staySummaryValue}>{quote.stay.headcount}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDesc]}>Description</Text>
          <Text style={[styles.th, styles.colQty]}>Qty</Text>
          <Text style={[styles.th, styles.colUnit]}>Unit price</Text>
          <Text style={[styles.th, styles.colTotal]}>Total</Text>
        </View>

        {quote.lines.map((line, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
            <Text style={[styles.td, styles.colQty]}>{line.quantity}</Text>
            <Text style={[styles.td, styles.colUnit]}>
              {formatMoney(line.unit_price, quote.currency)}
            </Text>
            <Text style={[styles.td, styles.colTotal]}>
              {formatMoney(line.subtotal, quote.currency)}
            </Text>
          </View>
        ))}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>
              {formatMoney(quote.subtotal, quote.currency)}
            </Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>
              {formatMoney(quote.total, quote.currency)}
            </Text>
          </View>
        </View>

        {quote.acceptUrl ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Accept &amp; pay online</Text>
            <Text style={styles.notesBody}>{quote.acceptUrl}</Text>
            {quote.validUntil ? (
              <Text
                style={[styles.notesBody, { marginTop: 6, color: "#4A7C6A" }]}
              >
                Quote valid until {formatDate(quote.validUntil)}.
              </Text>
            ) : null}
          </View>
        ) : null}

        {quote.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesBody}>{quote.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated by Vilo · viloplatform.com · Reference {quote.quoteNumber}
        </Text>
      </Page>
    </Document>
  );
}
