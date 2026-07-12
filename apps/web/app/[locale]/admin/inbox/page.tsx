import { requirePermission } from "@/lib/admin";
import type { ChatMessage } from "@/components/inbox/ChatMessageWall";
import { ensureWieloSupportUser } from "@/lib/inbox/platform-thread";
import { getSubscriptionProducts } from "@/lib/products/getProducts";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  AdminInboxView,
  type AdminConversation,
  type HostDetails,
} from "./AdminInboxView";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams?: { c?: string };
}) {
  await requirePermission("notifications.send_individual");
  const service = createAdminClient();

  const supportUserId = await ensureWieloSupportUser(service);

  const { data: convRows } = await service
    .from("conversations")
    .select(
      `id, host_id, unread_guest, unread_host, last_message_at, last_message_preview, created_at,
       host:hosts ( id, display_name, handle, user_id, avatar_url ),
       guest:user_profiles!conversations_guest_id_fkey ( id, full_name, email, avatar_url )`,
    )
    .eq("channel", "platform")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);

  type Host = {
    id: string;
    display_name: string | null;
    handle: string | null;
    user_id: string;
    avatar_url: string | null;
  };
  type Guest = {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  type Raw = {
    id: string;
    host_id: string | null;
    unread_guest: number;
    unread_host: number;
    last_message_at: string | null;
    last_message_preview: string | null;
    created_at: string;
    host: Host | Host[] | null;
    guest: Guest | Guest[] | null;
  };
  const one = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  const conversations: AdminConversation[] = ((convRows ?? []) as Raw[]).map(
    (c) => {
      // host_id NULL → guest↔Wielo support thread: the counterparty is the guest
      // and the admin's unread lives in unread_host (see the message trigger).
      const isGuest = c.host_id === null;
      const host = one(c.host);
      const guest = one(c.guest);
      return {
        id: c.id,
        hostId: c.host_id,
        hostUserId: isGuest ? (guest?.id ?? null) : (host?.user_id ?? null),
        hostName: isGuest
          ? (guest?.full_name ?? guest?.email ?? null)
          : (host?.display_name ?? null),
        hostHandle: isGuest ? null : (host?.handle ?? null),
        hostAvatarUrl: isGuest
          ? (guest?.avatar_url ?? null)
          : (host?.avatar_url ?? null),
        isGuest,
        unread: (isGuest ? c.unread_host : c.unread_guest) ?? 0,
        lastMessageAt: c.last_message_at,
        lastMessagePreview: c.last_message_preview,
        createdAt: c.created_at,
      };
    },
  );

  const selectedId =
    (searchParams?.c &&
      conversations.find((c) => c.id === searchParams.c)?.id) ??
    null;

  let messages: ChatMessage[] = [];
  let hostDetails: HostDetails | null = null;
  if (selectedId) {
    const sel = conversations.find((c) => c.id === selectedId)!;
    const { data: msgs } = await service
      .from("messages")
      .select(
        "id, sender_id, body, attachment_url, attachment_filename, is_system_message, system_event, quote_id, quote_version_no, read_by_host, read_by_guest, created_at",
      )
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: true });
    messages = (msgs ?? []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      isSystem: m.is_system_message,
      systemEvent: m.system_event,
      quoteId: (m as { quote_id: string | null }).quote_id ?? null,
      quoteVersionNo:
        (m as { quote_version_no: number | null }).quote_version_no ?? null,
      readByHost: m.read_by_host,
      readByGuest: m.read_by_guest,
      createdAt: m.created_at,
      attachmentUrl: m.attachment_url,
      attachmentFilename: m.attachment_filename,
    }));

    if (sel.isGuest) {
      // Guest↔Wielo support thread: no host account — show the guest's identity.
      const { data: gp } = sel.hostUserId
        ? await service
            .from("user_profiles")
            .select("email, phone, created_at")
            .eq("id", sel.hostUserId)
            .maybeSingle()
        : { data: null };
      hostDetails = {
        isGuest: true,
        hostId: null,
        userId: sel.hostUserId,
        name: sel.hostName,
        handle: null,
        avatarUrl: sel.hostAvatarUrl,
        email: gp?.email ?? null,
        phone: (gp as { phone?: string | null } | null)?.phone ?? null,
        memberSince: gp?.created_at ?? null,
        plan: null,
        planStatus: null,
        billingCycle: null,
        renewsAt: null,
        listings: 0,
        netToWielo: 0,
        currency: "ZAR",
      };
      return (
        <AdminInboxView
          conversations={conversations}
          selectedId={selectedId}
          messages={messages}
          selfId={supportUserId}
          hostDetails={hostDetails}
        />
      );
    }

    // Enrich the Details panel with this host's account snapshot.
    const [
      { data: profile },
      { data: sub },
      { count: listings },
      { data: led },
      products,
    ] = await Promise.all([
      sel.hostUserId
        ? service
            .from("user_profiles")
            .select("email, phone, created_at")
            .eq("id", sel.hostUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      service
        .from("subscriptions")
        .select("plan, status, billing_cycle, current_period_end, product_id")
        .eq("host_id", sel.hostId)
        .maybeSingle(),
      service
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("host_id", sel.hostId)
        .is("deleted_at", null),
      sel.hostUserId
        ? service
            .from("platform_ledger")
            .select("amount, currency, type, status")
            .eq("user_id", sel.hostUserId)
            .eq("status", "completed")
        : Promise.resolve({ data: null }),
      getSubscriptionProducts(),
    ]);

    const ledRows = (led ?? []) as { amount: number; currency: string }[];
    const netToWielo = ledRows.reduce((a, r) => a + Number(r.amount), 0);

    // Show the REAL product name (e.g. "Starter"), resolved from the linked
    // product, else the plan tier's product name, else the raw plan.
    const planLabels: Record<string, string> = {};
    const productById = new Map<string, string>();
    for (const p of products) {
      productById.set(p.id, p.name);
      if (p.planKey && !(p.planKey in planLabels))
        planLabels[p.planKey] = p.name;
    }
    const subProductId = (sub as { product_id?: string | null } | null)
      ?.product_id;
    const planDisplay =
      (subProductId ? productById.get(subProductId) : null) ??
      (sub?.plan ? (planLabels[sub.plan] ?? sub.plan) : null);

    hostDetails = {
      isGuest: false,
      hostId: sel.hostId,
      userId: sel.hostUserId,
      name: sel.hostName,
      handle: sel.hostHandle,
      avatarUrl: sel.hostAvatarUrl,
      email: profile?.email ?? null,
      phone: (profile as { phone?: string | null } | null)?.phone ?? null,
      memberSince: profile?.created_at ?? null,
      plan: planDisplay,
      planStatus: sub?.status ?? null,
      billingCycle: sub?.billing_cycle ?? null,
      renewsAt: sub?.current_period_end ?? null,
      listings: listings ?? 0,
      netToWielo,
      currency: ledRows[0]?.currency ?? "ZAR",
    };
  }

  return (
    <AdminInboxView
      conversations={conversations}
      selectedId={selectedId}
      messages={messages}
      selfId={supportUserId}
      hostDetails={hostDetails}
    />
  );
}
