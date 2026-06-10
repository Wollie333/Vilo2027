"use client";

import { CheckCheck, KeyRound, Paperclip } from "lucide-react";
import { useEffect, useRef } from "react";

import { ThreadQuoteCard } from "./ThreadQuoteCard";
import type { ThreadBooking, ThreadQuote } from "./ThreadQuoteCard";
import { latestIssuedVersionByQuote, quoteCardKind } from "./quote-thread";

// Canonical thread message wall — the WhatsApp-style green/white bubble chat
// used by BOTH the host inbox and the guest portal. `viewer` flips which side a
// message sits on and which read-receipt flag the sent tick reflects, but the
// look is identical so the design lives in exactly one place.

export type ChatMessage = {
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
  attachmentUrl?: string | null;
  attachmentFilename?: string | null;
};

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

function fmtAccessTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatMessageWall({
  messages,
  selfId,
  viewer,
  quotesById,
  bookingsById,
  emptyText = "No messages yet — say hello.",
}: {
  messages: ChatMessage[];
  selfId: string;
  viewer: "host" | "guest";
  quotesById: Record<string, ThreadQuote>;
  bookingsById: Record<string, ThreadBooking>;
  emptyText?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const latestIssued = latestIssuedVersionByQuote(messages);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);

  return (
    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto bg-[#E6EFE9]">
      <div className="mx-auto max-w-[760px] space-y-1 px-4 py-5">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#5B7065]">
            {emptyText}
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

            // Quote lifecycle card.
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
                      viewer={viewer}
                    />
                  </div>
                </div>
              );
            }

            // Access details — surfaced as a highlighted card.
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
                        {viewer === "host"
                          ? "Access details sent to guest"
                          : "Access details"}
                      </span>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-brand-ink">
                      {m.body}
                    </pre>
                    <div className="mt-1 font-mono text-[10.5px] text-brand-mute">
                      {fmtAccessTime(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            }

            // Other system events — centred amber pill.
            if (m.isSystem) {
              return (
                <div key={m.id}>
                  {dayPill}
                  <div className="flex justify-center py-1.5">
                    <span className="max-w-[80%] rounded-lg bg-[#FBF6E3] px-3.5 py-1.5 text-center text-[11.5px] leading-snug text-[#8A6D2B] shadow-sm">
                      {m.body || m.systemEvent}
                    </span>
                  </div>
                </div>
              );
            }

            const mine = m.senderId === selfId;
            // The sent tick turns blue once the OTHER party has read it.
            const readByOther =
              viewer === "host" ? m.readByGuest : m.readByHost;
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
                    {m.body ? <span>{m.body}</span> : null}
                    {m.attachmentUrl ? (
                      <a
                        href={m.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-brand-primary underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {m.attachmentFilename ?? "Attachment"}
                      </a>
                    ) : null}
                    <span className="float-right ml-2.5 mt-2 inline-flex items-center gap-1 font-mono text-[10px] leading-none text-[#6B8B7F]">
                      {fmtClock(m.createdAt)}
                      {mine ? (
                        <CheckCheck
                          aria-label={readByOther ? "Read" : "Delivered"}
                          className={`h-[14px] w-[14px] ${
                            readByOther ? "text-sky-400" : "text-[#86A99A]"
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
  );
}
