"use server";

import { revalidatePath } from "next/cache";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import {
  DECLINE_REASONS,
  declineReasonLabel,
} from "@/lib/quotes/decline-reasons";
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
  input?: { reason?: string; note?: string },
): Promise<ActionResult> {
  const gate = await gateByOwner(quoteId);
  if (!gate.ok) return gate;

  // Validate the structured reason against the shared list; keep an optional
  // free-text note (trimmed, capped) so the host learns why.
  const reason =
    input?.reason && DECLINE_REASONS.some((r) => r.value === input.reason)
      ? input.reason
      : null;
  const note = input?.note?.trim().slice(0, 1000) || null;
  const reasonLabel = reason ? declineReasonLabel(reason) : null;

  const admin = createAdminClient();
  const { data: q } = await admin
    .from("quotes")
    .update({
      status: "declined",
      declined_at: new Date().toISOString(),
      decline_reason: reason,
      decline_note: note,
    })
    .eq("id", quoteId)
    .select(
      "conversation_id, host_id, looking_for_post_id, guest_name, quote_number, property_id",
    )
    .single();
  if (!q) return { ok: false, error: "Could not record your decline." };

  if (q.conversation_id) {
    await admin
      .from("conversations")
      .update({ pipeline_stage: "declined" })
      .eq("id", q.conversation_id);
    // Post a "declined" card into the thread — left unread for the host (a
    // guest-initiated event) so it surfaces in their inbox badge. Include the
    // reason + note so the host sees why without leaving the thread.
    const cardBody = reasonLabel
      ? note
        ? `Quote declined — ${reasonLabel}. “${note}”`
        : `Quote declined — ${reasonLabel}.`
      : "Quote declined.";
    await admin.from("messages").insert({
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

  // If this quote answered a Looking-For request, tell the host it was declined
  // (in-app + push + LookingForQuoteDeclinedHost email). Best-effort.
  if (q.looking_for_post_id && q.host_id) {
    try {
      const [{ data: hostRow }, { data: postRow }, { data: propRow }] =
        await Promise.all([
          admin
            .from("hosts")
            .select("user_id, display_name")
            .eq("id", q.host_id)
            .maybeSingle(),
          admin
            .from("looking_for_posts")
            .select("title")
            .eq("id", q.looking_for_post_id)
            .maybeSingle(),
          q.property_id
            ? admin
                .from("properties")
                .select("name")
                .eq("id", q.property_id)
                .maybeSingle()
            : Promise.resolve({ data: null as { name: string } | null }),
        ]);
      if (hostRow?.user_id) {
        await dispatchEvent({
          kind: "looking_for_quote_declined",
          recipientUserId: hostRow.user_id,
          hostId: q.host_id,
          refs: {
            post_id: q.looking_for_post_id,
            quote_id: quoteId,
            post_title: postRow?.title ?? undefined,
            guest_first_name: (q.guest_name ?? "").split(" ")[0] || undefined,
            hostFirstName:
              (hostRow.display_name ?? "").split(" ")[0] || undefined,
            guestName: q.guest_name ?? undefined,
            postTitle: postRow?.title ?? undefined,
            listingName: propRow?.name ?? postRow?.title ?? undefined,
            quoteNumber: q.quote_number ?? undefined,
            declineReason: reasonLabel ?? undefined,
            declineNote: note ?? undefined,
          },
        });
      }
    } catch {
      // Non-fatal.
    }
  }

  revalidatePath("/portal/quotes");
  revalidatePath(`/portal/quotes/${quoteId}`);
  return { ok: true };
}
