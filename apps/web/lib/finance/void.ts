import "server-only";

import { logFinanceEvent } from "@/lib/finance/audit";
import { assertPeriodOpen } from "@/lib/finance/periods";
import { gkeyFor } from "@/lib/guests/gkey";
import { recomputeBookingPaymentState } from "@/lib/payments/ledger";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type VoidOutcome =
  | { ok: true; bookingId: string | null }
  | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Void a ledger transaction — the ONE place voiding happens. Stamps
 * voided_at/by/reason (never deletes, for audit), reverses the entry's
 * financial effect by type, and recomputes the booking's money state. The
 * ledger then hides it by default and surfaces it under the "Voided" filter.
 *
 * txnId is the ledger Txn id (`inv_…`, `pay_…`, `cn_…`, `rf_…`).
 */
export async function voidTransaction(
  admin: Admin,
  args: { txnId: string; hostId: string; userId: string; reason: string },
): Promise<VoidOutcome> {
  const { txnId, hostId, userId, reason } = args;
  const stamp = {
    voided_at: new Date().toISOString(),
    voided_by: userId,
    void_reason: reason,
  };
  const us = txnId.indexOf("_");
  const prefix = us === -1 ? "" : txnId.slice(0, us);
  const id = us === -1 ? "" : txnId.slice(us + 1);
  if (!id) return { ok: false, error: "Unknown transaction." };

  // ── Payment ── voiding drops it from amount-paid; balance recomputes.
  if (prefix === "pay") {
    const { data: p } = await admin
      .from("payments")
      .select(
        "id, booking_id, amount, currency, captured_at, created_at, voided_at, booking:bookings!inner ( host_id )",
      )
      .eq("id", id)
      .eq("booking.host_id", hostId)
      .maybeSingle();
    if (!p) return { ok: false, error: "Not your transaction." };
    if (p.voided_at) return { ok: false, error: "Already voided." };
    const pc = await assertPeriodOpen(
      admin,
      hostId,
      (p.captured_at ?? p.created_at) as string,
    );
    if (!pc.ok) return pc;
    await admin.from("payments").update(stamp).eq("id", id);
    if (p.booking_id) await recomputeBookingPaymentState(admin, p.booking_id);
    await logFinanceEvent(admin, {
      hostId,
      actorId: userId,
      action: "payment.void",
      bookingId: p.booking_id,
      txnId,
      entityType: "payment",
      entityId: id,
      amount: Number(p.amount),
      currency: p.currency,
      reason,
    });
    return { ok: true, bookingId: p.booking_id };
  }

  // ── Credit note ── reverse the store credit it granted.
  if (prefix === "cn") {
    const { data: cn } = await admin
      .from("credit_notes")
      .select(
        "id, booking_id, host_id, guest_id, total_amount, currency, issued_at, voided_at, guest_snapshot",
      )
      .eq("id", id)
      .eq("host_id", hostId)
      .maybeSingle();
    if (!cn) return { ok: false, error: "Not your transaction." };
    if (cn.voided_at) return { ok: false, error: "Already voided." };
    const pc = await assertPeriodOpen(admin, hostId, cn.issued_at as string);
    if (!pc.ok) return pc;
    await admin.from("credit_notes").update(stamp).eq("id", id);
    const snap = (cn.guest_snapshot ?? {}) as { email?: string };
    const gkey = gkeyFor(cn.guest_id, snap.email ?? null);
    if (gkey) {
      await admin.from("guest_credit_ledger").insert({
        host_id: hostId,
        gkey,
        amount: -round2(Number(cn.total_amount)),
        reason: `Credit note voided — ${reason}`,
        booking_id: cn.booking_id,
      });
    }
    if (cn.booking_id) await recomputeBookingPaymentState(admin, cn.booking_id);
    await logFinanceEvent(admin, {
      hostId,
      actorId: userId,
      action: "credit_note.void",
      bookingId: cn.booking_id,
      txnId,
      entityType: "credit_note",
      entityId: id,
      amount: Number(cn.total_amount),
      currency: cn.currency,
      reason,
    });
    return { ok: true, bookingId: cn.booking_id };
  }

  // ── Refund ── the refund-total trigger reverses on this update.
  if (prefix === "rf") {
    const { data: rf } = await admin
      .from("refund_requests")
      .select(
        "id, booking_id, host_id, requested_amount, approved_amount, currency, created_at, voided_at",
      )
      .eq("id", id)
      .eq("host_id", hostId)
      .maybeSingle();
    if (!rf) return { ok: false, error: "Not your transaction." };
    if (rf.voided_at) return { ok: false, error: "Already voided." };
    const pc = await assertPeriodOpen(admin, hostId, rf.created_at as string);
    if (!pc.ok) return pc;
    await admin.from("refund_requests").update(stamp).eq("id", id);
    if (rf.booking_id) await recomputeBookingPaymentState(admin, rf.booking_id);
    await logFinanceEvent(admin, {
      hostId,
      actorId: userId,
      action: "refund.void",
      bookingId: rf.booking_id,
      txnId,
      entityType: "refund",
      entityId: id,
      amount: Number(rf.approved_amount ?? rf.requested_amount),
      currency: rf.currency,
      reason,
    });
    return { ok: true, bookingId: rf.booking_id };
  }

  // ── Charge / invoice ── only add-on charges; the stay charge is the booking.
  if (prefix === "inv") {
    const { data: inv } = await admin
      .from("invoices")
      .select(
        "id, booking_id, host_id, kind, total_amount, vat_amount, currency, issued_at, voided_at",
      )
      .eq("id", id)
      .eq("host_id", hostId)
      .maybeSingle();
    if (!inv) return { ok: false, error: "Not your transaction." };
    if (inv.voided_at) return { ok: false, error: "Already voided." };
    if (inv.kind !== "addon") {
      return {
        ok: false,
        error:
          "This is the booking's main charge — cancel the booking instead of voiding the stay invoice.",
      };
    }
    const pc = await assertPeriodOpen(admin, hostId, inv.issued_at as string);
    if (!pc.ok) return pc;
    await admin.from("invoices").update(stamp).eq("id", id);
    if (inv.booking_id) {
      const { data: b } = await admin
        .from("bookings")
        .select("total_amount, vat_amount")
        .eq("id", inv.booking_id)
        .maybeSingle();
      if (b) {
        await admin
          .from("bookings")
          .update({
            total_amount: round2(
              Number(b.total_amount) - Number(inv.total_amount),
            ),
            vat_amount: round2(
              Number(b.vat_amount ?? 0) - Number(inv.vat_amount ?? 0),
            ),
          })
          .eq("id", inv.booking_id);
      }
      // Remove the add-on line(s) this invoice charged; the voided invoice keeps
      // the frozen record for audit.
      await admin.from("booking_addons").delete().eq("invoice_id", inv.id);
      await recomputeBookingPaymentState(admin, inv.booking_id);
    }
    await logFinanceEvent(admin, {
      hostId,
      actorId: userId,
      action: "charge.void",
      bookingId: inv.booking_id,
      txnId,
      entityType: "invoice",
      entityId: id,
      amount: Number(inv.total_amount),
      currency: inv.currency,
      reason,
    });
    return { ok: true, bookingId: inv.booking_id };
  }

  return { ok: false, error: "This transaction can't be voided." };
}
