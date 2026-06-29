import { NextResponse } from "next/server";

import {
  wieloSnapshotToBusiness,
  type WieloBusinessProfile,
} from "@/lib/billing/wielo-invoice";
import { getBrandName } from "@/lib/brand";
import { renderInvoicePdf } from "@/lib/pdf/render";
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
      "invoice_number, status, issued_at, currency, subtotal, vat_amount, total_amount, wielo_snapshot, buyer_snapshot, line_items",
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

  const buffer = await renderInvoicePdf({
    invoiceNumber: invoice.invoice_number,
    status: invoice.status as "draft" | "issued" | "paid" | "cancelled",
    issuedAt: invoice.issued_at,
    host: {
      displayName: snap.legal_name ?? null,
      handle: null,
      email: snap.email ?? null,
      phone: null,
      banking: null,
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
    logoUrl: null,
    brandName: await getBrandName(),
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
