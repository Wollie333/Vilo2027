"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
} from "./actions";

type Props = {
  scheduledForCancel: boolean;
  currentPeriodEnd: string | null;
};

export function CancelButton({ scheduledForCancel, currentPeriodEnd }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  function submit() {
    if (scheduledForCancel) {
      start(async () => {
        const result = await reactivateSubscriptionAction();
        if (result.ok) {
          toast.success("Subscription reactivated.");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
      return;
    }
    start(async () => {
      const result = await cancelSubscriptionAction({
        reason: reason.trim() || null,
      });
      if (result.ok) {
        toast.success("Cancellation scheduled.");
        setShowReason(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (scheduledForCancel) {
    return (
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Resume subscription
      </button>
    );
  }

  if (!showReason) {
    return (
      <button
        type="button"
        onClick={() => setShowReason(true)}
        disabled={pending}
        className="text-xs font-medium text-brand-mute underline-offset-2 hover:underline disabled:opacity-60"
      >
        Cancel subscription
      </button>
    );
  }

  const periodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-2 rounded border border-brand-line bg-brand-light/60 p-3">
      <div className="text-[12.5px] text-brand-dark">
        Cancelling keeps your access until{" "}
        <span className="font-medium text-brand-ink">
          {periodEnd ?? "the end of the current period"}
        </span>
        , then drops you back to Free.
      </div>
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        placeholder="Optional: tell us why so we can improve."
        className="block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShowReason(false);
            setReason("");
          }}
          disabled={pending}
          className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-white hover:text-brand-ink"
        >
          Keep my plan
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-status-cancelled px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-status-cancelled/90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Confirm cancel
        </button>
      </div>
    </div>
  );
}
