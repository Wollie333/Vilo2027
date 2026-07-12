// Cancellation settlement — the ONE place that turns a cancellation (or a no-show
// forfeiture) into correct, VAT-aware accounting.
//
// Principle (SARS/IFRS): don't void an issued tax invoice — reverse the cancelled
// portion with a CREDIT NOTE. For a booking total T, net paid P and refund R
// (0 ≤ R ≤ P, policy-suggested and host-overridable):
//   • retained (cancellation fee, kept as revenue, VAT included) = P − R
//   • outstanding written off (never collected)                  = max(0, T − P)
//   • credit note (the reversed portion)                          = (T − P) + R = T − retained
//   • cash refunded to the guest                                  = R
// Ledger check (owedEffect): invoice +T, payment −P, credit note −((T−P)+R),
// refund +R  ⇒  net guest balance = 0, and net invoiced (T − CN) = retained.
// No-show forfeiture is exactly this with R = 0 (retain everything paid).
//
// Server-only; callers verify ownership and pass the service-role admin client.

import { round2 } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type Settlement = {
  /** Booking total (VAT-inclusive). */
  total: number;
  /** Net captured = Σ(amount − refunded_amount). */
  paid: number;
  /** Cash refunded to the guest (clamped to [0, paid]). */
  refund: number;
  /** Kept by the host as the cancellation fee (revenue, VAT included). */
  retained: number;
  /** Outstanding balance never collected, written off. */
  writtenOff: number;
  /** The credit note that reverses the cancelled portion (0 → mint nothing). */
  creditNoteAmount: number;
};

/** Pure settlement maths for a cancellation given the chosen refund. */
export function computeSettlement(
  total: number,
  paid: number,
  refund: number,
): Settlement {
  const T = round2(total);
  const P = round2(Math.max(0, paid));
  const R = round2(Math.min(Math.max(0, refund), P));
  return {
    total: T,
    paid: P,
    refund: R,
    retained: round2(P - R),
    writtenOff: round2(Math.max(0, T - P)),
    creditNoteAmount: round2(Math.max(0, T - P) + R),
  };
}

/**
 * Mint the cancellation credit note that reverses the cancelled portion of a
 * booking's invoice. Uses the booking's live invoice for snapshots + numbering.
 * origin='cancellation' so the ledger reduces the receivable but NO spendable
 * store credit is posted (that's 'manual' only). Returns the CN number, or null
 * when there's nothing to reverse / no invoice to credit.
 */
export async function mintCancellationCreditNote(
  admin: Admin,
  args: {
    bookingId: string;
    hostId: string;
    guestId: string | null;
    currency: string;
    amount: number;
    vatRate: number;
    reason: string;
  },
): Promise<string | null> {
  if (args.amount <= 0) return null;

  // The booking's live (non-voided) invoice anchors the credit note: FK invoice_id
  // is NOT NULL, and the frozen host/guest snapshots + business come from it.
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, host_snapshot, guest_snapshot, booking_id")
    .eq("booking_id", args.bookingId)
    .eq("kind", "booking")
    .is("voided_at", null)
    .order("issued_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!invoice) return null; // never-invoiced (still pending) → no charge to reverse

  // Business behind the booking's listing drives the CN number; fall back to the
  // host's default business.
  let businessId: string | null = null;
  const { data: bk } = await admin
    .from("bookings")
    .select("listing:properties ( business_id )")
    .eq("id", args.bookingId)
    .maybeSingle();
  const l = Array.isArray(bk?.listing) ? bk?.listing[0] : bk?.listing;
  businessId =
    (l as { business_id?: string | null } | null)?.business_id ?? null;
  if (!businessId) {
    const { data: defBiz } = await admin
      .from("businesses")
      .select("id")
      .eq("host_id", args.hostId)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle();
    businessId = defBiz?.id ?? null;
  }
  if (!businessId) return null;

  const { data: number } = await admin.rpc("next_credit_note_number", {
    p_business_id: businessId,
  });
  if (!number) return null;

  // VAT extracted from the inclusive credit-note amount at the booking's rate.
  const rate = Number(args.vatRate ?? 0);
  const total = round2(args.amount);
  const vat = rate > 0 ? round2(total - total / (1 + rate / 100)) : 0;
  const subtotal = round2(total - vat);

  const { data: inserted, error } = await admin
    .from("credit_notes")
    .insert({
      credit_note_number: number as unknown as string,
      invoice_id: invoice.id,
      booking_id: args.bookingId,
      host_id: args.hostId,
      guest_id: args.guestId,
      host_snapshot: invoice.host_snapshot,
      guest_snapshot: invoice.guest_snapshot,
      line_items: [{ label: args.reason, amount: total }],
      reason: args.reason,
      subtotal,
      vat_amount: vat,
      total_amount: total,
      currency: args.currency,
      origin: "cancellation",
      status: "issued",
    })
    .select("credit_note_number")
    .single();
  if (error || !inserted) return null;
  // NB: deliberately NO guest_credit_ledger post — a cancellation reversal is not
  // spendable store credit (that's the 'manual' path).
  return inserted.credit_note_number as string;
}
