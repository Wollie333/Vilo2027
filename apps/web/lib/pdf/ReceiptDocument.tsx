import { Document, Page, Text, View } from "@react-pdf/renderer";

import { DocHeader } from "./DocHeader";
import type { InvoiceBusiness } from "./InvoiceDocument";
import { formatDate, formatMoney, styles } from "./styles";

export type ReceiptProps = {
  receiptNumber: string;
  paidAt: string;
  method: string;
  /** Deposit / Balance / Add-on / Payment / Store credit. */
  kindLabel: string;
  host: {
    displayName: string | null;
    handle: string | null;
    email: string | null;
    phone: string | null;
    business?: InvoiceBusiness | null;
  };
  guest: { name: string | null; email: string | null; phone: string | null };
  stay: {
    listingName: string | null;
    checkIn: string | null;
    checkOut: string | null;
  };
  bookingRef: string | null;
  amount: number;
  currency: string;
  /** Outstanding balance on the booking after this payment. */
  balanceAfter?: number | null;
  banking?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    accountType: string;
    branchCode: string;
    swiftCode: string | null;
    reference: string | null;
  } | null;
  logoUrl?: string | null;
  brandName: string;
};

export function ReceiptDocument({ receipt }: { receipt: ReceiptProps }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <DocHeader
            logoUrl={receipt.logoUrl}
            brandName={receipt.brandName}
            businessName={
              receipt.host.business?.tradingName ??
              receipt.host.business?.legalName ??
              receipt.host.displayName ??
              receipt.brandName
            }
          />
          <View style={styles.docMeta}>
            <Text style={styles.docKind}>Receipt</Text>
            <Text style={styles.docNumber}>{receipt.receiptNumber}</Text>
            <Text style={styles.docDate}>
              Paid {formatDate(receipt.paidAt)}
            </Text>
            <Text style={styles.statusPill}>Received</Text>
          </View>
        </View>

        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={styles.partyName}>
              {receipt.host.business?.tradingName ??
                receipt.host.business?.legalName ??
                receipt.host.displayName ??
                "—"}
            </Text>
            {receipt.host.handle ? (
              <Text style={styles.partyLine}>@{receipt.host.handle}</Text>
            ) : null}
            {receipt.host.email ? (
              <Text style={styles.partyLine}>{receipt.host.email}</Text>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Received from</Text>
            <Text style={styles.partyName}>{receipt.guest.name ?? "—"}</Text>
            {receipt.guest.email ? (
              <Text style={styles.partyLine}>{receipt.guest.email}</Text>
            ) : null}
            {receipt.guest.phone ? (
              <Text style={styles.partyLine}>{receipt.guest.phone}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.staySummaryBox}>
          <View style={styles.staySummaryItem}>
            <Text style={styles.staySummaryLabel}>Listing</Text>
            <Text style={styles.staySummaryValue}>
              {receipt.stay.listingName ?? "—"}
            </Text>
          </View>
          <View style={styles.staySummaryItem}>
            <Text style={styles.staySummaryLabel}>Booking</Text>
            <Text style={styles.staySummaryValue}>
              {receipt.bookingRef ?? "—"}
            </Text>
          </View>
          <View style={styles.staySummaryItem}>
            <Text style={styles.staySummaryLabel}>Method</Text>
            <Text style={styles.staySummaryValue}>
              {receipt.method.replace(/_/g, " ")}
            </Text>
          </View>
          <View style={styles.staySummaryItem}>
            <Text style={styles.staySummaryLabel}>For</Text>
            <Text style={styles.staySummaryValue}>{receipt.kindLabel}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDesc]}>Description</Text>
          <Text style={[styles.th, styles.colTotal]}>Amount</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.td, styles.colDesc]}>
            {receipt.kindLabel} payment
            {receipt.stay.listingName ? ` — ${receipt.stay.listingName}` : ""}
          </Text>
          <Text style={[styles.td, styles.colTotal]}>
            {formatMoney(receipt.amount, receipt.currency)}
          </Text>
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Amount received</Text>
            <Text style={styles.grandTotalValue}>
              {formatMoney(receipt.amount, receipt.currency)}
            </Text>
          </View>
          {receipt.balanceAfter != null ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Balance still due</Text>
              <Text style={styles.totalsValue}>
                {formatMoney(receipt.balanceAfter, receipt.currency)}
              </Text>
            </View>
          ) : null}
        </View>

        {receipt.banking ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Payment details</Text>
            <Text style={styles.notesBody}>
              {receipt.banking.bankName} — {receipt.banking.accountHolder}
            </Text>
            <Text style={styles.notesBody}>
              Account {receipt.banking.accountNumber} ·{" "}
              {receipt.banking.accountType} · Branch{" "}
              {receipt.banking.branchCode}
              {receipt.banking.swiftCode
                ? ` · SWIFT ${receipt.banking.swiftCode}`
                : ""}
            </Text>
            {receipt.banking.reference ? (
              <Text
                style={[styles.notesBody, { marginTop: 4, color: "#4A7C6A" }]}
              >
                Use reference: {receipt.banking.reference}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated by {receipt.brandName} · Receipt {receipt.receiptNumber} ·
          This confirms payment received.
        </Text>
      </Page>
    </Document>
  );
}
