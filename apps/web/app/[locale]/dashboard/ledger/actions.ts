"use server";

import { revalidatePath } from "next/cache";

import { logFinanceEvent } from "@/lib/finance/audit";
import { voidTransaction } from "@/lib/finance/void";
import { requireHost as currentHost } from "@/lib/host/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type VoidResult = { ok: true } | { ok: false; error: string };

/** Close an accounting month (YYYY-MM). Locks it against further money moves. */
export async function closePeriodAction(input: {
  month: string;
}): Promise<VoidResult> {
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return { ok: false, error: "Invalid month." };
  }
  const monthStart = `${input.month}-01`;
  const thisMonth = new Date().toISOString().slice(0, 7);
  if (input.month > thisMonth) {
    return { ok: false, error: "You can't close a future month." };
  }
  const h = await currentHost();
  if (!h.ok) return h;

  const admin = createAdminClient();
  const { error } = await admin.from("accounting_periods").insert({
    host_id: h.hostId,
    period_month: monthStart,
    closed_by: h.userId,
  });
  if (error) return { ok: false, error: "That month is already closed." };

  await logFinanceEvent(admin, {
    hostId: h.hostId,
    actorId: h.userId,
    action: "period.close",
    entityType: "period",
    reason: input.month,
    metadata: { month: input.month },
  });
  revalidatePath("/dashboard/ledger");
  return { ok: true };
}

/** Reopen a previously-closed month so it can be edited again (audited). */
export async function reopenPeriodAction(input: {
  month: string;
}): Promise<VoidResult> {
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return { ok: false, error: "Invalid month." };
  }
  const h = await currentHost();
  if (!h.ok) return h;

  const admin = createAdminClient();
  await admin
    .from("accounting_periods")
    .delete()
    .eq("host_id", h.hostId)
    .eq("period_month", `${input.month}-01`);

  await logFinanceEvent(admin, {
    hostId: h.hostId,
    actorId: h.userId,
    action: "period.reopen",
    entityType: "period",
    reason: input.month,
    metadata: { month: input.month },
  });
  revalidatePath("/dashboard/ledger");
  return { ok: true };
}

/**
 * Void a ledger transaction (host). A reason is required and stored for audit;
 * the entry is never deleted, just hidden from the active ledger and reversed.
 */
export async function voidTransactionAction(input: {
  txnId: string;
  reason: string;
}): Promise<VoidResult> {
  const reason = (input.reason ?? "").trim();
  if (reason.length < 3) {
    return { ok: false, error: "Give a reason for voiding this transaction." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile." };

  const admin = createAdminClient();
  const res = await voidTransaction(admin, {
    txnId: input.txnId,
    hostId: host.id,
    userId: user.id,
    reason,
  });
  if (!res.ok) return res;

  revalidatePath("/dashboard/ledger");
  if (res.bookingId) revalidatePath(`/dashboard/bookings/${res.bookingId}`);
  return { ok: true };
}
