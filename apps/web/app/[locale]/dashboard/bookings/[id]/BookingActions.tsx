"use client";

import { Check, DoorClosed, DoorOpen, UserX, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CancelBookingDialog } from "@/components/booking/CancelBookingDialog";
import { Button } from "@/components/ui/button";
import { modal } from "@/components/ui/modal-host";

import {
  cancelBookingAction,
  checkInBookingAction,
  checkOutBookingAction,
  confirmBookingAction,
  declineBookingAction,
  markNoShowBookingAction,
  previewCancelRefundAction,
} from "../actions";

export function BookingActions({
  bookingId,
  status,
  currency,
}: {
  bookingId: string;
  status: string;
  currency: string;
}) {
  const [pending, start] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

  const cancelDialog = (
    <CancelBookingDialog
      open={cancelOpen}
      onOpenChange={setCancelOpen}
      bookingId={bookingId}
      currency={currency}
      audience="host"
      loadPreview={previewCancelRefundAction}
      onConfirm={(reason) => cancelBookingAction(bookingId, reason)}
    />
  );

  function run(
    kind: "confirm" | "decline" | "cancel" | "checkIn" | "checkOut" | "noShow",
  ) {
    start(async () => {
      const map = {
        confirm: confirmBookingAction,
        decline: declineBookingAction,
        cancel: cancelBookingAction,
        checkIn: checkInBookingAction,
        checkOut: checkOutBookingAction,
        noShow: markNoShowBookingAction,
      } as const;
      const result = await map[kind](bookingId);
      if (result.ok) {
        const msg = {
          confirm: "Booking confirmed",
          decline: "Booking declined",
          cancel: "Booking cancelled",
          checkIn: "Guest checked in",
          checkOut: "Guest checked out",
          noShow: "Marked as no-show",
        }[kind];
        toast.success(msg);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (status === "pending") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => run("confirm")}
          disabled={pending}
          className="gap-1.5"
        >
          <Check className="h-4 w-4" />
          Confirm booking
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            const ok = await modal.destructive({
              title: "Decline this booking?",
              description: "The guest will be notified and can't be undone.",
              confirmLabel: "Decline",
            });
            if (ok) {
              run("decline");
            }
          }}
          disabled={pending}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Decline
        </Button>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => run("checkIn")}
          disabled={pending}
          className="gap-1.5"
        >
          <DoorOpen className="h-4 w-4" />
          Mark check-in
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            const ok = await modal.destructive({
              title: "Mark this booking as a no-show?",
              description:
                "Use this when the guest never arrived. The dates stay blocked and no automatic refund is issued — settle any refund via the guest's policy if needed.",
              confirmLabel: "Mark no-show",
            });
            if (ok) {
              run("noShow");
            }
          }}
          disabled={pending}
          className="gap-1.5"
        >
          <UserX className="h-4 w-4" />
          No-show
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCancelOpen(true)}
          disabled={pending}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        {cancelDialog}
      </div>
    );
  }

  if (status === "checked_in") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => run("checkOut")}
          disabled={pending}
          className="gap-1.5"
        >
          <DoorClosed className="h-4 w-4" />
          Mark check-out
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCancelOpen(true)}
          disabled={pending}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        {cancelDialog}
      </div>
    );
  }

  // Manual-EFT bookings awaiting the guest's transfer (or under review) are
  // cancellable per CANCELLABLE_STATUSES, but had no host action surfaced — the
  // host couldn't cancel an unpaid EFT booking. Offer Cancel here too.
  if (status === "pending_eft" || status === "pending_eft_review") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setCancelOpen(true)}
          disabled={pending}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Cancel booking
        </Button>
        {cancelDialog}
      </div>
    );
  }

  return null;
}
