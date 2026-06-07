"use server";

import { revalidatePath } from "next/cache";

import { createAddonInvoice } from "@/lib/payments/invoicing";
import { recomputeBookingPaymentState } from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type GuestAddonResult = { ok: true } | { ok: false; error: string };

const ADDABLE_STATUSES = ["confirmed", "checked_in", "pending", "pending_eft"];

/**
 * Guest adds an extra to their OWN existing booking. The price is ALWAYS resolved
 * from the host's catalogue server-side (never trusted from the client). The
 * extra joins the booking (source=guest_added), the total grows, a supplementary
 * 'addon' invoice is issued (unpaid), and the balance rises for the host to
 * collect. Runs via the service role after verifying the booking is the caller's.
 */
export async function addGuestBookingAddonAction(input: {
  bookingId: string;
  addonId: string;
  quantity: number;
}): Promise<GuestAddonResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, host_id, listing_id, guest_id, status, total_amount")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.guest_id !== user.id) {
    return { ok: false, error: "Not your booking." };
  }
  if (!ADDABLE_STATUSES.includes(booking.status as string)) {
    return { ok: false, error: "You can't add extras to this booking." };
  }

  // Resolve the add-on from the host's catalogue — price is authoritative here.
  const { data: addon } = await admin
    .from("addons")
    .select(
      "id, name, unit_price, host_id, is_active, min_quantity, max_quantity",
    )
    .eq("id", input.addonId)
    .eq("host_id", booking.host_id)
    .maybeSingle();
  if (!addon || !addon.is_active) {
    return { ok: false, error: "That add-on isn't available." };
  }

  // It must actually be offered on this listing (whole-listing scope).
  const { data: link } = await admin
    .from("listing_addons")
    .select("unit_price_override")
    .eq("listing_id", booking.listing_id)
    .eq("addon_id", addon.id)
    .is("room_id", null)
    .maybeSingle();
  if (!link) {
    return { ok: false, error: "That add-on isn't available for this stay." };
  }

  const unitPrice =
    link.unit_price_override != null
      ? Number(link.unit_price_override)
      : Number(addon.unit_price);
  const minQ = addon.min_quantity ?? 1;
  const maxQ = addon.max_quantity ?? 99;
  const qty = Math.min(
    maxQ,
    Math.max(minQ, Math.round(Number(input.quantity) || 1)),
  );
  const subtotal = Math.round(unitPrice * qty * 100) / 100;

  const { data: existing } = await admin
    .from("booking_addons")
    .select("sort_order")
    .eq("booking_id", booking.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sort = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data: row, error: addErr } = await admin
    .from("booking_addons")
    .insert({
      booking_id: booking.id,
      label: addon.name,
      quantity: qty,
      unit_price: unitPrice,
      subtotal,
      sort_order: sort,
      source: "guest_added",
      added_by: user.id,
      created_at_tx: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (addErr || !row) return { ok: false, error: "Could not add the extra." };

  await admin
    .from("bookings")
    .update({
      total_amount:
        Math.round((Number(booking.total_amount) + subtotal) * 100) / 100,
    })
    .eq("id", booking.id);

  const invoiceId = await createAddonInvoice(admin, {
    bookingId: booking.id,
    lines: [
      { label: addon.name, quantity: qty, unit_price: unitPrice, subtotal },
    ],
    paymentId: null,
    paid: false,
  });
  if (invoiceId) {
    await admin
      .from("booking_addons")
      .update({ invoice_id: invoiceId })
      .eq("id", row.id);
  }

  await recomputeBookingPaymentState(admin, booking.id);

  revalidatePath(`/portal/trips/${booking.id}`);
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}
