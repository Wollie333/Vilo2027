import { BRAND, formatDate, formatMoney } from "./styles";
import { buildIssuerFromHost, type InvoiceBusiness } from "./InvoiceDocument";
import {
  PdfPaper,
  type PdfCell,
  type PdfColumn,
  type PdfNote,
} from "./PdfPaper";

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
  const c = receipt.currency;
  const method = receipt.method.replace(/_/g, " ");
  const issuer = buildIssuerFromHost(receipt.host, receipt.logoUrl);

  const columns: PdfColumn[] = [
    { label: "#", flex: 0.4, align: "center" },
    { label: "Item & Description", flex: 5, align: "left" },
    { label: "Amount", flex: 1.6, align: "right" },
  ];
  const rows: PdfCell[][] = [
    [
      { text: "1", align: "center", color: BRAND.mute },
      {
        text: `${receipt.kindLabel} payment`,
        sub: receipt.stay.listingName,
        align: "left",
      },
      { text: formatMoney(receipt.amount, c), align: "right", bold: true },
    ],
  ];

  const notes: PdfNote[] = [
    {
      title: "Notes",
      body: "This receipt confirms payment received against the booking above. Please retain it for your records.",
    },
  ];

  return (
    <PdfPaper
      kind="Receipt"
      number={receipt.receiptNumber}
      brandName={receipt.brandName}
      issuer={issuer}
      billTo={{
        label: "Received from",
        name: receipt.guest.name ?? "—",
        lines: [receipt.guest.email, receipt.guest.phone].filter(
          Boolean,
        ) as string[],
      }}
      facts={[
        { label: "Receipt date", value: formatDate(receipt.paidAt) },
        { label: "Method", value: method },
        ...(receipt.bookingRef
          ? [{ label: "Booking", value: receipt.bookingRef }]
          : []),
      ]}
      balance={{
        label: "Amount Received",
        value: formatMoney(receipt.amount, c),
        positive: true,
      }}
      summary={
        receipt.stay.listingName
          ? [
              { label: "Listing", value: receipt.stay.listingName },
              { label: "Check-in", value: formatDate(receipt.stay.checkIn) },
              { label: "Check-out", value: formatDate(receipt.stay.checkOut) },
            ]
          : null
      }
      columns={columns}
      rows={rows}
      totals={[]}
      grand={{
        label: "Amount received",
        value: formatMoney(receipt.amount, c),
      }}
      dueRows={
        receipt.balanceAfter != null
          ? [
              {
                label: "Balance still due",
                value: formatMoney(receipt.balanceAfter, c),
                color: receipt.balanceAfter > 0 ? BRAND.deep : "#047857",
              },
            ]
          : undefined
      }
      footBox={{
        title: "Payment received",
        rows: [
          { k: "Method", v: method },
          { k: "Received on", v: formatDate(receipt.paidAt) },
          ...(receipt.bookingRef
            ? [{ k: "Reference", v: receipt.bookingRef }]
            : []),
        ],
      }}
      notes={notes}
      thanks={{
        title: "Thank you — payment received.",
        subtitle: receipt.host.email
          ? `Questions about this receipt? Contact ${receipt.host.email}.`
          : undefined,
      }}
      stamp="Received"
      runningFooter={{
        left: `${issuer.name} · Receipt ${receipt.receiptNumber}`,
        right: `Issued via ${receipt.brandName} · wielo.co.za`,
      }}
    />
  );
}
