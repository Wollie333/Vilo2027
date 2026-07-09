"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { reactivateSubscriptionAction } from "./actions";

type Props = {
  scheduledForCancel: boolean;
  currentPeriodEnd: string | null;
};

// Cancelling (a downgrade) is admin-only — it triggers the credit-note/refund
// decision that's Wielo's call. A host can RESUME an already-scheduled cancel
// (an upgrade), but to cancel they message Wielo support.
export function CancelButton({ scheduledForCancel }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (scheduledForCancel) {
    return (
      <button
        type="button"
        onClick={() =>
          start(async () => {
            const result = await reactivateSubscriptionAction();
            if (result.ok) {
              toast.success("Subscription reactivated.");
              router.refresh();
            } else {
              toast.error(result.error);
            }
          })
        }
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Resume subscription
      </button>
    );
  }

  return (
    <a
      href="/dashboard/inbox"
      className="text-xs font-medium text-brand-mute underline-offset-2 hover:underline"
      title="Cancellations are handled by Wielo support"
    >
      Need to cancel? Contact Wielo support
    </a>
  );
}
