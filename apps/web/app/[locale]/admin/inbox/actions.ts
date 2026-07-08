"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/admin";
import {
  adminPostToHostThread,
  ensureWieloSupportUser,
  resolveHostByEmail,
} from "@/lib/inbox/platform-thread";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

// Permission gate for the Wielo support inbox. Reused across reply / read / send.
const INBOX_PERMISSION = "notifications.send_individual" as const;

// Reply to a host on their Wielo (platform) thread from /admin/inbox.
export async function adminReplyPlatformAction(input: {
  conversationId: string;
  body: string;
}): Promise<Result> {
  await requirePermission(INBOX_PERMISSION);
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Message is empty." };

  const service = createAdminClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id, channel")
    .eq("id", input.conversationId)
    .maybeSingle();
  if (!conv || conv.channel !== "platform") {
    return { ok: false, error: "Not a Wielo conversation." };
  }

  // Post AS "Wielo Support" so the host sees one branded counterparty.
  const supportId = await ensureWieloSupportUser(service);
  const { error } = await service.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: supportId,
    body,
    read_by_host: false,
    read_by_guest: true,
  });
  if (error) return { ok: false, error: "Could not send the message." };

  revalidatePath("/admin/inbox");
  return { ok: true };
}

// Mark a host's Wielo thread read on the Wielo/admin side (clears the admin's
// unread — which lives in unread_guest, since Wielo is the "guest" party).
export async function adminMarkPlatformReadAction(
  conversationId: string,
): Promise<Result> {
  await requirePermission(INBOX_PERMISSION);
  const service = createAdminClient();
  await service
    .from("messages")
    .update({ read_by_guest: true })
    .eq("conversation_id", conversationId)
    .eq("read_by_guest", false);
  await service
    .from("conversations")
    .update({ unread_guest: 0 })
    .eq("id", conversationId);
  revalidatePath("/admin/inbox");
  return { ok: true };
}

// Send a message to a host's Wielo thread addressed by email — used by the
// revenue ledger's "Send payment link → to inbox" affordance.
export async function adminSendPlatformMessageByEmailAction(input: {
  email: string;
  body: string;
}): Promise<Result> {
  await requirePermission(INBOX_PERMISSION);
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Message is empty." };

  const service = createAdminClient();
  const host = await resolveHostByEmail(service, input.email);
  if (!host) {
    return { ok: false, error: "That email has no host account to message." };
  }

  try {
    await adminPostToHostThread(service, {
      host: { id: host.id, userId: host.userId },
      body,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send the message.",
    };
  }

  revalidatePath("/admin/inbox");
  return { ok: true };
}
