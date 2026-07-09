"use client";

import { Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  pauseSubscriptionAction,
  reactivateSubscriptionAction,
  requestCancellationAction,
} from "./actions";

type Props = {
  status: string;
  scheduledForCancel: boolean;
};

// Host self-serve membership controls:
//  - active/trialing → Pause (on hold) + Request cancellation (→ paused; Wielo
//    is notified in the support inbox so a human handles the real cancel).
//  - paused / scheduled-cancel → Resume (back to active).
// Downgrades to a cheaper plan stay admin-only (handled in the plan picker).
export function CancelButton({ status, scheduledForCancel }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    ok: string,
  ) =>
    start(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });

  const paused = status === "paused";

  if (paused || scheduledForCancel) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            run(reactivateSubscriptionAction, "Membership resumed.")
          }
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          Resume membership
        </button>
        <span className="text-xs text-brand-mute">
          {scheduledForCancel && !paused
            ? "Scheduled to cancel — resume any time before it ends."
            : "On hold. Resume any time. To fully cancel, Wielo support will be in touch."}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => run(pauseSubscriptionAction, "Membership paused.")}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PauseCircle className="h-4 w-4" />
        )}
        Pause membership
      </button>
      <button
        type="button"
        onClick={() => {
          if (
            !window.confirm(
              "Request cancellation of your membership? It will be paused and the Wielo team will help you close it off.",
            )
          )
            return;
          run(
            requestCancellationAction,
            "Cancellation requested — we'll be in touch.",
          );
        }}
        disabled={pending}
        className="text-xs font-medium text-status-cancelled underline-offset-2 hover:underline disabled:opacity-60"
      >
        Request cancellation
      </button>
    </div>
  );
}
