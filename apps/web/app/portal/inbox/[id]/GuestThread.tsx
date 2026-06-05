"use client";

import { KeyRound, Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  ThreadQuoteCard,
  type ThreadBooking,
  type ThreadQuote,
} from "@/components/inbox/ThreadQuoteCard";
import { firstQuoteMessageIds } from "@/components/inbox/quote-thread";
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
  systemEvent: string | null;
  quoteId: string | null;
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

function hostInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "H"
  );
}

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
  // One inline card per quote, at its first message — reflects the quote's
  // live state (request → sent quote with an accept button).
  const quoteCardMsgIds = firstQuoteMessageIds(messages, quotesById);
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
      <div className="flex items-center gap-3 border-b border-brand-line px-5 py-3.5">
        {hostAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hostAvatarUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[12px] font-bold text-white">
            {hostInitials(hostName)}
          </span>
        )}
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold text-brand-ink">
            {hostName}
          </div>
          {listingName ? (
            <div className="truncate text-[12px] text-brand-mute">
              {listingName}
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-brand-mute">
            No messages yet.
          </p>
        ) : (
          messages.map((m) => {
            if (
              m.quoteId &&
              quoteCardMsgIds.has(m.id) &&
              quotesById[m.quoteId]
            ) {
              const q = quotesById[m.quoteId];
              return (
                <ThreadQuoteCard
                  key={m.id}
                  quote={q}
                  booking={
                    q.convertedBookingId
                      ? (bookingsById[q.convertedBookingId] ?? null)
                      : null
                  }
                  viewer="guest"
                />
              );
            }
            if (m.isSystem && m.systemEvent === "access_details") {
              return (
                <div
                  key={m.id}
                  className="rounded-card border border-brand-primary/30 bg-brand-accent/30 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <span className="font-display text-[14px] font-bold text-brand-ink">
                      Access details
                    </span>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-brand-ink">
                    {m.body}
                  </pre>
                  <div className="mt-1 font-mono text-[10.5px] text-brand-mute">
                    {fmtTime(m.createdAt)}
                  </div>
                </div>
              );
            }
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
                className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
              >
                {!mine ? (
                  hostAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hostAvatarUrl}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[10px] font-bold text-white">
                      {hostInitials(hostName)}
                    </span>
                  )
                ) : null}
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
