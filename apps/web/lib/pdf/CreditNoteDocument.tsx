import { BRAND, formatDate, formatMoney } from "./styles";
import {
  buildIssuerFromHost,
  type InvoiceBanking,
  type InvoiceBusiness,
} from "./InvoiceDocument";
import {
  PdfPaper,
  type PdfCell,
  type PdfColumn,
  type PdfNote,
} from "./PdfPaper";

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
  /** A positive money movement (an upward adjustment) — prints "+" rather than
   *  the default "-". */
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
  const c = note.currency;
  const kind = note.docKind ?? "Credit note";
  // ASCII hyphen — Helvetica has no U+2212 MINUS SIGN glyph (it renders blank).
  const sign = note.positive ? "+" : "-";
  const issuer = buildIssuerFromHost(note.host, note.logoUrl);

  const balanceLabel =
    kind.toLowerCase() === "refund"
      ? "Amount Refunded"
      : kind.toLowerCase() === "adjustment"
        ? "Adjustment"
        : "Credit Amount";

  const columns: PdfColumn[] = [
    { label: "#", flex: 0.4, align: "center" },
    { label: "Item & Description", flex: 5, align: "left" },
    { label: note.positive ? "Amount" : "Credited", flex: 1.6, align: "right" },
  ];
  const rows: PdfCell[][] = note.lines.map((l, i) => [
    { text: String(i + 1), align: "center", color: BRAND.mute },
    { text: l.label, align: "left" },
    { text: formatMoney(l.amount, c), align: "right", bold: true },
  ]);

  const notes: PdfNote[] = note.reason
    ? [
        { title: "Reason", body: note.reason },
        {
          title: "Notes",
          body:
            kind.toLowerCase() === "refund"
              ? "This refund has been processed to the original payment method. Please allow a few business days for it to reflect."
              : "This credit note reduces the amount owed on the related invoice.",
        },
      ]
    : [
        {
          title: "Notes",
          body: "This credit note reduces the amount owed on the related invoice. Keep it for your records.",
        },
      ];

  return (
    <PdfPaper
      kind={kind}
      number={note.creditNoteNumber}
      brandName={note.brandName}
      issuer={issuer}
      billTo={{
        label: note.toLabel ?? "Credited to",
        name: note.guest.name ?? "—",
        lines: [note.guest.email, note.guest.phone].filter(Boolean) as string[],
      }}
      facts={[
        { label: "Issue date", value: formatDate(note.issuedAt) },
        ...(note.invoiceNumber
          ? [{ label: "Against invoice", value: note.invoiceNumber }]
          : []),
      ]}
      balance={{
        label: balanceLabel,
        value: `${sign}${formatMoney(note.total, c)}`,
        positive: note.positive,
      }}
      columns={columns}
      rows={rows}
      totals={[]}
      grand={{
        label: note.totalLabel ?? "Total credited",
        value: `${sign}${formatMoney(note.total, c)}`,
      }}
      notes={notes}
      thanks={{
        title:
          kind.toLowerCase() === "refund"
            ? "Your refund is on its way."
            : "Your account has been credited.",
        subtitle: note.host.email
          ? `Questions? Contact ${note.host.email}.`
          : undefined,
      }}
      runningFooter={{
        left: `${issuer.name} · ${kind} ${note.creditNoteNumber}`,
        right: `Issued via ${note.brandName} · wielo.co.za`,
      }}
    />
  );
}
