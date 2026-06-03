"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { addConversationNoteAction } from "./actions";

export type ConvNote = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
};

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ConversationNotes({
  conversationId,
  notes,
}: {
  conversationId: string;
  notes: ConvNote[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const text = value.trim();
    if (!text || pending) return;
    start(async () => {
      const r = await addConversationNoteAction(conversationId, text);
      if (r.ok) {
        setValue("");
        router.refresh();
        inputRef.current?.focus();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="border-b border-brand-line px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          Internal notes
        </div>
        <span className="inline-flex items-center rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-mute">
          Host-only
        </span>
      </div>

      {notes.length > 0 ? (
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <li key={n.id}>
              <div className="rounded-[10px] rounded-tl-sm bg-brand-light px-3 py-2 text-[12.5px] leading-relaxed text-brand-ink">
                {n.body}
              </div>
              <div className="mt-1 px-1 font-mono text-[10.5px] text-brand-mute">
                {n.authorName} · {fmtWhen(n.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-brand-mute">
          Jot a private note — the guest never sees it.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a note…"
          disabled={pending}
          className="w-full rounded-[10px] border border-brand-line px-3 py-2 text-[12.5px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          aria-label="Add note"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-primary text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
