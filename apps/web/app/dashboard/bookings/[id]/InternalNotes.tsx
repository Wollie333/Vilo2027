"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { addBookingNoteAction } from "../actions";

type Note = {
  id: string;
  body: string;
  created_at: string;
  authorName: string;
  authorInitials: string;
};

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function InternalNotes({
  bookingId,
  notes,
}: {
  bookingId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const text = value.trim();
    if (!text || pending) return;
    start(async () => {
      const result = await addBookingNoteAction(bookingId, text);
      if (result.ok) {
        setValue("");
        router.refresh();
        inputRef.current?.focus();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="p-4">
      {notes.length > 0 ? (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">
                {n.authorInitials}
              </div>
              <div className="min-w-0">
                <div className="rounded-card rounded-tl-sm bg-brand-light px-3 py-2 text-[12.5px] leading-relaxed text-brand-ink">
                  {n.body}
                </div>
                <div className="mt-1 px-1 font-mono text-[10.5px] text-brand-mute">
                  {n.authorName} · {fmtWhen(n.created_at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-brand-mute">
          No notes yet. Anything you jot here stays host-only.
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
