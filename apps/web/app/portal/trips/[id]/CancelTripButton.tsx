"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { CancelBookingDialog } from "@/components/booking/CancelBookingDialog";

import { cancelMyBookingAction, previewMyCancelRefundAction } from "./actions";

export function CancelTripButton({
  bookingId,
  currency,
}: {
  bookingId: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-medium text-status-cancelled transition hover:bg-status-cancelled/5"
      >
        Cancel booking
      </button>
      <CancelBookingDialog
        open={open}
        onOpenChange={setOpen}
        bookingId={bookingId}
        currency={currency}
        audience="guest"
        loadPreview={previewMyCancelRefundAction}
        onConfirm={(reason) => cancelMyBookingAction({ bookingId, reason })}
        onDone={() => router.refresh()}
      />
    </>
  );
}
