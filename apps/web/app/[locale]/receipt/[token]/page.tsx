import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialDocument } from "@/components/finance/FinancialDocument";
import { SendDocumentButton } from "@/components/finance/SendDocumentButton";
import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { getReceiptByToken } from "@/lib/payments/receipt-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function ReceiptRecordPage({
  params,
}: {
  params: { token: string; locale: string };
}) {
  const [receipt, brandName] = await Promise.all([
    getReceiptByToken(params.token),
    getBrandName(),
  ]);
  if (!receipt) notFound();

  const c = receipt.currency;
  const toLines = [receipt.guest.email, receipt.guest.phone].filter(
    Boolean,
  ) as string[];

  return (
    <FinancialDocument
      kind="Receipt"
      number={receipt.receiptNumber}
      status={{ label: "Received", tone: "green" }}
      brandName={brandName}
      brandTagline="Proof of payment"
      pdfHref={`/${params.locale}/receipt/${params.token}/pdf`}
      backHref={`/dashboard/bookings/${receipt.bookingId}?tab=payments`}
      viewHref={{
        href: `/dashboard/bookings/${receipt.bookingId}?tab=payments`,
        label: "View booking",
      }}
      actions={
        <SendDocumentButton
          bookingId={receipt.bookingId}
          path={`/receipt/${params.token}`}
          label={`receipt ${receipt.receiptNumber}`}
        />
      }
      from={{ name: receipt.party.name, lines: receipt.party.lines }}
      to={{
        label: "Received from",
        party: { name: receipt.guest.name ?? "Guest", lines: toLines },
      }}
      balance={{
        label: "Amount Received",
        value: formatMoney(receipt.amount, c),
        positive: true,
      }}
      banking={receipt.party.banking}
      metaRows={[
        { label: "Paid on", value: fmtDate(receipt.paidAt) },
        { label: "Method", value: receipt.method.replace(/_/g, " ") },
        { label: "Booking", value: receipt.bookingRef ?? "—" },
      ]}
      stay={
        receipt.stay.listingName
          ? {
              listingName: receipt.stay.listingName,
              checkIn: fmtDate(receipt.stay.checkIn),
              checkOut: fmtDate(receipt.stay.checkOut),
              nights: "—",
            }
          : null
      }
      lineHeaders={{ desc: "Description", amount: "Amount" }}
      lines={[
        {
          title: `${receipt.kindLabel} payment`,
          sub: receipt.stay.listingName,
          amount: formatMoney(receipt.amount, c),
        },
      ]}
      totals={[]}
      grandTotal={{
        label: "Amount received",
        value: formatMoney(receipt.amount, c),
      }}
      trailingTotals={
        receipt.balanceAfter != null
          ? [
              {
                label: "Balance still due",
                value: formatMoney(receipt.balanceAfter, c),
                tone: receipt.balanceAfter > 0 ? "ink" : "good",
              },
            ]
          : undefined
      }
      stamp="Received"
      footerTitle="Thank you for your payment."
      footerNote="Keep this receipt for your records."
    />
  );
}
