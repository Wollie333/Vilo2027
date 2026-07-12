// Force-forfeit a no-show / abandoned booking (founder decision 2026-07-12,
// NEXT_STEPS §F3). A guest who partially paid then vanished: the host keeps what
// was paid (revenue), the outstanding is written off, an immutable Forfeit
// statement (FRF-####) is the paper trail — NO refund request, NO credit note.
//
// Accounting (host ledger is derived in lib/finance/transactions.ts):
//   • void the booking's invoice(s) so their +total charge drops from the ledger;
//   • the forfeit_statements row emits ONE ledger entry, "Forfeited (retained)"
//     = amount_forfeited (owedEffect +1), which nets against the deposit payment
//     → the guest's balance for the booking is exactly 0;
//   • the paid deposit stays a completed payment → still counted as collected
//     revenue; amount_written_off (= total − paid) is documented, not charged.
//   • booking.status → no_show; booking.payment_status → forfeited.
//
// NOT "use server": the calling Server Action authorises host ownership first.

import { dispatchEvent } from "@/lib/notifications/dispatch";
import { round2 } from "@/lib/format";
import { sumCompletedPaid } from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";

import { CANCELLABLE_STATUSES, type CancellationBooking } from "./cancel";

export type ForfeitPreview = {
  currency: string;
  total: number;
  paid: number;
  /** Paid amount the host keeps (= paid; force-forfeit overrides any policy refund). */
  forfeited: number;
  /** Outstanding balance written off (= max(0, total − paid)). */
  writtenOff: number;
  policyName: string | null;
};

/** What a forfeiture WOULD do — drives the confirm dialog ("ask each time"). */
export async function forfeitPreview(
  booking: CancellationBooking,
): Promise<ForfeitPreview> {
  const admin = createAdminClient();
  const total = round2(Number(booking.total_amount));
  const paid = await sumCompletedPaid(admin, booking.id);

  const { data: snap } = await admin
    .from("policy_snapshots")
    .select("policy_name")
    .eq("booking_id", booking.id)
    .eq("policy_type", "cancellation")
    .maybeSingle();

  return {
    currency: booking.currency || "ZAR",
    total,
    paid,
    forfeited: paid,
    writtenOff: round2(Math.max(0, total - paid)),
    policyName: (snap?.policy_name as string | null) ?? null,
  };
}

export type ForfeitResult =
  | { ok: true; statementNumber: string; forfeited: number; writtenOff: number }
  | { ok: false; error: string };

/**
 * Force-forfeit a (pre-authorised) booking. The caller MUST have verified the
 * host owns this booking. Idempotent-ish: refuses if a forfeit statement already
 * exists (one per booking).
 */
export async function finalizeForfeiture(
  booking: CancellationBooking,
  opts: { reason: string | null; actorUserId: string | null },
): Promise<ForfeitResult> {
  if (!CANCELLABLE_STATUSES.includes(booking.status as never)) {
    return {
      ok: false,
      error: `This booking can't be forfeited (it's ${booking.status.replace(
        /_/g,
        " ",
      )}).`,
    };
  }

  const admin = createAdminClient();

  // One forfeit statement per booking.
  const { data: existing } = await admin
    .from("forfeit_statements")
    .select("id")
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "This booking has already been forfeited." };
  }

  const preview = await forfeitPreview(booking);
  const { total, paid, forfeited, writtenOff, currency, policyName } = preview;

  // Snapshots + business come from the booking's invoice (frozen at issue). A
  // never-invoiced booking still forfeits — we build a minimal guest snapshot.
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, host_snapshot, guest_snapshot")
    .eq("booking_id", booking.id)
    .is("voided_at", null)
    .order("issued_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: bkFull } = await admin
    .from("bookings")
    .select("reference, guest_name, guest_email")
    .eq("id", booking.id)
    .maybeSingle();

  const hostSnapshot = (invoice?.host_snapshot as Record<
    string,
    unknown
  > | null) ?? { host_id: booking.host_id };
  const guestSnapshot = (invoice?.guest_snapshot as Record<
    string,
    unknown
  > | null) ?? {
    name: bkFull?.guest_name ?? null,
    email: bkFull?.guest_email ?? null,
  };

  const statementNumber = await allocateForfeitNumber(admin);
  if (!statementNumber) {
    return { ok: false, error: "Could not allocate a statement number." };
  }

  // 1. Void the booking's live invoice(s) — superseded by the forfeit statement.
  await admin
    .from("invoices")
    .update({
      voided_at: new Date().toISOString(),
      void_reason: `Superseded by forfeit statement ${statementNumber} (no-show / abandoned)`,
    })
    .eq("booking_id", booking.id)
    .is("voided_at", null);

  // 2. Transition the booking. no_show is a terminal status: the
  // on_booking_cancelled trigger releases blocked_dates + rolls back counters.
  const { error: updErr } = await admin
    .from("bookings")
    .update({
      status: "no_show",
      previous_status: booking.status,
      payment_status: "forfeited",
      // The outstanding was written off — the guest owes nothing further.
      balance_due: 0,
      cancelled_at: new Date().toISOString(),
      cancelled_by: "host",
      cancellation_reason: opts.reason?.trim() || "No-show / abandoned",
    })
    .eq("id", booking.id)
    .eq("status", booking.status);
  if (updErr) {
    return { ok: false, error: "Could not forfeit the booking. Try again." };
  }

  // 3. Mint the immutable forfeit statement (the paper trail + ledger source).
  const { error: fsErr } = await admin.from("forfeit_statements").insert({
    statement_number: statementNumber,
    booking_id: booking.id,
    host_id: booking.host_id,
    guest_id: booking.guest_id,
    invoice_id: invoice?.id ?? null,
    host_snapshot: hostSnapshot,
    guest_snapshot: guestSnapshot,
    currency,
    booking_total: total,
    amount_paid: paid,
    amount_forfeited: forfeited,
    amount_refunded: 0,
    amount_written_off: writtenOff,
    policy_applied: policyName,
    reason: opts.reason?.trim() || null,
    created_by: opts.actorUserId,
  });
  if (fsErr) {
    return { ok: false, error: "Could not create the forfeit statement." };
  }

  // 4. Notify the guest (dedicated event — NOT booking_cancelled_guest, whose
  // copy promises a refund). dispatchEvent never throws.
  if (booking.guest_id) {
    await dispatchEvent({
      kind: "booking_forfeited_guest",
      recipientUserId: booking.guest_id,
      guestId: booking.guest_id,
      refs: { booking_id: booking.id },
    });
  }

  return { ok: true, statementNumber, forfeited, writtenOff };
}

/** Mint the next global FRF- statement number. */
async function allocateForfeitNumber(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data, error } = await admin.rpc("next_forfeit_number", {
    p_business_id: null,
  });
  if (error || !data) return null;
  return data as string;
}
