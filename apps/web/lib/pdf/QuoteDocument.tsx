import { Document, Page, Text, View } from "@react-pdf/renderer";

import { DocHeader } from "./DocHeader";
import { formatDate, formatMoney, styles } from "./styles";

export type QuoteLineItem = {
  description: string;
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
          <DocHeader
            logoUrl={quote.logoUrl}
            brandName={quote.brandName}
            businessName={
              quote.host.business?.tradingName ??
              quote.host.business?.legalName ??
              quote.host.displayName ??
              quote.brandName
            }
          />
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
              {quote.host.business?.tradingName ??
                quote.host.business?.legalName ??
                quote.host.displayName ??
                "—"}
            </Text>
            {quote.host.business?.legalName &&
            quote.host.business?.tradingName &&
            quote.host.business.legalName !==
              quote.host.business.tradingName ? (
              <Text style={styles.partyLine}>
                {quote.host.business.legalName}
              </Text>
            ) : null}
            {quote.host.handle ? (
              <Text style={styles.partyLine}>@{quote.host.handle}</Text>
            ) : null}
            {quote.host.business?.billingAddress?.map((line, i) => (
              <Text key={`addr-${i}`} style={styles.partyLine}>
                {line}
              </Text>
            ))}
            {quote.host.email ? (
              <Text style={styles.partyLine}>{quote.host.email}</Text>
            ) : null}
            {quote.host.phone ? (
              <Text style={styles.partyLine}>{quote.host.phone}</Text>
            ) : null}
            {quote.host.business?.vatNumber ? (
              <Text style={styles.partyLine}>
                VAT {quote.host.business.vatNumber}
              </Text>
            ) : null}
            {quote.host.business?.companyRegistrationNumber ? (
              <Text style={styles.partyLine}>
                Reg {quote.host.business.companyRegistrationNumber}
              </Text>
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
          {quote.vatRate && quote.vatRate > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>VAT ({quote.vatRate}%)</Text>
              <Text style={styles.totalsValue}>
                {formatMoney(quote.vatAmount ?? 0, quote.currency)}
              </Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>
              {quote.vatRate && quote.vatRate > 0
                ? "Total (incl. VAT)"
                : "Total"}
            </Text>
            <Text style={styles.grandTotalValue}>
              {formatMoney(
                quote.total + (quote.vatAmount ?? 0),
                quote.currency,
              )}
            </Text>
          </View>
        </View>

        {quote.host.banking ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Banking details</Text>
            <Text style={styles.notesBody}>
              {quote.host.banking.bankName} — {quote.host.banking.accountHolder}
            </Text>
            <Text style={styles.notesBody}>
              Account {quote.host.banking.accountNumber} ·{" "}
              {quote.host.banking.accountType} · Branch{" "}
              {quote.host.banking.branchCode}
              {quote.host.banking.swiftCode
                ? ` · SWIFT ${quote.host.banking.swiftCode}`
                : ""}
            </Text>
          </View>
        ) : null}

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
          Generated by {quote.brandName} · Reference {quote.quoteNumber}
        </Text>
      </Page>
    </Document>
  );
}
