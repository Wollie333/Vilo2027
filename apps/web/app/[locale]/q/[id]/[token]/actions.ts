"use server";

import { revalidatePath } from "next/cache";

import {
  DECLINE_REASONS,
  declineReasonLabel,
} from "@/lib/quotes/decline-reasons";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptAndConvertQuote } from "@/lib/quotes/accept-convert";

export type ActionResult =
  | { ok: true; bookingId?: string; payToken?: string | null }
  | { ok: false; error: string };

async function gateByToken(
  quoteId: string,
  token: string,
): Promise<
  | { ok: true; status: string; validUntil: string | null }
  | { ok: false; error: string }
> {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("status, accept_token, valid_until")
    .eq("id", quoteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.accept_token !== token) {
    return { ok: false, error: "Invalid token." };
  }
  if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
    return { ok: false, error: "This quote has expired." };
  }
  if (!["sent"].includes(quote.status)) {
    return { ok: false, error: "This quote can no longer be answered." };
  }
  return { ok: true, status: quote.status, validUntil: quote.valid_until };
}

export async function guestAcceptQuoteAction(
  quoteId: string,
  token: string,
): Promise<ActionResult> {
  const gate = await gateByToken(quoteId, token);
  if (!gate.ok) return gate;

  // Accepting auto-creates the booking (pending payment); the guest pays next.
  const res = await acceptAndConvertQuote(quoteId);
  if (!res.ok) return { ok: false, error: res.error };

  // The booking's pay_token drives the public /pay/[token] page so the guest can
  // pay immediately after accepting (every booking gets one by default).
  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("pay_token")
    .eq("id", res.bookingId)
    .maybeSingle();

  revalidatePath(`/q/${quoteId}/${token}`);
  return {
    ok: true,
    bookingId: res.bookingId,
    payToken: booking?.pay_token ?? null,
  };
}

export async function guestDeclineQuoteAction(
  quoteId: string,
  token: string,
  input?: { reason?: string; note?: string },
): Promise<ActionResult> {
  const gate = await gateByToken(quoteId, token);
  if (!gate.ok) return gate;

  const reason =
    input?.reason && DECLINE_REASONS.some((r) => r.value === input.reason)
      ? input.reason
      : null;
  const note = input?.note?.trim().slice(0, 1000) || null;
  const reasonLabel = reason ? declineReasonLabel(reason) : null;

  const supabase = createAdminClient();
  const { data: q } = await supabase
    .from("quotes")
    .update({
      status: "declined",
      declined_at: new Date().toISOString(),
      decline_reason: reason,
      decline_note: note,
    })
    .eq("id", quoteId)
    .select("conversation_id")
    .single();
  if (!q) return { ok: false, error: "Could not record your decline." };

  if (q.conversation_id) {
    await supabase
      .from("conversations")
      .update({ pipeline_stage: "declined" })
      .eq("id", q.conversation_id);
    // Post a "declined" card into the thread — left unread for the host (a
    // guest-initiated event) so it surfaces in their inbox badge.
    const cardBody = reasonLabel
      ? note
        ? `Quote declined — ${reasonLabel}. “${note}”`
        : `Quote declined — ${reasonLabel}.`
      : "Quote declined.";
    await supabase.from("messages").insert({
      conversation_id: q.conversation_id,
      sender_id: null,
      is_system_message: true,
      system_event: "quote_declined",
      quote_id: quoteId,
      body: cardBody,
      read_by_host: false,
      read_by_guest: true,
    });
  }

  revalidatePath(`/q/${quoteId}/${token}`);
  return { ok: true };
}
