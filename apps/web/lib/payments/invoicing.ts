// Supplementary add-on invoicing. A post-booking add-on charge gets its OWN
// invoice (kind 'addon') with frozen host + guest snapshots, a per-host invoice
// number, and an optional link to the payment that settled it — mirroring the
// confirm-time 'booking' invoice the trigger mints.
//
// Server-only; callers verify host/guest ownership and pass the service-role
// admin client.

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type AddonLine = {
  label: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

/**
 * Issue a supplementary 'addon' invoice for a booking. Returns the new invoice
 * id, or null on failure (best-effort — the charge itself shouldn't be lost if
 * numbering hiccups, but we surface null so callers can log).
 */
export async function createAddonInvoice(
  admin: Admin,
  args: {
    bookingId: string;
    lines: AddonLine[];
    paymentId?: string | null;
    paid: boolean;
    /** VAT charged on this add-on (0 when the listing isn't VAT-registered). */
    vatAmount?: number;
  },
): Promise<string | null> {
  if (args.lines.length === 0) return null;

  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, host_id, guest_id, guest_name, guest_email, guest_phone, currency, check_in, check_out, listing:properties ( name, business_id )",
    )
    .eq("id", args.bookingId)
    .maybeSingle();
  if (!booking) return null;

  const { data: host } = await admin
    .from("hosts")
    .select("id, display_name, handle, user_id")
    .eq("id", booking.host_id)
    .maybeSingle();
  if (!host) return null;

  // Host contact lives on user_profiles (hosts has no contact_* columns).
  let hostEmail: string | null = null;
  let hostPhone: string | null = null;
  if (host.user_id) {
    const { data: hostProfile } = await admin
      .from("user_profiles")
      .select("email, phone")
      .eq("id", host.user_id)
      .maybeSingle();
    hostEmail = hostProfile?.email ?? null;
    hostPhone = hostProfile?.phone ?? null;
  }

  let guestName = booking.guest_name;
  let guestEmail = booking.guest_email;
  if ((!guestName || !guestEmail) && booking.guest_id) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", booking.guest_id)
      .maybeSingle();
    guestName = guestName ?? profile?.full_name ?? null;
    guestEmail = guestEmail ?? profile?.email ?? null;
  }

  const subtotal =
    Math.round(args.lines.reduce((s, l) => s + Number(l.subtotal), 0) * 100) /
    100;
  const vatAmount = Math.round(Number(args.vatAmount ?? 0) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  const listingRow = (
    Array.isArray(booking.listing) ? booking.listing[0] : booking.listing
  ) as { name?: string; business_id?: string | null } | null;
  const listingName = listingRow?.name;

  // Addon invoice numbers from the listing's business (Phase 3b). The DB
  // booking_business_id() fallback isn't reachable from the RPC, so resolve the
  // host's default business if the listing somehow has none.
  let businessId = listingRow?.business_id ?? null;
  if (!businessId) {
    const { data: defBiz } = await admin
      .from("businesses")
      .select("id")
      .eq("host_id", booking.host_id)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle();
    businessId = defBiz?.id ?? null;
  }
  if (!businessId) return null;

  const { data: number } = await admin.rpc("next_invoice_number", {
    p_business_id: businessId,
  });
  if (!number) return null;

  const now = new Date().toISOString();
  const { data: invoice, error } = await admin
    .from("invoices")
    .insert({
      invoice_number: number as unknown as string,
      booking_id: booking.id,
      host_id: booking.host_id,
      guest_id: booking.guest_id,
      kind: "addon",
      payment_id: args.paymentId ?? null,
      host_snapshot: {
        host_id: host.id,
        display_name: host.display_name,
        handle: host.handle,
        email: hostEmail,
        phone: hostPhone,
      },
      guest_snapshot: {
        guest_id: booking.guest_id,
        name: guestName,
        email: guestEmail,
        phone: booking.guest_phone,
      },
      line_items: {
        kind: "addon",
        listing_name: listingName ?? null,
        check_in: booking.check_in,
        check_out: booking.check_out,
        addons: args.lines,
      },
      subtotal,
      vat_amount: vatAmount,
      total_amount: total,
      currency: booking.currency,
      status: args.paid ? "paid" : "issued",
      issued_at: now,
      paid_at: args.paid ? now : null,
    })
    .select("id")
    .single();
  if (error || !invoice) return null;
  return invoice.id;
}
