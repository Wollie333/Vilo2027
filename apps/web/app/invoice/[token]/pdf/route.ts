import { NextResponse } from "next/server";

import { renderInvoicePdf } from "@/lib/pdf/render";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Lines = {
  listing_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  scope: string;
  base_amount: number;
  cleaning_fee: number;
  rooms: { room_name: string; base_amount: number; cleaning_fee: number }[];
  addons: {
    label: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
};

type Snap = {
  display_name?: string;
  handle?: string;
  email?: string;
  phone?: string;
};
type GuestSnap = { name?: string; email?: string; phone?: string };

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "invoice_number, status, issued_at, currency, subtotal, vat_amount, total_amount, host_snapshot, guest_snapshot, line_items",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!invoice) {
    return new NextResponse("Not found", { status: 404 });
  }

  const lines = invoice.line_items as Lines;
  const host = invoice.host_snapshot as Snap;
  const guest = invoice.guest_snapshot as GuestSnap;

  const lineRows: {
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[] = [];
  if (
    lines.scope === "rooms" &&
    Array.isArray(lines.rooms) &&
    lines.rooms.length > 0
  ) {
    for (const r of lines.rooms) {
      lineRows.push({
        description: `${lines.listing_name ?? "Stay"} — ${r.room_name}`,
        quantity: 1,
        unit_price: r.base_amount,
        subtotal: r.base_amount,
      });
      if (r.cleaning_fee > 0) {
        lineRows.push({
          description: `Cleaning — ${r.room_name}`,
          quantity: 1,
          unit_price: r.cleaning_fee,
          subtotal: r.cleaning_fee,
        });
      }
    }
  } else {
    lineRows.push({
      description: `${lines.listing_name ?? "Stay"} — base`,
      quantity: 1,
      unit_price: lines.base_amount,
      subtotal: lines.base_amount,
    });
    if (lines.cleaning_fee > 0) {
      lineRows.push({
        description: "Cleaning",
        quantity: 1,
        unit_price: lines.cleaning_fee,
        subtotal: lines.cleaning_fee,
      });
    }
  }
  for (const a of lines.addons ?? []) {
    lineRows.push({
      description: a.label,
      quantity: a.quantity,
      unit_price: a.unit_price,
      subtotal: a.subtotal,
    });
  }

  const buffer = await renderInvoicePdf({
    invoiceNumber: invoice.invoice_number,
    status: invoice.status as "draft" | "issued" | "paid" | "cancelled",
    issuedAt: invoice.issued_at,
    host: {
      displayName: host.display_name ?? null,
      handle: host.handle ?? null,
      email: host.email ?? null,
      phone: host.phone ?? null,
    },
    guest: {
      name: guest.name ?? null,
      email: guest.email ?? null,
      phone: guest.phone ?? null,
    },
    stay: {
      listingName: lines.listing_name,
      checkIn: lines.check_in,
      checkOut: lines.check_out,
      nights: lines.nights,
    },
    lines: lineRows,
    subtotal: invoice.subtotal,
    vatAmount: invoice.vat_amount,
    totalAmount: invoice.total_amount,
    currency: invoice.currency,
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
