"use client";

import {
  Check,
  CheckCheck,
  Clock,
  CreditCard,
  KeyRound,
  Paperclip,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { ThreadQuoteCard } from "./ThreadQuoteCard";
import type { ThreadBooking, ThreadQuote } from "./ThreadQuoteCard";
import { WebsiteEnquiryCard } from "./WebsiteEnquiryCard";
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
  // Optimistic, client-only: the message hasn't been confirmed by the server
  // yet. Renders the WhatsApp "sending" clock instead of a tick.
  pending?: boolean;
};

// WhatsApp's read-receipt blue.
const READ_BLUE = "#53BDEB";

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

// Is this message one *I* sent (so it should carry a delivery/read receipt)?
// Plain replies use the sender id; quote-lifecycle + access cards are system
// messages, so we infer the sender from the event + who's looking.
function isOutgoing(
  m: ChatMessage,
  viewer: "host" | "guest",
  selfId: string,
): boolean {
  if (!m.isSystem) return m.senderId === selfId;
  const kind = quoteCardKind(m.systemEvent);
  if (kind === "request") return viewer === "guest"; // the guest asked
  if (kind === "issued") return viewer === "host"; // the host sent the quote
  if (kind === "accepted") return viewer === "guest"; // the guest accepted
  if (m.systemEvent === "access_details") return viewer === "host";
  return false;
}

// WhatsApp delivery/read state for one of my outgoing messages:
//   pending   → clock        (not yet confirmed by the server)
//   sent      → single grey ✓ (server has it; the other side isn't online yet)
//   delivered → double grey ✓✓ (the other side's inbox has loaded since)
//   read      → double blue ✓✓ (the other person opened the thread)
function ReadTicks({
  read,
  delivered,
  pending,
  className = "",
}: {
  read: boolean;
  delivered: boolean;
  pending?: boolean;
  className?: string;
}) {
  if (pending) {
    return (
      <Clock
        aria-label="Sending"
        className={`h-[13px] w-[13px] text-[#86A99A] ${className}`}
      />
    );
  }
  if (!read && !delivered) {
    return (
      <Check
        aria-label="Sent"
        className={`h-[14px] w-[14px] text-[#86A99A] ${className}`}
      />
    );
  }
  return (
    <CheckCheck
      aria-label={read ? "Read" : "Delivered"}
      style={read ? { color: READ_BLUE } : undefined}
      className={`h-[14px] w-[14px] ${read ? "" : "text-[#86A99A]"} ${className}`}
    />
  );
}

export function ChatMessageWall({
  messages,
  selfId,
  viewer,
  quotesById,
  bookingsById,
  otherLastSeenAt = null,
  emptyText = "No messages yet — say hello.",
}: {
  messages: ChatMessage[];
  selfId: string;
  viewer: "host" | "guest";
  quotesById: Record<string, ThreadQuote>;
  bookingsById: Record<string, ThreadBooking>;
  // When the *other* participant last loaded their inbox — a message I sent
  // counts as delivered once this is at/after the message time.
  otherLastSeenAt?: string | null;
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

            // Has the *other* party read this message? (drives the blue ticks)
            const readByOther =
              viewer === "host" ? m.readByGuest : m.readByHost;
            const mine = isOutgoing(m, viewer, selfId);
            // Delivered = the other side's inbox loaded at/after this message.
            const deliveredToOther =
              otherLastSeenAt != null &&
              new Date(otherLastSeenAt).getTime() >=
                new Date(m.createdAt).getTime();

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
                    {mine ? (
                      <div className="mx-auto mt-0.5 flex max-w-[420px] items-center justify-end gap-1 pr-1 font-mono text-[10px] text-[#6B8B7F]">
                        {fmtClock(m.createdAt)}
                        <ReadTicks
                          read={readByOther}
                          delivered={deliveredToOther}
                          pending={m.pending}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }

            // Payment link — a pay card: booking summary + a Pay button.
            if (m.isSystem && m.systemEvent === "payment_link") {
              return (
                <div key={m.id}>
                  {dayPill}
                  <div className="mx-auto my-1 max-w-[420px] rounded-card border border-brand-primary/30 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white">
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <span className="font-display text-[14px] font-bold text-brand-ink">
                        {viewer === "host"
                          ? "Payment link sent"
                          : "Payment request"}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-brand-ink">
                      {m.body}
                    </p>
                    {m.attachmentUrl ? (
                      <a
                        href={m.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
                      >
                        <CreditCard className="h-4 w-4" />
                        {viewer === "host" ? "Open payment page" : "Pay now"}
                      </a>
                    ) : null}
                    <div className="mt-1.5 text-right font-mono text-[10.5px] text-brand-mute">
                      {fmtClock(m.createdAt)}
                    </div>
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
                    <div className="mt-1 flex items-center gap-1 font-mono text-[10.5px] text-brand-mute">
                      {fmtAccessTime(m.createdAt)}
                      {mine ? (
                        <ReadTicks
                          read={readByOther}
                          delivered={deliveredToOther}
                          pending={m.pending}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            }

            // Website contact/booking-form enquiry — a quote-request-style card
            // with a "Website enquiry" pill (the guest's submission follows as a
            // normal bubble).
            if (m.isSystem && m.systemEvent === "website_enquiry") {
              return (
                <div key={m.id}>
                  {dayPill}
                  <WebsiteEnquiryCard body={m.body} />
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
                        <ReadTicks
                          read={readByOther}
                          delivered={deliveredToOther}
                          pending={m.pending}
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
