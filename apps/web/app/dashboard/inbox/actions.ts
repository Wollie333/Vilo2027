"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import { sendMessageSchema, type SendMessageInput } from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function getHost(): Promise<
  { ok: true; hostId: string; userId: string } | { ok: false; error: string }
> {
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
  return { ok: true, hostId: host.id, userId: user.id };
}

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

  revalidatePath("/dashboard/inbox");
  return { ok: true, data: { id: row.id } };
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
  const { error: msgErr } = await supabase
    .from("messages")
    .update({ read_by_host: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("read_by_host", false);
  if (msgErr) return { ok: false, error: "Could not mark as read." };

  const { error: convErr } = await supabase
    .from("conversations")
    .update({ unread_host: 0 })
    .eq("id", conversationId);
  if (convErr) return { ok: false, error: "Could not mark as read." };

  revalidatePath("/dashboard/inbox");
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
