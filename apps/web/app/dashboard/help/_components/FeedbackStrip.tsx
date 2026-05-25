"use client";

import { Megaphone, MessageCircle, Send } from "lucide-react";
import { useState, useTransition } from "react";

import { submitArticleSuggestion } from "../actions";

export function FeedbackStrip({ supportEmail }: { supportEmail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-card border border-brand-line bg-white p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-brand-accent text-brand-secondary">
        <Megaphone className="h-5 w-5" />
      </div>
      <div className="min-w-[200px] flex-1">
        <div className="font-display text-sm font-semibold text-brand-ink">
          Couldn&rsquo;t find what you needed?
        </div>
        <div className="mt-0.5 text-xs text-brand-mute">
          Tell us what&rsquo;s missing and we&rsquo;ll write the article —
          usually within a week.
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-brand-line px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-light"
        >
          Suggest an article
        </button>
        <a
          href={`mailto:${supportEmail}`}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary"
        >
          <MessageCircle className="h-4 w-4" /> Chat with us
        </a>
      </div>

      {open ? <SuggestionDialog onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

function SuggestionDialog({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    startTransition(async () => {
      const res = await submitArticleSuggestion({ message: message.trim() });
      if (res.ok) {
        setStatus("success");
        setMessage("");
      } else {
        setStatus("error");
        setError(res.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-card border border-brand-line bg-white p-5 shadow-lift">
        <div className="font-display text-lg font-bold text-brand-ink">
          Suggest an article
        </div>
        <p className="mt-1 text-xs text-brand-mute">
          What were you trying to do? We&rsquo;ll prioritise the most-requested
          topics each week.
        </p>
        {status === "success" ? (
          <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Thanks — got it. We&rsquo;ll reach out if we need more detail.
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-brand-primary hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              placeholder="I tried to … but couldn't find …"
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            {status === "error" && error ? (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || message.trim().length < 10}
                className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-secondary disabled:opacity-60"
              >
                <Send className="h-3 w-3" /> {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
