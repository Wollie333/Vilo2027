"use client";

import { ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ChatComposer } from "@/components/inbox/ChatComposer";
import {
  ChatMessageWall,
  type ChatMessage,
} from "@/components/inbox/ChatMessageWall";
import { ChatThreadHeader } from "@/components/inbox/ChatThreadHeader";
import {
  ConversationList,
  ConversationRow,
} from "@/components/inbox/ConversationList";
import { createClient } from "@/lib/supabase/client";

import {
  adminMarkPlatformReadAction,
  adminReplyPlatformAction,
} from "./actions";

export type AdminConversation = {
  id: string;
  hostId: string;
  hostUserId: string | null;
  hostName: string | null;
  hostHandle: string | null;
  hostAvatarUrl: string | null;
  unread: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
};

type Filter = "all" | "unread";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
];

// The Wielo support inbox — every host↔Wielo (platform) thread, built on the
// SAME chat components as the host/guest inbox so it looks identical.
export function AdminInboxView({
  conversations,
  selectedId,
  messages,
  selfId,
}: {
  conversations: AdminConversation[];
  selectedId: string | null;
  messages: ChatMessage[];
  /** The Wielo Support participant id — the admin's "self" side for alignment. */
  selfId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const threadOpen = Boolean(selected);

  // Mark read on open (clears the admin-side unread).
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId || markedRef.current === selectedId) return;
    markedRef.current = selectedId;
    if (selected && selected.unread > 0) {
      void adminMarkPlatformReadAction(selectedId).then(() => router.refresh());
    }
  }, [selectedId, selected, router]);

  // Realtime: refresh on any message/conversation change.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("admin-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [router]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if (
        needle &&
        !`${c.hostName ?? ""} ${c.hostHandle ?? ""} ${c.lastMessagePreview ?? ""}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [conversations, filter, q]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Support inbox
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Your direct message line with every host. Each message lands in the
          host&apos;s own inbox under a pinned &ldquo;Wielo Support&rdquo;
          thread.
        </p>
      </header>

      <div className="flex h-[calc(100vh-230px)] min-h-[520px] overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {/* List pane */}
        <aside
          className={`min-h-0 w-full shrink-0 flex-col border-r border-brand-line sm:flex sm:w-[340px] ${
            threadOpen ? "hidden sm:flex" : "flex"
          }`}
        >
          <ConversationList
            title="Hosts"
            search={q}
            onSearchChange={setQ}
            searchPlaceholder="Search hosts…"
            filters={FILTERS}
            activeFilter={filter}
            onFilterChange={setFilter}
            isEmpty={shown.length === 0}
            emptyText={
              conversations.length === 0
                ? "A thread appears once a host opens their inbox or you message them from the ledger."
                : "No conversations match."
            }
          >
            {shown.map((c) => (
              <ConversationRow
                key={c.id}
                href={`/admin/inbox?c=${c.id}`}
                active={c.id === selectedId}
                name={c.hostName || c.hostHandle || "Host"}
                avatarUrl={c.hostAvatarUrl}
                chip={{ label: "Host", tone: "green" }}
                listingName={c.hostHandle ? `@${c.hostHandle}` : null}
                preview={c.lastMessagePreview}
                lastAt={c.lastMessageAt ?? c.createdAt}
                unread={c.unread}
              />
            ))}
          </ConversationList>
        </aside>

        {/* Thread pane */}
        <div
          className={`relative min-h-0 min-w-0 flex-1 flex-col bg-[#E6EFE9] ${
            threadOpen ? "flex" : "hidden sm:flex"
          }`}
        >
          {selected ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <ChatThreadHeader
                name={selected.hostName || selected.hostHandle || "Host"}
                subtitle={
                  selected.hostHandle ? `@${selected.hostHandle}` : null
                }
                avatarUrl={selected.hostAvatarUrl}
                onBack={() => router.push("/admin/inbox")}
              />
              <ChatMessageWall
                messages={messages}
                selfId={selfId}
                viewer="guest"
                quotesById={{}}
                bookingsById={{}}
                emptyText="No messages yet — say hello."
              />
              <ChatComposer
                placeholder={`Reply to ${selected.hostName?.split(" ")[0] ?? "the host"}…`}
                onSend={async (text) => {
                  const r = await adminReplyPlatformAction({
                    conversationId: selected.id,
                    body: text,
                  });
                  if (r.ok) {
                    router.refresh();
                    return true;
                  }
                  toast.error(r.error);
                  return false;
                }}
              />
            </div>
          ) : (
            <div className="flex h-full flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-xs">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-primary shadow-sm">
                  <ReceiptText className="h-6 w-6" />
                </div>
                <p className="font-display text-[15px] font-bold text-brand-ink">
                  Support inbox
                </p>
                <p className="mt-1 text-[13px] text-brand-mute">
                  Pick a host on the left to read and reply.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
