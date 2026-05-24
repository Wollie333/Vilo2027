"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { hostInitiatedRefundAction } from "../../refunds/actions";

const REASONS = [
  "Goodwill / customer service",
  "Property issue mid-stay",
  "Booking cancelled",
  "Overcharge",
  "Other",
] as const;

type Props = {
  bookingId: string;
  totalAmount: number;
  currency: string;
};

function fmtR(amount: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(amount)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

export function IssueRefundButton({ bookingId, totalAmount, currency }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(totalAmount);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [reasonDetail, setReasonDetail] = useState<string>("");
  const [pending, start] = useTransition();

  function submit() {
    if (amount <= 0 || amount > totalAmount) {
      toast.error(
        `Amount must be between R 1 and ${fmtR(totalAmount, currency)}.`,
      );
      return;
    }
    start(async () => {
      const result = await hostInitiatedRefundAction({
        bookingId,
        amount,
        reason,
        reasonDetail: reasonDetail.trim() || null,
      });
      if (result.ok) {
        toast.success("Refund issued — guest will be notified.");
        setOpen(false);
        setReasonDetail("");
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
        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light"
      >
        <RotateCcw className="h-4 w-4" />
        Issue refund
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded border border-brand-line bg-brand-light/40 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        Issue refund
      </div>
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
          className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
        <span className="mt-1 block text-[11px] text-brand-mute">
          Up to {fmtR(totalAmount, currency)}
        </span>
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Reason
        </span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        >
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Note (optional)
        </span>
        <textarea
          rows={2}
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value.slice(0, 2000))}
          placeholder="Add context for the guest."
          className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-status-confirmed px-3 py-1.5 text-xs font-semibold text-white hover:bg-status-confirmed/90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Confirm refund
        </button>
      </div>
    </div>
  );
}
