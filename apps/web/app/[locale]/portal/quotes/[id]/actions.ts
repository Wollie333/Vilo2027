"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { acceptAndConvertQuote } from "@/lib/quotes/accept-convert";

export type ActionResult =
  | { ok: true; bookingId?: string; payToken?: string | null }
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

  // Resolve via the service role scoped to the signed-in user's id OR email,
  // then verify ownership here — host-created quotes carry guest_email but no
  // guest_id, so an RLS-by-guest_id read would 404 a quote the guest can see.
  const email = (user.email ?? "").trim().toLowerCase();
  const { data: quote } = await createAdminClient()
    .from("quotes")
    .select("status, valid_until, guest_id, guest_email")
    .eq("id", quoteId)
    .is("deleted_at", null)
    .maybeSingle();
  const owns =
    !!quote &&
    (quote.guest_id === user.id ||
      (quote.guest_email ?? "").toLowerCase() === email);
  if (!quote || !owns) return { ok: false, error: "Quote not found." };
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

  // Link the quote to this signed-in guest if it was only email-matched (no
  // guest_id yet), so the booking it becomes is owned by them.
  const {
    data: { user },
  } = await createServerClient().auth.getUser();
  if (user) {
    await createAdminClient()
      .from("quotes")
      .update({ guest_id: user.id })
      .eq("id", quoteId)
      .is("guest_id", null);
  }

  // Accepting auto-creates the booking (pending payment). The guest pays next.
  const res = await acceptAndConvertQuote(quoteId);
  if (!res.ok) return { ok: false, error: res.error };

  // Mirror the public token flow: hand back the booking's pay_token so the
  // portal can offer "Continue to pay" straight away instead of stranding the
  // guest on the accepted quote with no way to secure it.
  const { data: booking } = await createAdminClient()
    .from("bookings")
    .select("pay_token")
    .eq("id", res.bookingId)
    .maybeSingle();

  revalidatePath("/portal/quotes");
  revalidatePath(`/portal/quotes/${quoteId}`);
  revalidatePath("/portal/trips");
  return {
    ok: true,
    bookingId: res.bookingId,
    payToken: booking?.pay_token ?? null,
  };
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
