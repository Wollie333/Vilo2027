"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SubmitSuccess } from "@/components/portal/SubmitSuccess";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const inputCls =
  "mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10";
const labelCls =
  "text-[11px] font-semibold uppercase tracking-wider text-brand-mute";

/**
 * "Request a refund" — a modal matching the other guest submit surfaces
 * (ManageBookingRequests / AddExtraCard): the DialogContent swaps to a shared
 * SubmitSuccess screen on send, and the refresh is deferred to Close. Because
 * the Dialog's open state is client-side, the success screen survives the
 * booking's re-render (canRequestRefund flips false once the refund exists).
 */
export function RequestRefundButton({
  bookingId,
  totalAmount,
  currency,
  variant = "block",
}: {
  bookingId: string;
  totalAmount: number;
  currency: string;
  /** "block" = full-width button (Manage-booking section);
   *  "toolbar" = compact header button next to the other trip actions. */
  variant?: "block" | "toolbar";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [amount, setAmount] = useState<number>(totalAmount);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [reasonDetail, setReasonDetail] = useState<string>("");
  const [pending, start] = useTransition();

  // Close the modal, reset the form + success screen, then refresh so the pending
  // refund shows. Refresh runs on close so it never blocks the success screen.
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "toolbar"
            ? "inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink transition hover:bg-brand-light/60"
            : "inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink transition hover:bg-brand-light"
        }
      >
        <RotateCcw className="h-3.5 w-3.5 text-brand-primary" />
        {variant === "toolbar" ? "Refund" : "Request refund"}
      </button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent className="max-w-md gap-0 rounded-card border-brand-line bg-white p-0">
          {sent ? (
            <SubmitSuccess
              title="Refund request sent"
              primaryHref="/portal/inbox"
              onClose={close}
            >
              Your host reviews and issues refunds directly — you&apos;ll hear
              back within 72 hours.
            </SubmitSuccess>
          ) : (
            <>
              <DialogHeader className="border-b border-brand-line px-5 py-4 text-left">
                <DialogTitle className="flex items-center gap-2 text-brand-ink">
                  <RotateCcw className="h-4 w-4 text-brand-primary" />
                  Request a refund
                </DialogTitle>
                <DialogDescription className="text-brand-mute">
                  Your host reviews and issues refunds directly — refunds are
                  arranged between you and your host.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 px-5 py-4">
                <label className="block">
                  <span className={labelCls}>Amount ({currency})</span>
                  <input
                    type="number"
                    min={1}
                    max={totalAmount}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className={inputCls}
                  />
                  <span className="mt-1 block text-[11px] text-brand-mute">
                    Up to {formatMoney(totalAmount, currency)} paid
                  </span>
                </label>

                <label className="block">
                  <span className={labelCls}>Reason</span>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={inputCls}
                  >
                    {REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelCls}>
                    {reason === "Other"
                      ? "Tell your host what happened"
                      : "Add detail (optional)"}
                  </span>
                  <textarea
                    rows={3}
                    value={reasonDetail}
                    onChange={(e) =>
                      setReasonDetail(e.target.value.slice(0, 2000))
                    }
                    placeholder="Helpful context speeds up the decision."
                    className={inputCls}
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-brand-line px-5 py-3">
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
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Send request
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
