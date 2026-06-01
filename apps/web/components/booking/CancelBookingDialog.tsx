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

export type RefundPreview = {
  refundAmount: number;
  refundPercent: number;
  ruleApplied: string | null;
};

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

/**
 * Enterprise cancellation dialog shared by the host booking page and the guest
 * portal. Shows the policy-entitled refund (fetched live) and captures a reason
 * before confirming. The caller supplies the preview + confirm server actions.
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
  loadPreview: (
    bookingId: string,
  ) => Promise<
    { ok: true; refund: RefundPreview } | { ok: false; error: string }
  >;
  onConfirm: (
    reason: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDone?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingPreview(true);
    setPreview(null);
    loadPreview(bookingId).then((res) => {
      if (!active) return;
      if (res.ok) setPreview(res.refund);
      setLoadingPreview(false);
    });
    return () => {
      active = false;
    };
  }, [open, bookingId, loadPreview]);

  function submit() {
    start(async () => {
      const res = await onConfirm(reason.trim());
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
      ? `${audience === "host" ? "The guest" : "You"} will be refunded ${fmtR(
          preview.refundAmount,
          currency,
        )}${preview.refundPercent ? ` (${preview.refundPercent}% under the cancellation policy)` : ""}.`
      : "No refund applies under the cancellation policy for these dates.";

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
            {preview && preview.refundAmount > 0 ? (
              <p className="mt-1 text-[12px] text-amber-800">
                A refund request for this amount is created automatically and
                appears in {audience === "host" ? "your" : "the host’s"} refund
                queue.
              </p>
            ) : null}
          </div>
        </div>

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
