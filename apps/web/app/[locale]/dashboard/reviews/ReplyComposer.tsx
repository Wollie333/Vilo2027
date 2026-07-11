"use client";

import { Loader2, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { modal } from "@/components/ui/modal-host";

import {
  clearReplyAction,
  editReplyAction,
  replyToReviewAction,
} from "./actions";

const MAX = 1500;

export function ReplyComposer({
  reviewId,
  guestName,
  initialBody,
  hasReply,
}: {
  reviewId: string;
  guestName: string;
  initialBody: string;
  hasReply: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [editing, setEditing] = useState(!hasReply);
  const [pending, start] = useTransition();
  const remaining = MAX - body.length;

  function submit() {
    start(async () => {
      const result = hasReply
        ? await editReplyAction(reviewId, { body })
        : await replyToReviewAction(reviewId, { body });
      if (result.ok) {
        toast.success(hasReply ? "Reply updated" : "Reply posted");
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  async function clear() {
    const ok = await modal.destructive({
      title: "Remove your reply?",
      description: "Guests will see this review as unanswered again.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    start(async () => {
      const result = await clearReplyAction(reviewId);
      if (result.ok) {
        toast.success("Reply cleared");
        setBody("");
        setEditing(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  // Posted-reply view — collapsed display + Edit / Remove buttons.
  if (!editing && hasReply) {
    return (
      <div className="ml-14 mt-4 rounded-r-card border-l-2 border-brand-primary bg-brand-light/60 px-4 py-3.5">
        <div className="mb-1 flex items-center gap-2 text-[11px]">
          <span className="font-display text-[13px] font-semibold text-brand-ink">
            Your reply
          </span>
          <span className="text-brand-mute">visible publicly</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            className="ml-auto font-medium text-brand-mute transition-colors hover:text-brand-ink disabled:opacity-40"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="font-medium text-brand-mute transition-colors hover:text-status-cancelled disabled:opacity-40"
          >
            Remove
          </button>
        </div>
        <p className="text-sm leading-relaxed text-brand-ink">{body}</p>
      </div>
    );
  }

  return (
    <div className="ml-14 mt-4 rounded-card border border-brand-line bg-white">
      <textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX))}
        placeholder={`Reply publicly to ${guestName.split(" ")[0]}…`}
        disabled={pending}
        className="w-full resize-none rounded-t-card bg-transparent px-4 pt-3 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none"
        aria-label="Public reply"
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-brand-line px-2 py-2">
        <span className="ml-2 text-[11px] text-brand-mute">
          Visible publicly · {remaining.toLocaleString("en-ZA")} chars left
        </span>
        {hasReply ? (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setBody(initialBody);
            }}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={clear}
            disabled={pending || body.length === 0}
            className="ml-auto inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink disabled:opacity-40"
            title="Clear text"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || body.trim().length < 2}
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {hasReply ? "Save reply" : "Post reply"}
        </button>
      </div>
    </div>
  );
}
