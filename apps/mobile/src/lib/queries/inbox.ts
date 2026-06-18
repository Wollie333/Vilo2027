import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Conversation = {
  id: string;
  status: string;
  pinned: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_guest: number;
  hosts: { display_name: string; avatar_url: string | null } | null;
  properties: { name: string } | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string | null;
  created_at: string;
  is_system_message: boolean;
  read_by_host: boolean;
  read_by_guest: boolean;
};

const CONVERSATION_SELECT =
  "id, status, pinned, last_message_at, last_message_preview, unread_guest, hosts(display_name, avatar_url), properties(name)";

async function fetchConversations(guestId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("guest_id", guestId)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

/** Guest's conversations (Inbox). */
export function useConversations(guestId: string | undefined) {
  return useQuery({
    queryKey: ["conversations", guestId],
    queryFn: () => fetchConversations(guestId as string),
    enabled: !!guestId,
  });
}

async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, body, created_at, is_system_message, read_by_host, read_by_guest",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => fetchMessages(conversationId as string),
    enabled: !!conversationId,
  });
}

/** Send a message — direct insert (RLS-scoped). Web sees it instantly via the same table. */
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      senderId,
    }: {
      body: string;
      senderId: string;
    }) => {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: senderId,
        body,
        read_by_guest: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/** Subscribe to new messages in a conversation; refetch on change. Cleans up on unmount. */
export function useMessagesRealtime(conversationId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", conversationId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);
}
