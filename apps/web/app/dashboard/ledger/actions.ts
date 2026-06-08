"use server";

import { revalidatePath } from "next/cache";

import { voidTransaction } from "@/lib/finance/void";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type VoidResult = { ok: true } | { ok: false; error: string };

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
