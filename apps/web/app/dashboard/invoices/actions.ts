"use server";

import { revalidatePath } from "next/cache";

import { renderInvoicePdf } from "@/lib/pdf/render";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function assertOwnership(
  invoiceId: string,
): Promise<
  { ok: true; hostId: string; userId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("host_id, host:hosts!inner ( user_id )")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { ok: false, error: "Invoice not found." };

  const ownerId = (invoice as unknown as { host: { user_id: string } }).host
    .user_id;
  if (ownerId !== user.id) return { ok: false, error: "Not your invoice." };
  return { ok: true, hostId: invoice.host_id as string, userId: user.id };
}

export async function markInvoicePaidAction(
  invoiceId: string,
  paid: boolean,
): Promise<ActionResult> {
  const own = await assertOwnership(invoiceId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      status: paid ? "paid" : "issued",
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: "Could not update invoice status." };

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
  return { ok: true };
}

type InvoiceLineSnapshot = {
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

export async function generateInvoicePdfAction(
  invoiceId: string,
): Promise<ActionResult<{ storagePath: string }>> {
  const own = await assertOwnership(invoiceId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, issued_at, currency, subtotal, vat_amount, total_amount, host_snapshot, guest_snapshot, line_items, pdf_storage_path",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { ok: false, error: "Invoice not found." };

  const lines = invoice.line_items as InvoiceLineSnapshot;
  const lineRows: {
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[] = [];

  // Whole-listing or rooms-scoped base.
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

  type Snap = {
    display_name?: string;
    handle?: string;
    email?: string;
    phone?: string;
  };
  type GuestSnap = { name?: string; email?: string; phone?: string };
  const host = invoice.host_snapshot as Snap;
  const guest = invoice.guest_snapshot as GuestSnap;

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

  // Upload via service-role client (the host doesn't have insert RLS on the
  // private invoice-pdfs bucket).
  const storage = createAdminClient();
  const storagePath = `${invoice.id}/${invoice.invoice_number}.pdf`;
  const { error: upErr } = await storage.storage
    .from("invoice-pdfs")
    .upload(storagePath, buffer, {
      cacheControl: "3600",
      upsert: true,
      contentType: "application/pdf",
    });
  if (upErr) {
    return { ok: false, error: "PDF upload failed." };
  }

  await supabase
    .from("invoices")
    .update({ pdf_storage_path: storagePath })
    .eq("id", invoice.id);

  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  return { ok: true, data: { storagePath } };
}
