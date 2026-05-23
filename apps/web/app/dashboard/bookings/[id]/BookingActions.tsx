"use client";

import { Check, DoorClosed, DoorOpen, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  cancelBookingAction,
  checkInBookingAction,
  checkOutBookingAction,
  confirmBookingAction,
  declineBookingAction,
} from "../actions";

export function BookingActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const [pending, start] = useTransition();

  function run(
    kind: "confirm" | "decline" | "cancel" | "checkIn" | "checkOut",
  ) {
    start(async () => {
      const map = {
        confirm: confirmBookingAction,
        decline: declineBookingAction,
        cancel: cancelBookingAction,
        checkIn: checkInBookingAction,
        checkOut: checkOutBookingAction,
      } as const;
      const result = await map[kind](bookingId);
      if (result.ok) {
        const msg = {
          confirm: "Booking confirmed",
          decline: "Booking declined",
          cancel: "Booking cancelled",
          checkIn: "Guest checked in",
          checkOut: "Guest checked out",
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
          onClick={() => {
            if (
              window.confirm(
                "Decline this booking? The guest will be notified.",
              )
            ) {
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
          onClick={() => {
            if (
              window.confirm(
                "Cancel this confirmed booking? The guest will be notified.",
              )
            ) {
              run("cancel");
            }
          }}
          disabled={pending}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
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
          onClick={() => {
            if (window.confirm("Cancel this in-progress stay?")) {
              run("cancel");
            }
          }}
          disabled={pending}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>
    );
  }

  return null;
}
