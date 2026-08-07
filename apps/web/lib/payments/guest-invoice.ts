import "server-only";

import type { createServerClient } from "@/lib/supabase/server";

/**
 * The guest-facing download path for a booking's STAY invoice — the confirm-time
 * `kind: 'booking'` invoice the DB trigger mints into `invoices` (the same
 * document that appears in the host ledger). Returns
 * `/invoice/{hosted_token}/pdf` — a public, token-gated PDF route where the
 * hosted_token IS the capability — or null when no such invoice exists yet.
 *
 * Reads through the caller's user-scoped client: RLS `guest_read_own_invoices`
 * (`guest_id = auth.uid()`) already limits this to the guest's own invoice.
 * Callers should only surface the link once the booking is confirmed AND paid in
 * full, so an unpaid hold never offers a "paid" document.
 */
export async function getGuestInvoicePath(
  supabase: ReturnType<typeof createServerClient>,
  bookingId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("invoices")
    .select("hosted_token")
    .eq("booking_id", bookingId)
    .eq("kind", "booking")
    .not("hosted_token", "is", null)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = (data as { hosted_token: string | null } | null)?.hosted_token;
  return token ? `/invoice/${token}/pdf` : null;
}
