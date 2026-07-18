"use server";

import { revalidatePath } from "next/cache";

import { gkeyFor } from "@/lib/guests/gkey";
import { formatMoney } from "@/lib/format";
import { postGuestSystemCard } from "@/lib/messaging/system-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { createCreditNoteSchema } from "../quotes/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Manual credit note — host opens an invoice and credits an amount back to the
 * guest. The auto path (refund completion) is handled by a DB trigger; this is
 * the host-initiated counterpart. Snapshots are copied from the invoice so the
 * document is frozen.
 */
export async function createCreditNoteAction(input: {
  invoiceId: string;
  amount: number;
  reason: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createCreditNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Pull the invoice + verify ownership in one go.
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, booking_id, host_id, guest_id, currency, total_amount, host_snapshot, guest_snapshot, host:hosts!inner ( user_id )",
    )
    .eq("id", parsed.data.invoiceId)
    .maybeSingle();
  if (!invoice) return { ok: false, error: "Invoice not found." };

  const ownerId = (invoice as unknown as { host: { user_id: string } }).host
    .user_id;
  if (ownerId !== user.id) return { ok: false, error: "Not your invoice." };

  if (parsed.data.amount > Number(invoice.total_amount)) {
    return {
      ok: false,
      error: "Credit can't exceed the invoice total.",
    };
  }

  // Per-business credit-note number — resolve the business behind the invoice's
  // booking (its listing's business), falling back to the host's default.
  let cnBusinessId: string | null = null;
  if (invoice.booking_id) {
    const { data: bk } = await supabase
      .from("bookings")
      .select("listing:properties ( business_id )")
      .eq("id", invoice.booking_id)
      .maybeSingle();
    const l = Array.isArray(bk?.listing) ? bk?.listing[0] : bk?.listing;
    cnBusinessId =
      (l as { business_id?: string | null } | null)?.business_id ?? null;
  }
  if (!cnBusinessId) {
    const { data: defBiz } = await supabase
      .from("businesses")
      .select("id")
      .eq("host_id", invoice.host_id)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle();
    cnBusinessId = defBiz?.id ?? null;
  }
  if (!cnBusinessId) {
    return {
      ok: false,
      error: "No business found to number this credit note.",
    };
  }

  // SECURITY DEFINER RPC, bumped under row lock.
  const { data: number, error: numErr } = await supabase.rpc(
    "next_credit_note_number",
    { p_business_id: cnBusinessId },
  );
  if (numErr || !number) {
    return { ok: false, error: "Could not allocate a credit-note number." };
  }

  const amount = parsed.data.amount;
  const { data: inserted, error: insErr } = await supabase
    .from("credit_notes")
    .insert({
      credit_note_number: number,
      invoice_id: invoice.id,
      booking_id: invoice.booking_id,
      host_id: invoice.host_id,
      guest_id: invoice.guest_id,
      host_snapshot: invoice.host_snapshot,
      guest_snapshot: invoice.guest_snapshot,
      line_items: [{ label: parsed.data.reason, amount }],
      reason: parsed.data.reason,
      subtotal: amount,
      vat_amount: 0,
      total_amount: amount,
      currency: invoice.currency,
      origin: "manual",
      status: "issued",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return {
      ok: false,
      error: insErr?.message ?? "Could not create credit note.",
    };
  }

  // A manual credit note grants the guest store credit they can spend on a
  // future balance — post it to the per-host credit ledger so it feeds the
  // guest's net balance. (Refund-origin credit notes are created by a DB trigger,
  // not here, so cash refunds never double-post as credit.)
  const guestSnap = (invoice.guest_snapshot ?? {}) as { email?: string | null };
  const gkey = gkeyFor(invoice.guest_id, guestSnap.email ?? null);
  if (gkey) {
    await createAdminClient()
      .from("guest_credit_ledger")
      .insert({
        host_id: invoice.host_id,
        gkey,
        guest_id: invoice.guest_id,
        guest_email: guestSnap.email ?? null,
        amount,
        currency: invoice.currency,
        reason: `Credit note ${number}`,
        booking_id: invoice.booking_id,
        created_by: user.id,
      });
  }

  // Post a rich "refund issued" card into the guest's thread (unread for them),
  // with the credit note to download — mirrors the payment-received card.
  if (invoice.booking_id && invoice.guest_id) {
    const admin = createAdminClient();
    const { data: bk } = await admin
      .from("bookings")
      .select("id, host_id, guest_id, property_id, quote_id, reference")
      .eq("id", invoice.booking_id)
      .maybeSingle();
    if (bk) {
      await postGuestSystemCard(admin, bk, {
        systemEvent: "payment_refunded",
        body: `A refund of ${formatMoney(amount, invoice.currency)} has been issued on booking ${bk.reference}.`,
        readByHost: true,
        readByGuest: false,
      });
    }
  }

  revalidatePath("/dashboard/credit-notes");
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  if (invoice.booking_id) {
    revalidatePath(`/dashboard/bookings/${invoice.booking_id}`);
  }
  return { ok: true, data: { id: inserted.id } };
}

export async function cancelCreditNoteAction(
  creditNoteId: string,
): Promise<ActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: cn } = await supabase
    .from("credit_notes")
    .select("id, status, host:hosts!inner ( user_id )")
    .eq("id", creditNoteId)
    .maybeSingle();
  if (!cn) return { ok: false, error: "Credit note not found." };

  const ownerId = (cn as unknown as { host: { user_id: string } }).host.user_id;
  if (ownerId !== user.id) return { ok: false, error: "Not your credit note." };
  if (cn.status === "cancelled") {
    return { ok: false, error: "Already cancelled." };
  }

  const { error } = await supabase
    .from("credit_notes")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", creditNoteId);
  if (error) return { ok: false, error: "Could not cancel the credit note." };

  revalidatePath("/dashboard/credit-notes");
  revalidatePath(`/dashboard/credit-notes/${creditNoteId}`);
  return { ok: true };
}
