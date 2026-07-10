import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// The host↔Wielo (platform / support) inbox thread. Reuses the existing
// conversations/messages tables: a platform conversation is a normal row with
// channel='platform', host_id = the host, guest_id = the fixed "Wielo Support"
// account — so it appears in the host's existing inbox and renders with the same
// chat UI. This module owns (a) the Wielo Support participant and (b) the
// find-or-create of a host's always-present, pinned Wielo thread.

type Admin = ReturnType<typeof createAdminClient>;

export const WIELO_SUPPORT_EMAIL = "support@wielo.co.za";
const WIELO_SUPPORT_NAME = "Wielo Support";
const SUPPORT_SETTINGS_KEY = "wielo_support_user_id";

const WELCOME_BODY =
  "👋 This is your direct line to the Wielo team. Ask us anything about your subscription, billing or account — just reply here and we'll get back to you.";

// The user_profiles id that represents "Wielo" as the counterparty on every
// platform thread. Resolved once and cached in platform_settings so the same
// account is reused (and can be swapped to a dedicated support account later).
// Created like a lead identity (auth user + profile) the first time.
export async function ensureWieloSupportUser(admin: Admin): Promise<string> {
  // 1) Cached in settings?
  const { data: setting } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", SUPPORT_SETTINGS_KEY)
    .maybeSingle();
  const cached =
    setting?.value && typeof setting.value === "object"
      ? (setting.value as { id?: string }).id
      : typeof setting?.value === "string"
        ? (setting.value as string)
        : null;
  if (cached) {
    const { data: exists } = await admin
      .from("user_profiles")
      .select("id")
      .eq("id", cached)
      .maybeSingle();
    if (exists) return exists.id as string;
  }

  // 2) Existing profile by the support email?
  const { data: byEmail } = await admin
    .from("user_profiles")
    .select("id")
    .ilike("email", WIELO_SUPPORT_EMAIL)
    .maybeSingle();
  let id = byEmail?.id as string | undefined;

  // 3) Create the account (auth user + profile) if it doesn't exist yet.
  if (!id) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: WIELO_SUPPORT_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: WIELO_SUPPORT_NAME },
    });
    if (error || !created.user) {
      throw new Error(
        `ensureWieloSupportUser: ${error?.message ?? "could not create support account"}`,
      );
    }
    id = created.user.id;
    await admin
      .from("user_profiles")
      .update({ full_name: WIELO_SUPPORT_NAME, role: "guest", is_lead: false })
      .eq("id", id);
  }

  // 4) Cache it.
  await admin
    .from("platform_settings")
    .upsert(
      { key: SUPPORT_SETTINGS_KEY, value: { id } },
      { onConflict: "key" },
    );

  return id;
}

// Find-or-create a host's platform (Wielo) conversation. Always pinned so it
// stays at the top of the host's inbox, and seeded with a welcome message the
// first time so it's never empty. Idempotent — returns the existing thread on
// subsequent calls. Pass the host row + its owner user id.
export async function ensureWieloThread(
  admin: Admin,
  host: { id: string; userId: string },
): Promise<string> {
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("host_id", host.id)
    .eq("channel", "platform")
    .maybeSingle();
  if (existing) return existing.id as string;

  const supportId = await ensureWieloSupportUser(admin);

  const { data: conv, error } = await admin
    .from("conversations")
    .insert({
      host_id: host.id,
      guest_id: supportId,
      channel: "platform",
      status: "open",
      is_enquiry: false,
      pinned: true,
    })
    .select("id")
    .single();
  if (error || !conv) {
    throw new Error(
      `ensureWieloThread: ${error?.message ?? "could not create thread"}`,
    );
  }

  // Seed the welcome from the Wielo side. The AFTER-INSERT message trigger sets
  // last_message_* and bumps unread_host (sender isn't the host).
  await admin.from("messages").insert({
    conversation_id: conv.id,
    sender_id: supportId,
    body: WELCOME_BODY,
    read_by_host: false,
    read_by_guest: true,
  });

  return conv.id as string;
}

// Resolve a host (id + owner user id) from an email — the host's owner account.
export async function resolveHostByEmail(
  admin: Admin,
  email: string,
): Promise<{ id: string; userId: string; name: string | null } | null> {
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();
  if (!profile) return null;
  const { data: host } = await admin
    .from("hosts")
    .select("id, display_name")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) return null;
  return {
    id: host.id as string,
    userId: profile.id as string,
    name: (host.display_name as string) ?? null,
  };
}

