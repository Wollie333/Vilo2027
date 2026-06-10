"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";

export type QuickReply = { id: string; title: string; body: string };

// Canonical chat composer — the WhatsApp-style rounded input + round send
// button shared by the host inbox and the guest portal. The host passes
// `quickReplies` (saved templates) to surface a chip row above the input; the
// guest omits it. `onSend` resolves truthy to clear the field.
export function ChatComposer({
  onSend,
  placeholder = "Type a message",
  disabled = false,
  quickReplies,
  manageHref,
}: {
  onSend: (text: string) => Promise<boolean | void> | boolean | void;
  placeholder?: string;
  disabled?: boolean;
  quickReplies?: QuickReply[];
  manageHref?: string;
}) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = value.trim();
    if (!text || pending || disabled) return;
    start(async () => {
      const ok = await onSend(text);
      if (ok !== false) setValue("");
    });
  }

  return (
    <div className="shrink-0 bg-[#E6EFE9] p-3">
      {quickReplies && quickReplies.length > 0 ? (
        <div className="thin-scroll mb-2 flex items-center gap-2 overflow-x-auto px-1">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Quick replies
          </span>
          {quickReplies.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.body}
              onClick={() => {
                setValue((v) => (v.trim() ? `${v}\n${t.body}` : t.body));
                textareaRef.current?.focus();
              }}
              className="inline-flex shrink-0 items-center rounded-pill border border-brand-line bg-white px-3 py-1 text-[12px] font-medium text-brand-ink transition-colors hover:bg-brand-light"
            >
              {t.title}
            </button>
          ))}
          {manageHref ? (
            <Link
              href={manageHref}
              className="inline-flex shrink-0 items-center rounded-pill border border-dashed border-brand-line bg-white px-2.5 py-1 text-[11px] font-medium text-brand-mute hover:bg-brand-light"
            >
              Manage
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <div className="flex flex-1 items-end gap-1 rounded-[22px] bg-white px-3 py-1 shadow-sm focus-within:ring-2 focus-within:ring-brand-primary/20">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 4000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={placeholder}
            disabled={pending || disabled}
            className="max-h-[120px] min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[14.5px] text-brand-ink placeholder:text-[#9DB6AB] focus:outline-none disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending || disabled || !value.trim()}
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
