import { Document, Page, Text, View } from "@react-pdf/renderer";

import { DocHeader } from "./DocHeader";
import type { InvoiceBanking, InvoiceBusiness } from "./InvoiceDocument";
import { formatDate, formatMoney, styles } from "./styles";

export type CreditNoteProps = {
  creditNoteNumber: string;
  status: "draft" | "issued" | "cancelled";
  issuedAt: string;
  invoiceNumber?: string | null;
  reason?: string | null;
  /** Document title (default "Credit note"). Lets the same paper serve a
   *  Wielo refund / adjustment without a new PDF component. */
  docKind?: string;
  /** Party heading (default "Credited to" → "Refunded to" for refunds). */
  toLabel?: string;
  /** Grand-total row label (default "Total credited"). */
  totalLabel?: string;
  /** A positive money movement (an upward adjustment) — prints "+" in ink rather
   *  than the default "−" in red. */
  positive?: boolean;
  host: {
    displayName: string | null;
    handle: string | null;
    email: string | null;
    phone: string | null;
    banking?: InvoiceBanking | null;
    business?: InvoiceBusiness | null;
  };
  guest: { name: string | null; email: string | null; phone: string | null };
  lines: { label: string; amount: number }[];
  total: number;
  currency: string;
  logoUrl?: string | null;
  /** Configurable platform brand name (see lib/brand.ts). */
  brandName: string;
};

export function CreditNoteDocument({ note }: { note: CreditNoteProps }) {
  const statusLabel =
    note.status === "cancelled"
      ? "Cancelled"
      : note.status === "draft"
        ? "Draft"
        : "Issued";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <DocHeader
            logoUrl={note.logoUrl}
            brandName={note.brandName}
            businessName={
              note.host.business?.tradingName ??
              note.host.business?.legalName ??
              note.host.displayName ??
              note.brandName
            }
          />
          <View style={styles.docMeta}>
            <Text
              style={[
                styles.docKind,
                { color: note.positive ? "#065F46" : "#B91C1C" },
              ]}
            >
              {note.docKind ?? "Credit note"}
            </Text>
            <Text style={styles.docNumber}>{note.creditNoteNumber}</Text>
            <Text style={styles.docDate}>
              Issued {formatDate(note.issuedAt)}
            </Text>
            {note.invoiceNumber ? (
              <Text style={styles.docDate}>Against {note.invoiceNumber}</Text>
            ) : null}
            <Text style={styles.statusPill}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={styles.partyName}>
              {note.host.business?.tradingName ??
                note.host.business?.legalName ??
                note.host.displayName ??
                "—"}
            </Text>
            {note.host.handle ? (
              <Text style={styles.partyLine}>@{note.host.handle}</Text>
            ) : null}
            {note.host.business?.billingAddress?.map((line, i) => (
              <Text key={`addr-${i}`} style={styles.partyLine}>
                {line}
              </Text>
            ))}
            {note.host.email ? (
              <Text style={styles.partyLine}>{note.host.email}</Text>
            ) : null}
            {note.host.business?.vatNumber ? (
              <Text style={styles.partyLine}>
                VAT {note.host.business.vatNumber}
              </Text>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>
              {note.toLabel ?? "Credited to"}
            </Text>
            <Text style={styles.partyName}>{note.guest.name ?? "—"}</Text>
            {note.guest.email ? (
              <Text style={styles.partyLine}>{note.guest.email}</Text>
            ) : null}
            {note.guest.phone ? (
              <Text style={styles.partyLine}>{note.guest.phone}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDesc]}>Description</Text>
          <Text style={[styles.th, styles.colTotal]}>
            {note.positive ? "Amount" : "Credited"}
          </Text>
        </View>
        {note.lines.map((line, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.td, styles.colDesc]}>{line.label}</Text>
            <Text style={[styles.td, styles.colTotal]}>
              {formatMoney(line.amount, note.currency)}
            </Text>
          </View>
        ))}

        <View style={styles.totalsBlock}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>
              {note.totalLabel ?? "Total credited"}
            </Text>
            <Text
              style={[
                styles.grandTotalValue,
                { color: note.positive ? "#065F46" : "#B91C1C" },
              ]}
            >
              {note.positive ? "+" : "−"}
              {formatMoney(note.total, note.currency)}
            </Text>
          </View>
        </View>

        {note.reason ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Reason</Text>
            <Text style={styles.notesBody}>{note.reason}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated by {note.brandName} · Reference {note.creditNoteNumber}
        </Text>
      </Page>
    </Document>
  );
}
