"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { ChatComposer } from "@/components/inbox/ChatComposer";
import {
  ChatMessageWall,
  type ChatMessage,
} from "@/components/inbox/ChatMessageWall";
import { ChatThreadHeader } from "@/components/inbox/ChatThreadHeader";
import type {
  ThreadBooking,
  ThreadQuote,
} from "@/components/inbox/ThreadQuoteCard";
import { createClient } from "@/lib/supabase/client";

import {
  markGuestConversationReadAction,
  sendGuestMessageAction,
} from "../actions";

export type GuestMessage = ChatMessage;

export function GuestThread({
  conversationId,
  selfId,
  hostName,
  hostAvatarUrl,
  listingName,
  messages,
  quotesById,
  bookingsById,
}: {
  conversationId: string;
  selfId: string;
  hostName: string;
  hostAvatarUrl: string | null;
  listingName: string | null;
  messages: GuestMessage[];
  quotesById: Record<string, ThreadQuote>;
  bookingsById: Record<string, ThreadBooking>;
}) {
  const router = useRouter();
  const markedRef = useRef(false);

  // Refresh the thread in realtime when a new message lands, and when read
  // flags flip (so sent-tick receipts turn blue live once the host reads).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`guest-thread-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, router]);

  // Mark read on mount.
  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    void markGuestConversationReadAction(conversationId);
  }, [conversationId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <ChatThreadHeader
        name={hostName}
        subtitle={listingName}
        avatarUrl={hostAvatarUrl}
        backHref="/portal/inbox"
      />
      <ChatMessageWall
        messages={messages}
        selfId={selfId}
        viewer="guest"
        quotesById={quotesById}
        bookingsById={bookingsById}
        emptyText="No messages yet — say hello."
      />
      <ChatComposer
        onSend={async (text) => {
          const result = await sendGuestMessageAction({
            conversation_id: conversationId,
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
  );
}
