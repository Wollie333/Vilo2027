import { NextResponse } from "next/server";

import {
  getPlatformInvoiceBanking,
  wieloLogoDataUri,
  wieloSnapshotToBusiness,
  type WieloBusinessProfile,
} from "@/lib/billing/wielo-invoice";
import { getBrandName } from "@/lib/brand";
import { renderInvoicePdf } from "@/lib/pdf/render";
import { formatDate } from "@/lib/pdf/styles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};
type BuyerSnap = { name?: string | null; email?: string | null };

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("wielo_invoices")
    .select(
      "invoice_number, status, issued_at, paid_at, currency, subtotal, vat_amount, total_amount, wielo_snapshot, buyer_snapshot, line_items",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!invoice) {
    return new NextResponse("Not found", { status: 404 });
  }

  const snap = (invoice.wielo_snapshot ?? {}) as Partial<WieloBusinessProfile>;
  const buyer = (invoice.buyer_snapshot ?? {}) as BuyerSnap;
  const lines = (
    Array.isArray(invoice.line_items) ? invoice.line_items : []
  ) as LineItem[];
  // Wielo's bank details always print on the invoice PDF; the payment reference
  // is always the invoice number (rendered by the PDF banking block).
  const banking = await getPlatformInvoiceBanking(invoice.invoice_number);
  const brandName = await getBrandName();
  const isPaid = invoice.status === "paid";
  const logoUrl = await wieloLogoDataUri();
  const issuerName = snap.legal_name?.trim() || brandName;
  const legalLine =
    issuerName.toLowerCase() === brandName.toLowerCase()
      ? null
      : `${issuerName} trading as ${brandName}`;

  const buffer = await renderInvoicePdf({
    invoiceNumber: invoice.invoice_number,
    status: invoice.status as "draft" | "issued" | "paid" | "cancelled",
    issuedAt: invoice.issued_at,
    facts: [
      { label: "Invoice date", value: formatDate(invoice.issued_at) },
      ...(isPaid && invoice.paid_at
        ? [{ label: "Paid on", value: formatDate(invoice.paid_at) }]
        : []),
      { label: "Account", value: buyer.email ?? "—" },
    ],
    host: {
      displayName: snap.legal_name ?? null,
      handle: null,
      email: snap.email ?? null,
      phone: null,
      banking,
      business: wieloSnapshotToBusiness(snap),
    },
    guest: {
      name: buyer.name ?? null,
      email: buyer.email ?? null,
      phone: null,
    },
    stay: null,
    lines: lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      subtotal: l.subtotal,
    })),
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vat_amount ?? 0),
    totalAmount: Number(invoice.total_amount),
    currency: invoice.currency,
    notes: [
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
    ],
    thanks: {
      title: `Thank you for choosing ${brandName}.`,
      subtitle: snap.email
        ? `Questions about this invoice? Contact ${snap.email}.`
        : "Keep this invoice for your records.",
    },
    legalLine,
    logoUrl,
    // No custom Wielo logo uploaded → show the Wielo roundel, not "MP" initials.
    fallbackMark: { kind: "wielo" },
    brandName,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
