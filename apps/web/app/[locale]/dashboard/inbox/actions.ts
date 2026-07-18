"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { formatMoney } from "@/lib/format";
import { requireHost as getHost } from "@/lib/host/current";
import { SELF_RECIPIENT_ERROR } from "@/lib/host/self";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  sendMessageSchema,
  templateInputSchema,
  type SendMessageInput,
  type TemplateInput,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function assertConversationOwnership(
  conversationId: string,
  hostId: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("host_id", hostId)
    .maybeSingle();
  return !!data;
}

export async function sendMessageAction(
  input: SendMessageInput,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Message looks wrong." };
  }
  const v = parsed.data;

  if (!(await assertConversationOwnership(v.conversation_id, host.hostId))) {
    return { ok: false, error: "Not your conversation." };
  }

  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: v.conversation_id,
      sender_id: host.userId,
      body: v.body,
      read_by_host: true,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: "Could not send message. Try again." };
  }

  // Notify the guest of the new message (push + in-app; deduped per thread).
  // Best-effort — a notification failure must never fail the send.
  try {
    const admin = createAdminClient();
    const { data: conv } = await admin
      .from("conversations")
      .select("guest_id, unread_guest")
      .eq("id", v.conversation_id)
      .maybeSingle();
    if (conv?.guest_id) {
      const { data: hostRow } = await admin
        .from("hosts")
        .select("display_name")
        .eq("id", host.hostId)
        .maybeSingle();
      const { dispatchEvent } = await import("@/lib/notifications/dispatch");
      await dispatchEvent({
        kind: "new_message",
        recipientUserId: conv.guest_id,
        guestId: conv.guest_id,
        hostId: host.hostId,
        refs: {
          conversation_id: v.conversation_id,
          sender_first_name: hostRow?.display_name ?? "New message",
          message_body: v.body,
          unread_count: conv.unread_guest ?? 1,
        },
        supabase: admin,
      });
    }
  } catch {
    // best-effort notification
  }

  revalidatePath("/dashboard/inbox");
  return { ok: true, data: { id: row.id } };
}

/**
 * Post the booking's secure pay-now link into the thread as a host message, so
 * the guest can pay straight from chat. Resolves the conversation's linked
 * booking, guards that there's an outstanding balance on a payable booking, and
 * builds the public /pay/[pay_token] URL from the request origin.
 */
