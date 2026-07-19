import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialDocument,
  type DocLine,
} from "@/components/finance/FinancialDocument";
import {
  getPlatformInvoiceBanking,
  wieloIssuerLines,
  type WieloBusinessProfile,
} from "@/lib/billing/wielo-invoice";
import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};
type BuyerSnap = { name?: string | null; email?: string | null };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function PublicWieloInvoicePage({
  params,
}: {
  params: { token: string; locale: string };
}) {
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("wielo_invoices")
    .select(
      "invoice_number, status, issued_at, paid_at, subtotal, vat_amount, total_amount, currency, wielo_snapshot, buyer_snapshot, line_items, hosted_token",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!invoice) notFound();

  const brandName = await getBrandName();
  const c = invoice.currency;
  const issuer = wieloIssuerLines(
    (invoice.wielo_snapshot ?? {}) as Partial<WieloBusinessProfile>,
  );
  const buyer = (invoice.buyer_snapshot ?? {}) as BuyerSnap;
  const lines = (
    Array.isArray(invoice.line_items) ? invoice.line_items : []
  ) as LineItem[];
  const vat = Number(invoice.vat_amount ?? 0);
  const isTaxInvoice = vat > 0.005;
  const isPaid = invoice.status === "paid";
  // Wielo's bank details always print on the invoice (bottom-left card). The
  // payment reference is always the invoice number (rendered by the card).
  const banking = await getPlatformInvoiceBanking(invoice.invoice_number);

  const lineRows: DocLine[] = lines.map((l) => ({
    title: l.description,
    qty: String(l.quantity),
    rate: formatMoney(l.unit_price, c),
    amount: formatMoney(l.subtotal, c),
  }));

  return (
    <FinancialDocument
      kind={isTaxInvoice ? "Tax Invoice" : "Invoice"}
      number={invoice.invoice_number}
      status={{
        label: isPaid ? "Paid" : "Issued",
        tone: isPaid ? "green" : "amber",
      }}
      brandName={brandName}
      brandTagline="Direct booking platform"
      from={issuer}
      fromMark={{ kind: "wielo" }}
      to={{
        label: "Billed to",
        party: {
          name: buyer.name ?? "Customer",
          lines: [buyer.email].filter(Boolean) as string[],
        },
      }}
      balance={{
        label: isPaid ? "Amount Paid" : "Balance Due",
        value: formatMoney(invoice.total_amount, c),
        positive: isPaid,
      }}
      metaRows={[
        { label: "Issue date", value: fmtDate(invoice.issued_at) },
        ...(invoice.paid_at
          ? [{ label: "Paid on", value: fmtDate(invoice.paid_at) }]
          : []),
        { label: "Account", value: buyer.email ?? "—" },
      ]}
      lineHeaders={{
        desc: "Item & Description",
        qty: "Qty",
        rate: "Rate",
        amount: "Amount",
      }}
      lines={lineRows}
      totals={[
        { label: "Subtotal", value: formatMoney(invoice.subtotal, c) },
        ...(isTaxInvoice
          ? [{ label: "VAT (15%)", value: formatMoney(vat, c) }]
          : []),
      ]}
      grandTotal={{
        label: isPaid ? "Total paid" : "Total due",
        value: formatMoney(invoice.total_amount, c),
      }}
      banking={banking}
      bankingLabel={isPaid ? "Banking details" : "Payment details"}
      notes={[
        {
          title: "Notes",
          body: isPaid
            ? `This is your ${brandName} subscription invoice, settled in full. Your plan renews automatically and is charged to the payment method on file. Zero commission on every booking you take — always.`
            : `This is your ${brandName} subscription invoice. Your plan renews automatically each cycle and is charged to the payment method on file. Zero commission on every booking you take — always.`,
        },
        {
          title: "Terms & Conditions",
          body: "Subscriptions are billed in advance each cycle. Cancel anytime before the renewal date. No per-booking fees, ever.",
        },
      ]}
      stamp={isPaid ? "Paid" : null}
      pdfHref={`/${params.locale}/wielo-invoice/${invoice.hosted_token}/pdf`}
      thanks={{
        title: `Thank you for choosing ${brandName}.`,
        subtitle: "Keep this invoice for your records.",
      }}
    />
  );
}
