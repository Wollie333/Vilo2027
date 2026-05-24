"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { hideReview, restoreReview } from "./actions";

export function ModerateButtons({
  reviewId,
  hidden,
}: {
  reviewId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const mode = hidden ? "restore" : "hide";

  function submit() {
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    start(async () => {
      const result =
        mode === "hide"
          ? await hideReview({ reviewId, reason: reason.trim() })
          : await restoreReview({ reviewId, reason: reason.trim() });
      if (result.ok) {
        toast.success(mode === "hide" ? "Review hidden." : "Review restored.");
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs font-semibold ${
          mode === "hide"
            ? "border-status-cancelled/30 bg-status-cancelled/5 text-status-cancelled hover:bg-status-cancelled/10"
            : "border-status-confirmed/30 bg-status-confirmed/5 text-status-confirmed hover:bg-status-confirmed/10"
        }`}
      >
        {mode === "hide" ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        {mode === "hide" ? "Uphold flag (hide)" : "Reject flag (restore)"}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded border border-brand-line bg-brand-light/60 p-3">
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        placeholder="Reason for the call (required, ≥ 5 chars)"
        className="block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
          disabled={pending}
          className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
            mode === "hide"
              ? "bg-status-cancelled hover:bg-status-cancelled/90"
              : "bg-status-confirmed hover:bg-status-confirmed/90"
          }`}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Confirm
        </button>
      </div>
    </div>
  );
}
