"use client";

import {
  ArrowLeft,
  CheckCheck,
  KeyRound,
  Loader2,
  SendHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  ThreadQuoteCard,
  type ThreadBooking,
  type ThreadQuote,
} from "@/components/inbox/ThreadQuoteCard";
import {
  latestIssuedVersionByQuote,
  quoteCardKind,
} from "@/components/inbox/quote-thread";
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
  quoteVersionNo: number | null;
  readByHost: boolean;
  readByGuest: boolean;
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

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
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
  // Event-sourced: one immutable card per lifecycle message. Earlier issued
  // versions grey out as superseded; the latest stays live with the accept CTA.
  const latestIssued = latestIssuedVersionByQuote(messages);
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
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
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* Conversation header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-brand-line bg-white px-4 py-3">
        <Link
          href="/portal/inbox"
          aria-label="Back to messages"
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light hover:text-brand-ink lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {hostAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hostAvatarUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[13px] font-bold text-white">
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

      {/* Message wall */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto bg-[#E6EFE9]">
        <div className="mx-auto max-w-[760px] space-y-1 px-4 py-5">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#5B7065]">
              No messages yet — say hello.
            </p>
          ) : (
            messages.map((m, i) => {
              const showDay =
                i === 0 ||
                fmtDayLabel(messages[i - 1].createdAt) !==
                  fmtDayLabel(m.createdAt);
              const dayPill = showDay ? (
                <div className="flex justify-center py-3">
                  <span className="rounded-lg bg-[#DCEAE0] px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-[#3F6155] shadow-sm">
                    {fmtDayLabel(m.createdAt)}
                  </span>
                </div>
              ) : null;

              const kind =
                m.quoteId && quotesById[m.quoteId]
                  ? quoteCardKind(m.systemEvent)
                  : null;
              if (kind && m.quoteId) {
                const q = quotesById[m.quoteId];
                const superseded =
                  kind === "request"
                    ? q.status !== "draft"
                    : kind === "issued"
                      ? (m.quoteVersionNo ?? 1) < (latestIssued[m.quoteId] ?? 1)
                      : false;
                return (
                  <div key={m.id}>
                    {dayPill}
                    <div className="py-1">
                      <ThreadQuoteCard
                        quote={q}
                        kind={kind}
                        superseded={superseded}
                        snapshotBody={m.body}
                        booking={
                          kind === "converted" && q.convertedBookingId
                            ? (bookingsById[q.convertedBookingId] ?? null)
                            : null
                        }
                        viewer="guest"
                      />
                    </div>
                  </div>
                );
              }
              if (m.isSystem && m.systemEvent === "access_details") {
                return (
                  <div key={m.id}>
                    {dayPill}
                    <div className="mx-auto my-1 max-w-[420px] rounded-card border border-brand-primary/30 bg-white p-4 shadow-sm">
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
                  </div>
                );
              }
              if (m.isSystem) {
                return (
                  <div key={m.id}>
                    {dayPill}
                    <div className="flex justify-center py-1.5">
                      <span className="max-w-[80%] rounded-lg bg-[#FBF6E3] px-3.5 py-1.5 text-center text-[11.5px] leading-snug text-[#8A6D2B] shadow-sm">
                        {m.body}
                      </span>
                    </div>
                  </div>
                );
              }
              const mine = m.senderId === selfId;
              return (
                <div key={m.id}>
                  {dayPill}
                  <div
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] whitespace-pre-line rounded-[9px] px-2.5 py-1.5 text-[14px] leading-relaxed shadow-sm ${
                        mine
                          ? "rounded-tr-sm bg-[#C7EFD7] text-[#0C2A1E]"
                          : "rounded-tl-sm bg-white text-[#0C2A1E]"
                      }`}
                    >
                      <span>{m.body}</span>
                      <span className="float-right ml-2.5 mt-2 inline-flex items-center gap-1 font-mono text-[10px] leading-none text-[#6B8B7F]">
                        {fmtClock(m.createdAt)}
                        {mine ? (
                          <CheckCheck
                            aria-label={m.readByHost ? "Read" : "Delivered"}
                            className={`h-[14px] w-[14px] ${
                              m.readByHost ? "text-sky-400" : "text-[#86A99A]"
                            }`}
                          />
                        ) : null}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="flex shrink-0 items-end gap-2 bg-[#E6EFE9] p-3">
        <div className="flex flex-1 items-end gap-1 rounded-[22px] bg-white px-3 py-1 shadow-sm focus-within:ring-2 focus-within:ring-brand-primary/20">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 4000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Type a message"
            disabled={pending}
            className="max-h-[120px] min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[14.5px] text-brand-ink placeholder:text-[#9DB6AB] focus:outline-none disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-[0_4px_12px_-3px_rgba(16,185,129,.5)] transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <SendHorizontal className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