export async function sendPayLinkToThreadAction(
  conversationId: string,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertConversationOwnership(conversationId, host.hostId))) {
    return { ok: false, error: "Not your conversation." };
  }

  const supabase = createServerClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "booking:bookings ( id, reference, status, balance_due, currency, pay_token )",
    )
    .eq("id", conversationId)
    .maybeSingle();
  const booking = (
    Array.isArray((conv as { booking?: unknown } | null)?.booking)
      ? (conv as { booking: unknown[] }).booking[0]
      : (conv as { booking?: unknown } | null)?.booking
  ) as {
    id: string;
    reference: string;
    status: string;
    balance_due: number | string | null;
    currency: string;
    pay_token: string | null;
  } | null;

  if (!booking || !booking.pay_token) {
    return { ok: false, error: "No booking is linked to this conversation." };
  }
  const balance = Number(booking.balance_due ?? 0);
  const dead =
    booking.status.startsWith("cancelled") ||
    ["declined", "expired", "no_show"].includes(booking.status);
  if (dead) return { ok: false, error: "This booking can no longer be paid." };
  if (balance <= 0) {
    return { ok: false, error: "This booking is already paid in full." };
  }

  const h = headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (h.get("host")
      ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`
      : "");
  const url = `${origin}/pay/${booking.pay_token}`;
  const body = `💳 Here's your secure payment link to confirm booking ${booking.reference} — ${formatMoney(
    balance,
    booking.currency,
  )} due:\n${url}`;

  const { data: row, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: host.userId,
      body,
      read_by_host: true,
      read_by_guest: false,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: "Could not send the payment link." };
  }

  revalidatePath("/dashboard/inbox");
  return { ok: true, data: { id: row.id } };
}

/**
 * Open a host→guest thread when none exists yet — the "start a conversation"
 * affordance on the booking + guest-record Messages tabs. Find-or-creates the
 * host↔guest conversation (reusing the most recent non-archived one so we never
 * fork a duplicate thread) and posts the host's first message. The message
 * AFTER INSERT trigger maintains last_message_at / preview / unread counters.
 * Guarded so a host can only message a guest they actually deal with.
 */
export async function startGuestConversationAction(input: {
  guestId: string;
  body: string;
  bookingId?: string | null;
  listingId?: string | null;
}): Promise<ActionResult<{ conversationId: string }>> {
  const host = await getHost();
  if (!host.ok) return host;

  const text = input.body?.trim() ?? "";
  if (!text) return { ok: false, error: "Message can't be empty." };
  if (text.length > 4000) return { ok: false, error: "Message is too long." };
  if (!input.guestId) {
    return { ok: false, error: "This contact has no account to message." };
  }
  // Never let a host open a thread with their own account.
  if (input.guestId === host.userId) {
    return { ok: false, error: SELF_RECIPIENT_ERROR };
  }

  const admin = createAdminClient();

  // Ownership: the host may only open a thread with a guest they actually deal
  // with — one who has a booking OR a CRM contact with them. Stops a host from
  // cold-messaging an arbitrary user_profiles id.
  const [{ data: bk }, { data: contact }] = await Promise.all([
    admin
      .from("bookings")
      .select("id")
      .eq("host_id", host.hostId)
      .eq("guest_id", input.guestId)
      .limit(1)
      .maybeSingle(),
    admin
      .from("host_contacts")
      .select("id")
      .eq("host_id", host.hostId)
      .eq("guest_id", input.guestId)
      .limit(1)
      .maybeSingle(),
  ]);
  if (!bk && !contact) {
    return {
      ok: false,
      error: "You don't have a booking or contact for this guest.",
    };
  }

  // Find-or-create the host↔guest thread (reuse the most recent non-archived).
  let conversationId: string;
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("host_id", host.hostId)
    .eq("guest_id", input.guestId)
    .neq("status", "archived")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .insert({
        host_id: host.hostId,
        guest_id: input.guestId,
        property_id: input.listingId ?? null,
        booking_id: input.bookingId ?? null,
        is_enquiry: false,
        status: "open",
      })
      .select("id")
      .single();
    if (convErr || !conv) {
      return { ok: false, error: "Could not start the conversation." };
    }
    conversationId = conv.id;
  }

  const { error: msgErr } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: host.userId,
    body: text,
    read_by_host: true,
  });
  if (msgErr) return { ok: false, error: "Could not send message. Try again." };

  revalidatePath("/dashboard/inbox");
  if (input.bookingId) {
    revalidatePath(`/dashboard/bookings/${input.bookingId}`);
  }
  return { ok: true, data: { conversationId } };
}

export async function markConversationReadAction(
  conversationId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertConversationOwnership(conversationId, host.hostId))) {
    return { ok: false, error: "Not your conversation." };
  }

  const supabase = createServerClient();
  // Message rows are no longer client-updatable (messages RLS blocks UPDATE to
  // stop in-thread tampering); mark-as-read runs via the service role AFTER the
  // ownership assert above.
  const { error: msgErr } = await createAdminClient()
    .from("messages")
    .update({ read_by_host: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("read_by_host", false);
  if (msgErr) return { ok: false, error: "Could not mark as read." };

  const { error: convErr } = await supabase
    .from("conversations")
    .update({ unread_host: 0, host_last_seen_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (convErr) return { ok: false, error: "Could not mark as read." };

  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

// Mark the host "online" for delivery receipts: stamp host_last_seen_at across
// their conversations so the guest's outgoing messages flip from sent → delivered.
// Called when the host opens their inbox and when a new message arrives live.
export async function touchInboxSeenAction(): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("conversations")
    .update({ host_last_seen_at: new Date().toISOString() })
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not update presence." };
  return { ok: true };
}

export async function archiveConversationAction(
  conversationId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertConversationOwnership(conversationId, host.hostId))) {
    return { ok: false, error: "Not your conversation." };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("conversations")
    .update({ status: "archived" })
    .eq("id", conversationId);
  if (error) return { ok: false, error: "Could not archive." };

  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

export async function unarchiveConversationAction(
  conversationId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertConversationOwnership(conversationId, host.hostId))) {
    return { ok: false, error: "Not your conversation." };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("conversations")
    .update({ status: "open" })
    .eq("id", conversationId);
  if (error) return { ok: false, error: "Could not unarchive." };

  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

// ── Pin ─────────────────────────────────────────────────────
export async function togglePinAction(
  conversationId: string,
  pinned: boolean,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertConversationOwnership(conversationId, host.hostId))) {
    return { ok: false, error: "Not your conversation." };
  }
  const supabase = createServerClient();
  const { error } = await supabase
    .from("conversations")
    .update({ pinned })
    .eq("id", conversationId);
  if (error) return { ok: false, error: "Could not update." };
  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

// ── Templates ───────────────────────────────────────────────
async function assertTemplateOwnership(
  templateId: string,
  hostId: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("message_templates")
    .select("id")
    .eq("id", templateId)
    .eq("host_id", hostId)
    .maybeSingle();
  return !!data;
}

export async function createTemplateAction(
  input: TemplateInput,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;

  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const v = parsed.data;

  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("message_templates")
    .insert({
      host_id: host.hostId,
      title: v.title,
      body: v.body,
      sort_order: v.sort_order,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: "Could not save template." };
  }

  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/inbox/templates");
  return { ok: true, data: { id: row.id } };
}

export async function updateTemplateAction(
  templateId: string,
  input: TemplateInput,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertTemplateOwnership(templateId, host.hostId))) {
    return { ok: false, error: "Not your template." };
  }

  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const v = parsed.data;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("message_templates")
    .update({ title: v.title, body: v.body, sort_order: v.sort_order })
    .eq("id", templateId);
  if (error) return { ok: false, error: "Could not save template." };

  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/inbox/templates");
  return { ok: true };
}

export async function deleteTemplateAction(
  templateId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertTemplateOwnership(templateId, host.hostId))) {
    return { ok: false, error: "Not your template." };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("message_templates")
    .delete()
    .eq("id", templateId);
  if (error) return { ok: false, error: "Could not delete template." };

  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/inbox/templates");
  return { ok: true };
}
