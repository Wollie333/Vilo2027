import { Document, Page, Text, View } from "@react-pdf/renderer";

import { DocHeader } from "./DocHeader";
import { BRAND, formatDate, formatMoney, styles } from "./styles";

// A Statement of Account (F4) — a running ledger between two parties over a
// period. Reuses the shared paper/styles; adds a Date · Description · Amount ·
// Balance table with a brought-forward opening row and a carried-forward close.

export type StatementPdfLine = {
  date: string;
  title: string;
  sub: string | null;
  amount: number; // signed: + charge, − payment
  balance: number;
};

export type StatementPdfProps = {
  reference: string;
  issuer: { name: string; lines: string[] };
  recipientLabel: string;
  recipient: { name: string; lines: string[] };
  periodFrom: string | null;
  periodTo: string;
  issuedAt: string;
  currency: string;
  openingBalance: number;
  lines: StatementPdfLine[];
  closingBalance: number;
  totalCharges: number;
  totalPayments: number;
  vatIncluded: number | null;
  vatRate: number | null;
  balanceLabel: string;
  brandName: string;
  logoUrl?: string | null;
};

function signed(amount: number, currency: string): string {
  if (!amount) return "—";
  const mag = formatMoney(Math.abs(amount), currency);
  // ASCII hyphen — the Helvetica core font has no U+2212 MINUS SIGN glyph.
  return amount > 0 ? `+${mag}` : `-${mag}`;
}

export function StatementDocument({ stmt }: { stmt: StatementPdfProps }) {
  const periodLabel = stmt.periodFrom
    ? `${formatDate(stmt.periodFrom)} – ${formatDate(stmt.periodTo)}`
    : `All activity to ${formatDate(stmt.periodTo)}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <DocHeader
            logoUrl={stmt.logoUrl}
            brandName={stmt.brandName}
            businessName={stmt.issuer.name}
          />
          <View style={styles.docMeta}>
            <Text style={styles.docKind}>Statement</Text>
            <Text style={styles.docNumber}>{stmt.reference}</Text>
            <Text style={styles.docDate}>
              As at {formatDate(stmt.periodTo)}
            </Text>
          </View>
        </View>

        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={styles.partyName}>{stmt.issuer.name}</Text>
            {stmt.issuer.lines.map((l, i) => (
              <Text key={i} style={styles.partyLine}>
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>{stmt.recipientLabel}</Text>
            <Text style={styles.partyName}>{stmt.recipient.name}</Text>
            {stmt.recipient.lines.map((l, i) => (
              <Text key={i} style={styles.partyLine}>
                {l}
              </Text>
            ))}
            <Text style={[styles.partyLine, { marginTop: 6 }]}>
              Period: {periodLabel}
            </Text>
          </View>
        </View>

        {/* table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, colDate]}>Date</Text>
          <Text style={[styles.th, colDesc]}>Description</Text>
          <Text style={[styles.th, colAmount]}>Amount</Text>
          <Text style={[styles.th, colBalance]}>Balance</Text>
        </View>

        {/* opening */}
        <View style={styles.tableRow}>
          <Text style={[styles.td, colDate]}>
            {stmt.periodFrom ? formatDate(stmt.periodFrom) : "—"}
          </Text>
          <Text style={[styles.td, colDesc]}>Balance brought forward</Text>
          <Text style={[styles.td, colAmount]}>—</Text>
          <Text style={[styles.td, colBalance, bold]}>
            {formatMoney(stmt.openingBalance, stmt.currency)}
          </Text>
        </View>

        {stmt.lines.map((l, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.td, colDate]}>{formatDate(l.date)}</Text>
            <View style={colDesc}>
              <Text style={styles.td}>{l.title}</Text>
              {l.sub ? <Text style={styles.tdMute}>{l.sub}</Text> : null}
            </View>
            <Text
              style={[
                styles.td,
                colAmount,
                { color: l.amount < 0 ? BRAND.primary : BRAND.ink },
              ]}
            >
              {signed(l.amount, stmt.currency)}
            </Text>
            <Text style={[styles.td, colBalance]}>
              {formatMoney(l.balance, stmt.currency)}
            </Text>
          </View>
        ))}

        {stmt.lines.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={[styles.tdMute, { flex: 1 }]}>
              No activity in this period.
            </Text>
          </View>
        ) : null}

        {/* totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total charges</Text>
            <Text style={styles.totalsValue}>
              {formatMoney(stmt.totalCharges, stmt.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total payments & credits</Text>
            <Text style={styles.totalsValue}>
              -{formatMoney(stmt.totalPayments, stmt.currency)}
            </Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>{stmt.balanceLabel}</Text>
            <Text style={styles.grandTotalValue}>
              {formatMoney(stmt.closingBalance, stmt.currency)}
            </Text>
          </View>
          {stmt.vatIncluded != null ? (
            <View style={[styles.totalsRow, { marginTop: 6 }]}>
              <Text style={styles.totalsLabel}>
                VAT included ({stmt.vatRate ?? 15}%)
              </Text>
              <Text style={styles.totalsValue}>
                {formatMoney(stmt.vatIncluded, stmt.currency)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>About this statement</Text>
          <Text style={styles.notesBody}>
            A summary of account activity for the period shown. Amounts are a
            running balance; a positive balance is owed, a negative balance is
            in credit. This statement is a summary, not a tax invoice.
          </Text>
        </View>

        <Text style={styles.footer}>
          Generated by {stmt.brandName} · {stmt.reference} ·{" "}
          {formatDate(stmt.issuedAt)}
        </Text>
      </Page>
    </Document>
  );
}

const colDate = { flex: 1.5 } as const;
const colDesc = { flex: 3.6 } as const;
const colAmount = { flex: 1.6, textAlign: "right" as const };
const colBalance = { flex: 1.6, textAlign: "right" as const };
const bold = { fontFamily: "Helvetica-Bold" } as const;
