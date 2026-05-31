"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { modal } from "@/components/ui/modal-host";

import { updatePaymentStatusAction } from "../actions";

/** EFT settlement controls — verify the transfer (confirms the booking) or
 *  reject it (declines the booking). Card payments never render this. */
export function PaymentManage({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  async function markPaid() {
    const ok = await modal.confirm({
      title: "Mark EFT as received?",
      description:
        "Only confirm once the transfer reflects in your account. This confirms the booking and emails the guest.",
      confirmLabel: "Yes, confirm booking",
    });
    if (!ok) return;
    start(async () => {
      const r = await updatePaymentStatusAction(paymentId, "mark_paid");
      if (r.ok) {
        toast.success("Payment confirmed — booking is now confirmed.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  async function markFailed() {
    const ok = await modal.destructive({
      title: "Mark EFT as failed?",
      description:
        "Use this if the transfer never arrived. The booking will be declined and the guest notified. This can't be undone.",
      confirmLabel: "Decline booking",
    });
    if (!ok) return;
    start(async () => {
      const r = await updatePaymentStatusAction(paymentId, "mark_failed");
      if (r.ok) {
        toast.success("Payment marked failed — booking declined.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <button
        type="button"
        onClick={markPaid}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        Mark as received &amp; confirm
      </button>
      <button
        type="button"
        onClick={markFailed}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded border border-brand-line px-4 py-2.5 text-sm font-medium text-status-cancelled transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        <X className="h-4 w-4" />
        Mark as failed
      </button>
    </div>
  );
}
