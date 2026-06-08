"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendMessageAction } from "@/app/dashboard/inbox/actions";
import { modal } from "@/components/ui/modal-host";

/**
 * The host↔guest conversation thread + reply composer. This is the ONE message
 * panel — rendered identically on the Guest record's Messages tab AND the
 * Booking record's Messages tab, both bound to the same `conversationId`, so
 * messaging a guest from a booking and from their CRM record is literally the
 * same thread. Don't fork this — pass a different `conversationId` instead.
 */

export type MessageItem = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
};

export type TemplateItem = { id: string; title: string; body: string };

function applyTemplate(body: string, firstName: string): string {
  return body.replace(/\{\{\s*guest_name\s*\}\}/gi, firstName);
}

export function GuestMessagesPanel({
  firstName,
  messages,
  conversationId,
  templates,
  isRegistered,
}: {
  firstName: string;
  messages: MessageItem[];
  conversationId: string | null;
  templates: TemplateItem[];
  isRegistered: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function send() {
    if (!conversationId || !text.trim()) return;
    setSending(true);
    const res = await sendMessageAction({
      conversation_id: conversationId,
      body: text.trim(),
    });
    setSending(false);
    if (!res.ok) {
      void modal.error({ title: "Couldn't send", description: res.error });
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          Message history
        </div>
        <Link
          href="/dashboard/inbox"
          className="text-[12px] font-medium text-brand-primary hover:underline"
        >
          Open in inbox →
        </Link>
      </div>

      {messages.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="text-[13px] font-semibold text-brand-ink">
            No messages yet
          </div>
          <div className="mx-auto mt-1 max-w-sm text-[12.5px] text-brand-mute">
            {isRegistered
              ? "Start a conversation from the inbox — replies will appear here."
              : "This contact has no account, so there's no message thread. Reach them by email or phone."}
          </div>
        </div>
      ) : (
        <div className="thin-scroll max-h-[460px] space-y-3 overflow-y-auto bg-[#FAFCFB] p-5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.mine ? "ml-auto" : ""}
              style={{ maxWidth: "78%" }}
            >
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                  m.mine
                    ? "rounded-br-sm bg-brand-secondary text-white"
                    : "rounded-bl-sm border border-brand-line bg-white text-brand-ink"
                }`}
              >
                {m.body}
              </div>
              <div
                className={`mt-1 text-[10.5px] text-brand-mute ${m.mine ? "text-right" : ""}`}
              >
                {new Date(m.createdAt).toLocaleString("en-ZA", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* reply composer (only when there's a thread to reply to) */}
      {conversationId ? (
        <div className="border-t border-brand-line p-3">
          <div className="flex items-center gap-2">
            {templates.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                  title="Insert template"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border border-brand-line text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
                {pickerOpen ? (
                  <div className="absolute bottom-[calc(100%+6px)] left-0 z-30 max-h-72 w-72 overflow-y-auto rounded-xl border border-brand-line bg-white p-1.5 shadow-lift">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-mute">
                      Insert template
                    </div>
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onMouseDown={() => {
                          setText(
                            (prev) =>
                              (prev ? prev + "\n\n" : "") +
                              applyTemplate(t.body, firstName),
                          );
                          setPickerOpen(false);
                        }}
                        className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-brand-ink hover:bg-brand-light"
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={`Reply to ${firstName}…`}
              className="flex-1 rounded-pill border border-brand-line px-4 py-2.5 text-[13px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
            />
            <button
              onClick={() => void send()}
              disabled={sending || !text.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-brand-primary text-white hover:bg-brand-secondary disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
