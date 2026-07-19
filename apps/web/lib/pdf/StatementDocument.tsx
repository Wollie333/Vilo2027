import { BRAND, formatDate, formatMoney } from "./styles";
import { initials } from "./InvoiceDocument";
import {
  PdfPaper,
  type PdfCell,
  type PdfColumn,
  type PdfMark,
} from "./PdfPaper";

// A Statement of Account (F4) — a running ledger between two parties over a
// period. Rendered on the shared PdfPaper: a Date · Transaction · Amount ·
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
  // ASCII hyphen — Helvetica has no U+2212 MINUS SIGN glyph.
  return amount > 0 ? `+${mag}` : `-${mag}`;
}

export function StatementDocument({ stmt }: { stmt: StatementPdfProps }) {
  const c = stmt.currency;
  const periodLabel = stmt.periodFrom
    ? `${formatDate(stmt.periodFrom)} – ${formatDate(stmt.periodTo)}`
    : `All activity to ${formatDate(stmt.periodTo)}`;
  const mark: PdfMark = stmt.logoUrl
    ? { kind: "logo", url: stmt.logoUrl }
    : { kind: "initials", text: initials(stmt.issuer.name) };

  const columns: PdfColumn[] = [
    { label: "Date", flex: 1.5, align: "left" },
    { label: "Transaction", flex: 3.6, align: "left" },
    { label: "Amount", flex: 1.6, align: "right" },
    { label: "Balance", flex: 1.6, align: "right" },
  ];

  const rows: PdfCell[][] = [
    [
      {
        text: stmt.periodFrom ? formatDate(stmt.periodFrom) : "—",
        align: "left",
      },
      { text: "Balance brought forward", align: "left" },
      { text: "—", align: "right", color: BRAND.mute },
      {
        text: formatMoney(stmt.openingBalance, c),
        align: "right",
        bold: true,
      },
    ],
    ...stmt.lines.map((l): PdfCell[] => [
      { text: formatDate(l.date), align: "left" },
      { text: l.title, sub: l.sub, align: "left" },
      {
        text: signed(l.amount, c),
        align: "right",
        color: l.amount < 0 ? BRAND.primary : BRAND.ink,
      },
      { text: formatMoney(l.balance, c), align: "right" },
    ]),
  ];
  if (stmt.lines.length === 0) {
    rows.push([
      { text: "", align: "left" },
      { text: "No activity in this period.", align: "left", color: BRAND.mute },
      { text: "", align: "right" },
      { text: "", align: "right" },
    ]);
  }

  return (
    <PdfPaper
      kind="Statement"
      number={stmt.reference}
      brandName={stmt.brandName}
      issuer={{ mark, name: stmt.issuer.name, metaLines: stmt.issuer.lines }}
      billTo={{
        label: stmt.recipientLabel,
        name: stmt.recipient.name,
        lines: stmt.recipient.lines,
      }}
      facts={[
        { label: "Statement date", value: formatDate(stmt.issuedAt) },
        { label: "Period", value: periodLabel },
        { label: "Currency", value: c },
      ]}
      balance={{
        label: stmt.balanceLabel,
        value: formatMoney(stmt.closingBalance, c),
        positive: stmt.closingBalance <= 0,
      }}
      summary={[
        { label: "Opening", value: formatMoney(stmt.openingBalance, c) },
        { label: "Charges", value: formatMoney(stmt.totalCharges, c) },
        {
          label: "Payments & Credits",
          value: `-${formatMoney(stmt.totalPayments, c)}`,
        },
        { label: "Closing", value: formatMoney(stmt.closingBalance, c) },
      ]}
      columns={columns}
      rows={rows}
      totals={[
        { label: "Total charges", value: formatMoney(stmt.totalCharges, c) },
        {
          label: "Total payments & credits",
          value: `-${formatMoney(stmt.totalPayments, c)}`,
        },
        ...(stmt.vatIncluded != null
          ? [
              {
                label: `VAT included${stmt.vatRate != null ? ` (${stmt.vatRate}%)` : ""}`,
                value: formatMoney(stmt.vatIncluded, c),
                mute: true,
              },
            ]
          : []),
      ]}
      grand={{
        label: stmt.balanceLabel,
        value: formatMoney(stmt.closingBalance, c),
      }}
      notes={[
        {
          title: "About this statement",
          body: "A summary of account activity for the period shown as a running balance — a positive balance is owed, a negative balance is in credit. This is a summary, not a tax invoice.",
        },
      ]}
      thanks={{
        title: "Statement of account",
        subtitle: `Reference ${stmt.reference}.`,
      }}
      runningFooter={{
        left: `${stmt.issuer.name} · Statement ${stmt.reference}`,
        right: `Issued via ${stmt.brandName} · wielo.co.za`,
      }}
    />
  );
}
