"use server";

import { revalidatePath } from "next/cache";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import {
  adminPostPaymentLinkToHostThread,
  adminPostToHostThread,
  ensureWieloSupportUser,
  resolveHostByEmail,
} from "@/lib/inbox/platform-thread";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

// Permission gate for the Wielo support inbox. Reused across reply / read / send.
const INBOX_PERMISSION = "notifications.send_individual" as const;

/**
 * Everything in here that SENDS is audited (RULES.md §5, AGENT_RULES.md §6.1):
 * posting as "Wielo Support" is an outbound message to a real user, made on the
 * platform's behalf, and there used to be no record of which staff member sent
 * it. The message body goes into the audit payload — it IS the action.
 *
 * `adminMarkPlatformReadAction` is deliberately NOT audited: clearing the admin
 * side's own unread counter changes nothing the user can see, and auditing every
 * thread open would bury the sends that matter.
 */

// Reply to a host on their Wielo (platform) thread from /admin/inbox.
const replyPlatform = withAdminAudit<
  { conversationId: string; body: string; reason?: string },
  Result
>(
  {
    permissionKey: INBOX_PERMISSION,
    actionName: "inbox.reply",
    targetType: "conversation",
    getTargetId: (args) => args.conversationId,
    // Surface the send on the recipient's user-record History tab.
    getOwnerUserId: async (args, service) => {
      const { data: conv } = await service
        .from("conversations")
        .select("host_id, guest_id")
        .eq("id", args.conversationId)
        .maybeSingle();
      if (!conv) return null;
      // A guest support thread has host_id NULL — the guest IS the user id.
      if (!conv.host_id) return conv.guest_id;
      const { data: host } = await service
        .from("hosts")
        .select("user_id")
        .eq("id", conv.host_id)
        .maybeSingle();
      return host?.user_id ?? conv.guest_id;
    },
  },
  async (args, service) => {
    const body = args.body.trim();
    if (!body) {
      return { result: { ok: false, error: "Message is empty." }, after: null };
    }

    const { data: conv } = await service
      .from("conversations")
      .select("id, channel, host_id")
      .eq("id", args.conversationId)
      .maybeSingle();
    if (!conv || conv.channel !== "platform") {
      return {
        result: { ok: false, error: "Not a Wielo conversation." },
        after: null,
      };
    }

    // Post AS "Wielo Support". On a HOST thread Wielo is the guest party
    // (read_by_guest=true, unread bumps the host). On a GUEST support thread
    // (host_id NULL) Wielo is the host party (read_by_host=true, unread bumps
    // the guest) — so the read flags invert.
    const isGuestThread = conv.host_id === null;
    const supportId = await ensureWieloSupportUser(service);
    const { data: inserted, error } = await service
      .from("messages")
      .insert({
        conversation_id: args.conversationId,
        sender_id: supportId,
        body,
        read_by_host: isGuestThread ? true : false,
        read_by_guest: isGuestThread ? false : true,
      })
      .select("id, conversation_id, body")
      .single();
    if (error || !inserted) {
      return {
        result: { ok: false, error: "Could not send the message." },
        after: null,
      };
    }

    revalidatePath("/admin/inbox");
    return { result: { ok: true }, after: inserted };
  },
);

export async function adminReplyPlatformAction(input: {
  conversationId: string;
  body: string;
}): Promise<Result> {
  return replyPlatform(input);
}

// Send a payment link to a host's Wielo thread as a rich `payment_link` system
// CARD (icon + product/amount line + Pay button) — used by the revenue ledger's
// "Send to host's inbox" affordance. Distinct from the plain-text sender above.
type ByEmailArgs = {
  email: string;
  url: string;
  productName: string;
  amount: number;
  currency: string;
  reason?: string;
};

