"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

import {
  markGuestConversationReadAction,
  sendGuestMessageAction,
} from "../actions";

export type GuestMessage = {
  id: string;
  senderId: string | null;
  body: string | null;
  isSystem: boolean;
  createdAt: string;
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GuestThread({
  conversationId,
  selfId,
  hostName,
  listingName,
  messages,
}: {
  conversationId: string;
  selfId: string;
  hostName: string;
  listingName: string | null;
  messages: GuestMessage[];
}) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  // Refresh the thread in realtime when a new message lands.
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
        () => window.location.reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Mark read on mount.
  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    void markGuestConversationReadAction(conversationId);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);

  function submit() {
    const text = value.trim();
    if (!text || pending) return;
    start(async () => {
      const result = await sendGuestMessageAction({
        conversation_id: conversationId,
        body: text,
      });
      if (result.ok) {
        setValue("");
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="border-b border-brand-line px-5 py-3.5">
        <div className="font-display text-[15px] font-bold text-brand-ink">
          {hostName}
        </div>
        {listingName ? (
          <div className="text-[12px] text-brand-mute">{listingName}</div>
        ) : null}
      </div>

      <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-brand-mute">
            No messages yet.
          </p>
        ) : (
          messages.map((m) => {
            if (m.isSystem) {
              return (
                <div key={m.id} className="text-center">
                  <span className="inline-block rounded-pill bg-brand-light px-3 py-1 text-[11.5px] text-brand-mute">
                    {m.body}
                  </span>
                </div>
              );
            }
            const mine = m.senderId === selfId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[78%]">
                  <div
                    className={`whitespace-pre-line rounded-[14px] px-3.5 py-2 text-[13.5px] leading-relaxed ${
                      mine
                        ? "rounded-br-sm bg-brand-primary text-white"
                        : "rounded-bl-sm bg-brand-light text-brand-ink"
                    }`}
                  >
                    {m.body}
                  </div>
                  <div
                    className={`mt-1 font-mono text-[10.5px] text-brand-mute ${
                      mine ? "text-right" : ""
                    }`}
                  >
                    {fmtTime(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-brand-line p-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 4000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={`Message ${hostName}…`}
          disabled={pending}
          className="min-h-[44px] flex-1 resize-none rounded-[10px] border border-brand-line px-3 py-2 text-[13.5px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-brand-primary text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
