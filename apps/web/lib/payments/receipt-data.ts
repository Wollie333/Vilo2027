import "server-only";

import { getHostParty, type DocHostParty } from "@/lib/finance/doc-party";
import type { InvoiceBusiness } from "@/lib/pdf/InvoiceDocument";
import { createAdminClient } from "@/lib/supabase/admin";

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  addon: "Add-on",
  payment: "Payment",
  credit: "Store credit",
  refund: "Refund",
};

export type ReceiptData = {
  receiptNumber: string;
  paidAt: string;
  method: string;
  kindLabel: string;
  amount: number;
  currency: string;
  bookingId: string;
  bookingRef: string | null;
  balanceAfter: number | null;
  hostId: string;
  party: DocHostParty;
  host: {
    displayName: string | null;
    handle: string | null;
    email: string | null;
    phone: string | null;
    business: InvoiceBusiness | null;
  };
  guest: { name: string | null; email: string | null; phone: string | null };
  stay: {
    listingName: string | null;
    checkIn: string | null;
    checkOut: string | null;
  };
};

type Snap = {
  display_name?: string;
  handle?: string;
  email?: string;
  phone?: string;
  business?: InvoiceBusiness | null;
};
type GuestSnap = { name?: string; email?: string; phone?: string };

/** Load a completed payment's receipt by its public token (or null). */
export async function getReceiptByToken(
  token: string,
): Promise<ReceiptData | null> {
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("payments")
    .select(
      "id, amount, currency, method, kind, status, captured_at, created_at, receipt_number, booking_id",
    )
    .eq("receipt_token", token)
    .maybeSingle();
  if (!p || p.status !== "completed" || !p.receipt_number) return null;

  const { data: b } = await admin
    .from("bookings")
    .select(
      "id, host_id, reference, balance_due, check_in, check_out, guest_id, guest_name, guest_email, guest_phone, listing:properties ( name, business_id )",
    )
    .eq("id", p.booking_id)
    .maybeSingle();
  if (!b) return null;

  // Prefer the frozen booking-invoice snapshots; fall back to live host row.
  const { data: inv } = await admin
    .from("invoices")
    .select("host_snapshot, guest_snapshot")
    .eq("booking_id", b.id)
    .eq("kind", "booking")
    .maybeSingle();

  let host: Snap | null = (inv?.host_snapshot as Snap) ?? null;
  if (!host) {
    const { data: h } = await admin
      .from("hosts")
      .select("display_name, handle, user_id")
      .eq("id", b.host_id)
      .maybeSingle();
    let hEmail: string | undefined;
    let hPhone: string | undefined;
    if (h?.user_id) {
      const { data: up } = await admin
        .from("user_profiles")
        .select("email, phone")
        .eq("id", h.user_id)
        .maybeSingle();
      hEmail = up?.email ?? undefined;
      hPhone = up?.phone ?? undefined;
    }
    host = {
      display_name: h?.display_name,
      handle: h?.handle,
      email: hEmail,
      phone: hPhone,
    };
  }
  const guest: GuestSnap = (inv?.guest_snapshot as GuestSnap) ?? {
    name: b.guest_name ?? undefined,
    email: b.guest_email ?? undefined,
    phone: b.guest_phone ?? undefined,
  };

  const bListing = Array.isArray(b.listing) ? b.listing[0] : b.listing;
  const listingName = (bListing as { name?: string } | null)?.name;
  const bBusinessId =
    (bListing as { business_id?: string | null } | null)?.business_id ?? null;

  const party = await getHostParty(
    admin,
    b.host_id,
    b.reference ?? null,
    undefined,
    bBusinessId,
  );

  return {
    party,
    receiptNumber: p.receipt_number,
    paidAt: (p.captured_at ?? p.created_at) as string,
    method: p.method as string,
    kindLabel: KIND_LABEL[p.kind as string] ?? "Payment",
    amount: Number(p.amount),
    currency: p.currency as string,
    bookingId: b.id,
    bookingRef: b.reference ?? null,
    balanceAfter: b.balance_due != null ? Number(b.balance_due) : null,
    hostId: b.host_id,
    host: {
      displayName: host.display_name ?? null,
      handle: host.handle ?? null,
      email: host.email ?? null,
      phone: host.phone ?? null,
      business: host.business ?? null,
    },
    guest: {
      name: guest.name ?? null,
      email: guest.email ?? null,
      phone: guest.phone ?? null,
    },
    stay: {
      listingName: listingName ?? null,
      checkIn: b.check_in,
      checkOut: b.check_out,
    },
  };
}
