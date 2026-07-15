"use client";

import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ChatComposer } from "@/components/inbox/ChatComposer";
import { ChatMessageWall } from "@/components/inbox/ChatMessageWall";
import { InboxAvatar } from "@/components/inbox/InboxAvatar";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import {
  markGuestConversationReadAction,
  sendGuestMessageAction,
  touchGuestSeenAction,
} from "../../inbox/actions";
import type { RequestRecordData, RecordResponse } from "./record-data";

// Messages tab of the request record: every host who quoted lives in a left
// rail; picking one opens that conversation inline (same WhatsApp-style wall +
// composer the inbox uses) so the guest reads, replies, and sees the quote card
// without leaving the record.
export function RequestMessages({ data }: { data: RequestRecordData }) {
  const router = useRouter();
  const threads = useMemo(
    () =>
      data.responses.filter(
        (
          r,
        ): r is RecordResponse & {
          thread: NonNullable<RecordResponse["thread"]>;
        } => !!r.thread,
      ),
    [data.responses],
  );
  const [activeId, setActiveId] = useState<string | null>(
    threads[0]?.thread.conversationId ?? null,
  );
  const markedRef = useRef<Set<string>>(new Set());

  const active = threads.find((t) => t.thread.conversationId === activeId);

  // Realtime: refresh when a message lands / read flags flip on any of the
  // record's threads (mirrors the inbox GuestThread behaviour).
  useEffect(() => {
    if (threads.length === 0) return;
    const supabase = createClient();
    const ids = threads.map((t) => t.thread.conversationId);
    const channel = supabase.channel(`lf-record-${data.post.id}`);
    for (const cid of ids) {
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${cid}`,
          },
          () => {
            void touchGuestSeenAction();
            router.refresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${cid}`,
          },
          () => router.refresh(),
        );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threads, data.post.id, router]);

  // Mark the open thread read (once per conversation per mount).
  useEffect(() => {
    if (!activeId) return;
    if (markedRef.current.has(activeId)) return;
    markedRef.current.add(activeId);
    void markGuestConversationReadAction(activeId);
    void touchGuestSeenAction();
  }, [activeId]);

  if (threads.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand-mute">
          <MessageSquare className="h-5 w-5" />
        </div>
        <h3 className="font-medium text-brand-ink">No messages yet</h3>
        <p className="mt-1 text-sm text-brand-mute">
          When a host sends you a quote, your conversation with them appears
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
      {/* Host thread rail */}
      <div className="space-y-1.5">
        {threads.map((t) => {
          const isActive = t.thread.conversationId === activeId;
          return (
            <button
              key={t.thread.conversationId}
              type="button"
              onClick={() => setActiveId(t.thread.conversationId)}
              className={`flex w-full items-center gap-3 rounded-card border p-2.5 text-left transition ${
                isActive
                  ? "border-brand-primary bg-brand-light"
                  : "border-brand-line bg-white hover:bg-brand-light/60"
              }`}
            >
              <InboxAvatar
                name={t.host.name}
                imageUrl={t.host.avatarUrl}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-brand-ink">
                    {t.host.name}
                  </p>
                  {t.thread.unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary px-1.5 text-[11px] font-semibold text-white">
                      {t.thread.unread}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-brand-mute">
                  {t.thread.lastMessagePreview ?? "Quote sent"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected conversation */}
      {active ? (
        <div className="flex h-[560px] min-h-0 flex-col overflow-hidden rounded-card border border-brand-line bg-white">
          <div className="flex items-center gap-3 border-b border-brand-line px-4 py-3">
            <InboxAvatar
              name={active.host.name}
              imageUrl={active.host.avatarUrl}
              size={40}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-ink">
                {active.host.name}
              </p>
              {active.quote && (
                <p className="text-xs text-brand-mute">
                  Quote{" "}
                  {formatMoney(active.quote.totalAmount, active.quote.currency)}
                </p>
              )}
            </div>
          </div>
          <ChatMessageWall
            messages={active.thread.messages}
            selfId={data.selfId}
            viewer="guest"
            quotesById={data.quotesById}
            bookingsById={data.bookingsById}
            emptyText="No messages yet — say hello."
          />
          <ChatComposer
            onSend={async (text) => {
              const result = await sendGuestMessageAction({
                conversation_id: active.thread.conversationId,
                body: text,
              });
              if (result.ok) {
                router.refresh();
                return true;
              }
              toast.error(result.error);
              return false;
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
