"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { acceptAndConvertQuote } from "@/lib/quotes/accept-convert";

export type ActionResult =
  | { ok: true; bookingId?: string }
  | { ok: false; error: string };

// Auth-gated sibling of app/q/[id]/[token]/actions.ts. The public route trusts
// an accept_token; here we trust the signed-in guest's session and verify they
// own the quote. Same guard rails (status must be "sent", not expired). The
// status write goes through the service role AFTER the ownership re-check —
// there is deliberately no guest UPDATE policy on quotes.
async function gateByOwner(
  quoteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to respond to this quote." };

  // RLS (guest_read_own_quotes) already scopes this to quotes the guest owns,
  // so a row coming back IS proof of ownership.
  const { data: quote } = await supabase
    .from("quotes")
    .select("status, valid_until")
    .eq("id", quoteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
    return { ok: false, error: "This quote has expired." };
  }
  if (quote.status !== "sent") {
    return { ok: false, error: "This quote can no longer be answered." };
  }
  return { ok: true };
}

export async function acceptMyQuoteAction(
  quoteId: string,
): Promise<ActionResult> {
  const gate = await gateByOwner(quoteId);
  if (!gate.ok) return gate;

  // Accepting auto-creates the booking (pending payment). The guest pays next.
  const res = await acceptAndConvertQuote(quoteId);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/portal/quotes");
  revalidatePath(`/portal/quotes/${quoteId}`);
  return { ok: true, bookingId: res.bookingId };
}

export async function declineMyQuoteAction(
  quoteId: string,
): Promise<ActionResult> {
  const gate = await gateByOwner(quoteId);
  if (!gate.ok) return gate;

  const admin = createAdminClient();
  const { data: q } = await admin
    .from("quotes")
    .update({ status: "declined", declined_at: new Date().toISOString() })
    .eq("id", quoteId)
    .select("conversation_id")
    .single();
  if (!q) return { ok: false, error: "Could not record your decline." };

  if (q.conversation_id) {
    await admin
      .from("conversations")
      .update({ pipeline_stage: "declined" })
      .eq("id", q.conversation_id);
    // Post a "declined" card into the thread — left unread for the host (a
    // guest-initiated event) so it surfaces in their inbox badge.
    await admin.from("messages").insert({
      conversation_id: q.conversation_id,
      sender_id: null,
      is_system_message: true,
      system_event: "quote_declined",
      quote_id: quoteId,
      body: "Quote declined.",
      read_by_host: false,
      read_by_guest: true,
    });
  }

  revalidatePath("/portal/quotes");
  revalidatePath(`/portal/quotes/${quoteId}`);
  return { ok: true };
}
