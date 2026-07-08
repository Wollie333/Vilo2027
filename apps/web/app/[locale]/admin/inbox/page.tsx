import { requirePermission } from "@/lib/admin";
import type { ChatMessage } from "@/components/inbox/ChatMessageWall";
import { ensureWieloSupportUser } from "@/lib/inbox/platform-thread";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminInboxView, type AdminConversation } from "./AdminInboxView";

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
      `id, host_id, unread_guest, last_message_at, last_message_preview, created_at,
       host:hosts ( id, display_name, handle, user_id, avatar_url )`,
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
  type Raw = {
    id: string;
    host_id: string;
    unread_guest: number;
    last_message_at: string | null;
    last_message_preview: string | null;
    created_at: string;
    host: Host | Host[] | null;
  };
  const one = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  const conversations: AdminConversation[] = ((convRows ?? []) as Raw[]).map(
    (c) => {
      const host = one(c.host);
      return {
        id: c.id,
        hostId: c.host_id,
        hostUserId: host?.user_id ?? null,
        hostName: host?.display_name ?? null,
        hostHandle: host?.handle ?? null,
        hostAvatarUrl: host?.avatar_url ?? null,
        unread: c.unread_guest ?? 0,
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
  if (selectedId) {
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
  }

  return (
    <AdminInboxView
      conversations={conversations}
      selectedId={selectedId}
      messages={messages}
      selfId={supportUserId}
    />
  );
}
