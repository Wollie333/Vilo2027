"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SubmitSuccess } from "@/components/portal/SubmitSuccess";
import { formatMoney } from "@/lib/format";

import { requestRefundAction } from "./actions";

const REASONS = [
  "Cancelled my stay",
  "Property didn't match the listing",
  "Issue at the property",
  "Host cancelled",
  "Booked the wrong dates",
  "Other",
];

export function RequestRefundButton({
  bookingId,
  totalAmount,
  currency,
}: {
  bookingId: string;
  totalAmount: number;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [amount, setAmount] = useState<number>(totalAmount);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [reasonDetail, setReasonDetail] = useState<string>("");
  const [pending, start] = useTransition();

  // Collapse the panel back to the button, reset the form + success screen, then
  // refresh so the pending refund shows. Refresh runs on close so it never blocks
  // the success screen.
  function close() {
    setOpen(false);
    setSent(false);
    setReasonDetail("");
    setAmount(totalAmount);
    setReason(REASONS[0]);
    router.refresh();
  }

  function submit() {
    if (amount <= 0 || amount > totalAmount) {
      toast.error(
        `Amount must be between R 1 and ${formatMoney(totalAmount, currency)}.`,
      );
      return;
    }
    if (reason === "Other" && reasonDetail.trim().length < 10) {
      toast.error("Please describe the reason in a sentence or two.");
      return;
    }
    start(async () => {
      const result = await requestRefundAction({
        bookingId,
        amount,
        reason,
        reasonDetail: reasonDetail.trim() || null,
      });
      if (result.ok) {
        setSent(true);
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
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink transition hover:bg-brand-light"
      >
        <RotateCcw className="h-4 w-4 text-brand-primary" />
        Request refund
      </button>
    );
  }

  if (sent) {
    return (
      <div className="rounded-[12px] border border-brand-line bg-brand-light/40">
        <SubmitSuccess
          title="Refund request sent"
          primaryHref="/portal/inbox"
          onClose={close}
        >
          Your host reviews and issues refunds directly — you&apos;ll hear back
          within 72 hours.
        </SubmitSuccess>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[12px] border border-brand-line bg-brand-light/40 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        Request a refund
      </div>
      <p className="text-[12.5px] text-brand-mute">
        Your host reviews and issues refunds directly — refunds are arranged
        between you and your host.
      </p>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Amount ({currency})
        </span>
        <input
          type="number"
          min={1}
          max={totalAmount}
          step={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
        />
        <span className="mt-1 block text-[11px] text-brand-mute">
          Up to {formatMoney(totalAmount, currency)} paid
        </span>
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Reason
        </span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
        >
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          {reason === "Other"
            ? "Tell your host what happened"
            : "Add detail (optional)"}
        </span>
        <textarea
          rows={3}
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value.slice(0, 2000))}
          placeholder="Helpful context speeds up the decision."
          className="mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Send request
        </button>
      </div>
    </div>
  );
}