// Post a message from the Wielo/admin side into a host's platform thread
// (ensuring the thread exists). read_by_guest=true (the Wielo side authored it),
// read_by_host=false → the unread trigger bumps the host's badge.
export async function adminPostToHostThread(
  admin: Admin,
  args: {
    host: { id: string; userId: string };
    body: string;
  },
): Promise<string> {
  const conversationId = await ensureWieloThread(admin, args.host);
  const supportId = await ensureWieloSupportUser(admin);
  // Post AS "Wielo Support" (not the individual admin) so the host always sees a
  // single branded counterparty and both inboxes align consistently.
  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: supportId,
    body: args.body,
    read_by_host: false,
    read_by_guest: true,
  });
  if (error) throw new Error(`adminPostToHostThread: ${error.message}`);
  return conversationId;
}

// Post a message into a host's Wielo thread FROM the host side (e.g. a self-serve
// cancellation request). sender = the host's owner user; read_by_host=true (they
// sent it), read_by_guest=false → the unread trigger bumps the Wielo/admin side so
// it surfaces as unread in /admin/inbox.
export async function hostPostToWieloThread(
  admin: Admin,
  args: {
    host: { id: string; userId: string };
    body: string;
    // Optional rich system card (e.g. "subscription_paused",
    // "cancellation_requested") — ChatMessageWall renders these as a card.
    systemEvent?: string;
  },
): Promise<string> {
  const conversationId = await ensureWieloThread(admin, args.host);
  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: args.host.userId,
    body: args.body,
    is_system_message: !!args.systemEvent,
    system_event: args.systemEvent ?? null,
    read_by_host: true,
    read_by_guest: false,
  });
  if (error) throw new Error(`hostPostToWieloThread: ${error.message}`);
  return conversationId;
}

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// Post a subscription UPGRADE card into a host's Wielo thread: a rich
// `subscription_upgrade` SYSTEM message (icon + plan + amount + Pay button) that
// the buyer taps to pay the pro-rated difference. Deferred activation — the plan
// switches on only once this link is paid. Posted AS "Wielo Support".
export async function adminPostUpgradeCardToHostThread(
  admin: Admin,
  args: {
    host: { id: string; userId: string };
    url: string;
    productName: string;
    amount: number;
    currency: string;
    isUpgrade: boolean;
  },
): Promise<string> {
  const conversationId = await ensureWieloThread(admin, args.host);
  const supportId = await ensureWieloSupportUser(admin);
  const money = fmtMoney(args.amount, args.currency);
  const body = args.isUpgrade
    ? `You're upgrading to ${args.productName}. Pay ${money} to activate your new plan — it switches on the moment your payment succeeds.`
    : `Activate ${args.productName} — pay ${money} to switch it on. It takes effect as soon as your payment succeeds.`;
  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: supportId,
    body,
    is_system_message: true,
    system_event: "subscription_upgrade",
    attachment_url: args.url,
    read_by_host: false,
    read_by_guest: true,
  });
  if (error)
    throw new Error(`adminPostUpgradeCardToHostThread: ${error.message}`);
  return conversationId;
}

// Flip a buyer's pay CARD in their Wielo thread to reflect the payment's state:
// "pending" (EFT details shown → awaiting the transfer) or "received" (settled).
// Matches the card by the order's pay-token in its attachment_url; no-op if the
// buyer has no host/thread/card (best-effort — never breaks the money path).
export async function setPayCardStatus(
  admin: Admin,
  args: {
    userId: string | null;
    payToken: string;
    status: "pending" | "received";
  },
): Promise<void> {
  try {
    if (!args.userId) return;
    const { data: host } = await admin
      .from("hosts")
      .select("id")
      .eq("user_id", args.userId)
      .maybeSingle();
    if (!host) return;
    const { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("host_id", host.id)
      .eq("channel", "platform")
      .maybeSingle();
    if (!conv) return;
    const event =
      args.status === "received" ? "payment_received" : "payment_pending";
    await admin
      .from("messages")
      .update({ system_event: event, is_system_message: true })
      .eq("conversation_id", conv.id)
      .in("system_event", [
        "payment_link",
        "subscription_upgrade",
        "payment_pending",
      ])
      .ilike("attachment_url", `%/pay/product/${args.payToken}%`);
  } catch {
    // best-effort
  }
}

// Post a payment link into a host's Wielo thread as a rich `payment_link` SYSTEM
// message so ChatMessageWall renders the pay CARD (icon + product/amount line +
// Pay button) rather than a plain text URL. Posted AS "Wielo Support".
export async function adminPostPaymentLinkToHostThread(
  admin: Admin,
  args: {
    host: { id: string; userId: string };
    url: string;
    body: string;
  },
): Promise<string> {
  const conversationId = await ensureWieloThread(admin, args.host);
  const supportId = await ensureWieloSupportUser(admin);
  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: supportId,
    body: args.body,
    is_system_message: true,
    system_event: "payment_link",
    attachment_url: args.url,
    read_by_host: false,
    read_by_guest: true,
  });
  if (error)
    throw new Error(`adminPostPaymentLinkToHostThread: ${error.message}`);
  return conversationId;
}
