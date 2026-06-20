import "server-only";

import type { Json } from "@vilo/types";

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type FinanceAuditInput = {
  hostId: string;
  actorId: string | null;
  /** e.g. payment.record, refund.issue, credit_note.void, charge.add, period.close */
  action: string;
  bookingId?: string | null;
  txnId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  amount?: number | null;
  currency?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Append one row to the finance audit trail. The ONE place money events are
 * logged. Best-effort: a logging failure must never break the money action, so
 * it swallows errors.
 */
export async function logFinanceEvent(
  admin: Admin,
  e: FinanceAuditInput,
): Promise<void> {
  try {
    await admin.from("finance_audit_log").insert({
      host_id: e.hostId,
      actor_id: e.actorId,
      action: e.action,
      booking_id: e.bookingId ?? null,
      txn_id: e.txnId ?? null,
      entity_type: e.entityType ?? null,
      entity_id: e.entityId ?? null,
      amount: e.amount ?? null,
      currency: e.currency ?? null,
      reason: e.reason ?? null,
      metadata: (e.metadata ?? null) as Json,
    });
  } catch {
    // Never let audit logging break a money action.
  }
}
