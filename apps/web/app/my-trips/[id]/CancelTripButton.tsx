"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { CancelBookingDialog } from "@/components/booking/CancelBookingDialog";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-status-cancelled/40 text-status-cancelled hover:bg-status-cancelled/5"
      >
        Cancel booking
      </Button>
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