// These two are addressed by EMAIL, so the conversation id isn't known until the
// mutation runs and `getTargetId` only sees the args. The email is not a uuid, so
// withAdminAudit coerces target_id to null and keeps the real value in
// payload.args — which is why `getOwnerUserId` matters here: it resolves the host
// behind the email so the send still lands on their History tab.
const sendPaymentLinkToInbox = withAdminAudit<ByEmailArgs, Result>(
  {
    permissionKey: INBOX_PERMISSION,
    actionName: "inbox.send_payment_link",
    targetType: "conversation",
    getTargetId: (args) => args.email,
    getOwnerUserId: async (args, service) => {
      const host = await resolveHostByEmail(service, args.email);
      return host?.userId ?? null;
    },
  },
  async (args, service) => {
    const url = args.url.trim();
    if (!url) {
      return {
        result: { ok: false, error: "No payment link to send." },
        after: null,
      };
    }

    const host = await resolveHostByEmail(service, args.email);
    if (!host) {
      return {
        result: {
          ok: false,
          error: "That email has no host account to message.",
        },
        after: null,
      };
    }

    const amountLabel = formatMoney(args.amount, args.currency || "ZAR");
    const body = `${args.productName} — ${amountLabel} due`;

    try {
      await adminPostPaymentLinkToHostThread(service, {
        host: { id: host.id, userId: host.userId },
        url,
        body,
      });
    } catch (e) {
      return {
        result: {
          ok: false,
          error: e instanceof Error ? e.message : "Could not send the link.",
        },
        after: null,
      };
    }

    revalidatePath("/admin/inbox");
    return { result: { ok: true }, after: { hostId: host.id, body, url } };
  },
);

export async function adminSendPaymentLinkToInboxAction(input: {
  email: string;
  url: string;
  productName: string;
  amount: number;
  currency: string;
}): Promise<Result> {
  return sendPaymentLinkToInbox(input);
}

// Mark a host's Wielo thread read on the Wielo/admin side (clears the admin's
// unread — which lives in unread_guest, since Wielo is the "guest" party).
export async function adminMarkPlatformReadAction(
  conversationId: string,
): Promise<Result> {
  await requirePermission(INBOX_PERMISSION);
  const service = createAdminClient();
  const { data: conv } = await service
    .from("conversations")
    .select("host_id")
    .eq("id", conversationId)
    .maybeSingle();
  // The Wielo/admin unread lives in unread_guest on a host thread but in
  // unread_host on a guest support thread (host_id NULL) — clear the right side.
  const isGuestThread = conv?.host_id === null;
  if (isGuestThread) {
    await service
      .from("messages")
      .update({ read_by_host: true })
      .eq("conversation_id", conversationId)
      .eq("read_by_host", false);
    await service
      .from("conversations")
      .update({ unread_host: 0 })
      .eq("id", conversationId);
  } else {
    await service
      .from("messages")
      .update({ read_by_guest: true })
      .eq("conversation_id", conversationId)
      .eq("read_by_guest", false);
    await service
      .from("conversations")
      .update({ unread_guest: 0 })
      .eq("id", conversationId);
  }
  revalidatePath("/admin/inbox");
  return { ok: true };
}

// Send a message to a host's Wielo thread addressed by email — used by the
// revenue ledger's "Send payment link → to inbox" affordance.
const sendPlatformMessageByEmail = withAdminAudit<
  { email: string; body: string; reason?: string },
  Result
>(
  {
    permissionKey: INBOX_PERMISSION,
    actionName: "inbox.send_message",
    targetType: "conversation",
    getTargetId: (args) => args.email,
    getOwnerUserId: async (args, service) => {
      const host = await resolveHostByEmail(service, args.email);
      return host?.userId ?? null;
    },
  },
  async (args, service) => {
    const body = args.body.trim();
    if (!body) {
      return { result: { ok: false, error: "Message is empty." }, after: null };
    }

    const host = await resolveHostByEmail(service, args.email);
    if (!host) {
      return {
        result: {
          ok: false,
          error: "That email has no host account to message.",
        },
        after: null,
      };
    }

    try {
      await adminPostToHostThread(service, {
        host: { id: host.id, userId: host.userId },
        body,
      });
    } catch (e) {
      return {
        result: {
          ok: false,
          error: e instanceof Error ? e.message : "Could not send the message.",
        },
        after: null,
      };
    }

    revalidatePath("/admin/inbox");
    return { result: { ok: true }, after: { hostId: host.id, body } };
  },
);

export async function adminSendPlatformMessageByEmailAction(input: {
  email: string;
  body: string;
}): Promise<Result> {
  return sendPlatformMessageByEmail(input);
}
