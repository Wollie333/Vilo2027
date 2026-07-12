"use client";

import { useEffect, useState, useTransition } from "react";

import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Label } from "@/components/ui/label";
import { formatMoney, round2 } from "@/lib/format";

export type RefundPreview = {
  refundAmount: number;
  refundPercent: number;
  ruleApplied: string | null;
};

/** loadPreview may also return the booking total + net paid — when it does (host
 * cancels), the dialog offers an editable refund override + a live breakdown. */
export type CancelPreviewResult =
  | { ok: true; refund: RefundPreview; total?: number; paid?: number }
  | { ok: false; error: string };

/**
 * Enterprise cancellation dialog shared by the host booking page and the guest
 * portal. Shows the policy-suggested refund; for a HOST cancel where money was
 * paid it also lets the host override the refund (0 → amount paid) and shows the
 * resulting refunded / retained / written-off split. Guests see it read-only.
 */
export function CancelBookingDialog({
  open,
  onOpenChange,
  bookingId,
  currency,
  audience,
  loadPreview,
  onConfirm,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookingId: string;
  currency: string;
  audience: "host" | "guest";
  loadPreview: (bookingId: string) => Promise<CancelPreviewResult>;
  onConfirm: (
    reason: string,
    refundAmount?: number,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDone?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [paid, setPaid] = useState<number | null>(null);
  const [refundInput, setRefundInput] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingPreview(true);
    setPreview(null);
    setTotal(null);
    setPaid(null);
    setRefundInput("");
    loadPreview(bookingId).then((res) => {
      if (!active) return;
      if (res.ok) {
        setPreview(res.refund);
        setTotal(res.total ?? null);
        setPaid(res.paid ?? null);
        setRefundInput(String(res.refund.refundAmount ?? 0));
      }
      setLoadingPreview(false);
    });
    return () => {
      active = false;
    };
  }, [open, bookingId, loadPreview]);

  // Host override is offered only when we know what was paid and there's money to
  // hand back. Refund is clamped to [0, paid]; retained + written-off derive.
  const canOverride = audience === "host" && paid != null && paid > 0;
  const paidVal = paid ?? 0;
  const refund = canOverride
    ? Math.min(Math.max(0, Number(refundInput) || 0), paidVal)
    : (preview?.refundAmount ?? 0);
  const retained = round2(paidVal - refund);
  const writtenOff = total != null ? round2(Math.max(0, total - paidVal)) : 0;

  function submit() {
    start(async () => {
      const res = await onConfirm(
        reason.trim(),
        canOverride ? refund : undefined,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Booking cancelled");
      onOpenChange(false);
      onDone?.();
    });
  }

  const refundLine = loadingPreview
    ? "Checking the cancellation policy…"
    : preview && preview.refundAmount > 0
      ? `${audience === "host" ? "The guest" : "You"} will be refunded ${formatMoney(
          preview.refundAmount,
          currency,
        )}${preview.refundPercent ? ` (${preview.refundPercent}% under the cancellation policy)` : ""}.`
      : "No refund applies under the cancellation policy for these dates.";

  const money = (n: number) => formatMoney(n, currency);

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        audience === "host" ? "Cancel this booking?" : "Cancel your booking?"
      }
      description={
        audience === "host"
          ? "The guest will be notified and the dates released."
          : "Your host will be notified and the dates released."
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 rounded-card border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">This can&rsquo;t be undone.</p>
            <p className="mt-0.5">{refundLine}</p>
          </div>
        </div>

        {canOverride ? (
          <div className="bg-brand-surface/40 space-y-2 rounded-card border border-brand-line px-3 py-3">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              Refund to guest
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-brand-mute">
                {currency === "ZAR" ? "R" : currency}
              </span>
              <input
                type="number"
                min={0}
                max={paidVal}
                step="0.01"
                value={refundInput}
                onChange={(e) => setRefundInput(e.target.value)}
                className="w-32 rounded-card border border-brand-line bg-white px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-primary"
              />
              <button
                type="button"
                onClick={() =>
                  setRefundInput(String(preview?.refundAmount ?? 0))
                }
                className="text-[12px] font-medium text-brand-primary hover:underline"
              >
                Use policy ({money(preview?.refundAmount ?? 0)})
              </button>
            </div>
            <p className="text-[11px] text-brand-mute">
              Paid {money(paidVal)} · adjust the refund from R0 up to what was
              paid.
            </p>

            <dl className="mt-1 space-y-1 border-t border-brand-line pt-2 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-brand-mute">Refunded to guest</dt>
                <dd className="font-medium text-status-cancelled">
                  {money(refund)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-brand-mute">Retained (your revenue)</dt>
                <dd className="font-medium text-status-confirmed">
                  {money(retained)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-brand-mute">Outstanding written off</dt>
                <dd className="font-medium text-brand-dark">
                  {money(writtenOff)}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Reason (optional)
          </Label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={
              audience === "host"
                ? "Shared with the guest — e.g. maintenance issue, double booking…"
                : "Let your host know why (optional)…"
            }
            className="w-full rounded-card border border-brand-line bg-white px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-primary"
          />
        </div>
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Keep booking</FormModalCancel>
        <Button
          type="button"
          variant="destructive"
          onClick={submit}
          disabled={pending}
        >
          {pending ? "Cancelling…" : "Cancel booking"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}
