"use client";

import { Check, DoorClosed, DoorOpen, Loader2, UserX, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CancelBookingDialog } from "@/components/booking/CancelBookingDialog";
import { Button } from "@/components/ui/button";
import { modal } from "@/components/ui/modal-host";
import { progress } from "@/components/ui/progress-host";

import {
  cancelBookingAction,
  checkInBookingAction,
  checkOutBookingAction,
  confirmBookingAction,
  declineBookingAction,
  forfeitBookingAction,
  previewCancelRefundAction,
  previewForfeitAction,
} from "../actions";

function rand(n: number, currency = "ZAR"): string {
  const sym = currency === "ZAR" ? "R" : `${currency} `;
  return `${sym}${Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

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
  // Which action is in flight, so the tapped button shows a spinner + a live
  // "…ing" label. Booking is ~95% mobile — a disabled-but-static button reads
  // as an unresponsive tap.
  const [running, setRunning] = useState<
    "confirm" | "decline" | "cancel" | "checkIn" | "checkOut" | "forfeit" | null
  >(null);

  const cancelDialog = (
    <CancelBookingDialog
      open={cancelOpen}
      onOpenChange={setCancelOpen}
      bookingId={bookingId}
      currency={currency}
      audience="host"
      loadPreview={previewCancelRefundAction}
      onConfirm={(reason, refundAmount) =>
        cancelBookingAction(bookingId, reason, refundAmount)
      }
    />
  );

  function run(
    kind: "confirm" | "decline" | "cancel" | "checkIn" | "checkOut",
  ) {
    setRunning(kind);
    start(async () => {
      const map = {
        confirm: confirmBookingAction,
        decline: declineBookingAction,
        cancel: cancelBookingAction,
        checkIn: checkInBookingAction,
        checkOut: checkOutBookingAction,
      } as const;
      // Contextual stepped modal — tells the host what each action is doing
      // (emails, ledger, calendar), not just a frozen button.
      const flow = {
        confirm: {
          title: "Confirming booking",
          successTitle: "Booking confirmed",
          steps: [
            "Confirming the booking",
            "Notifying your guest",
            "Updating your calendar",
          ],
        },
        decline: {
          title: "Declining booking",
          successTitle: "Booking declined",
          steps: ["Declining the booking", "Notifying your guest"],
        },
        cancel: {
          title: "Cancelling booking",
          successTitle: "Booking cancelled",
          steps: [
            "Cancelling the booking",
            "Processing any refund",
            "Notifying your guest",
          ],
        },
        checkIn: {
          title: "Checking in",
          successTitle: "Guest checked in",
          steps: ["Marking the check-in"],
        },
        checkOut: {
          title: "Checking out",
          successTitle: "Guest checked out",
          steps: ["Marking the check-out"],
        },
      } as const;
      try {
        const result = await progress.during(flow[kind], () =>
          map[kind](bookingId),
        );
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
      } finally {
        setRunning(null);
      }
    });
  }

  // No-show / abandoned → force-forfeit: keep what was paid, write off the
  // outstanding, mint an FRF statement, notify the guest. We load the exact
  // figures first and show them for confirmation ("ask each time").
  function forfeit() {
    setRunning("forfeit");
    start(async () => {
      try {
        const prev = await previewForfeitAction(bookingId);
        if (!prev.ok) {
          toast.error(prev.error);
          return;
        }
        const p = prev.preview;
        const kept = rand(p.forfeited, p.currency);
        const writtenOff = rand(p.writtenOff, p.currency);
        const ok = await modal.destructive({
          title: "Mark as no-show & forfeit?",
          description:
            p.paid > 0
              ? `The guest didn't arrive. You keep the ${kept} paid (no refund), and the outstanding ${writtenOff} is written off. A forfeit statement is issued and the guest is notified. This can't be undone.`
              : `The guest didn't arrive and paid nothing. The booking is cancelled and the ${writtenOff} charge is written off. The dates are released and the guest is notified.`,
          confirmLabel: "Forfeit booking",
        });
        if (!ok) return;
        const result = await progress.during(
          {
            title: "Marking as no-show",
            successTitle: "Booking forfeited",
            steps: [
              "Recording the no-show",
              "Writing off the balance",
              "Issuing a statement",
            ],
          },
          () => forfeitBookingAction(bookingId),
        );
        if (result.ok) {
          toast.success("Booking forfeited — statement issued.");
        } else {
          toast.error(result.error);
        }
      } finally {
        setRunning(null);
      }
    });
  }

  // Icon for a primary button: spinner while THIS action is running, else its
  // own glyph. Keeps the tapped button visibly busy on mobile.
  const busyIcon = (kind: typeof running, Idle: typeof Check) =>
    running === kind ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <Idle className="h-4 w-4" />
    );

  if (status === "pending") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => run("confirm")}
          disabled={pending}
          className="gap-1.5"
        >
          {busyIcon("confirm", Check)}
          {running === "confirm" ? "Confirming…" : "Confirm booking"}
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
          {busyIcon("decline", X)}
          {running === "decline" ? "Declining…" : "Decline"}
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
          {busyIcon("checkIn", DoorOpen)}
          {running === "checkIn" ? "Checking in…" : "Mark check-in"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={forfeit}
          disabled={pending}
          className="gap-1.5"
        >
          {busyIcon("forfeit", UserX)}
          {running === "forfeit" ? "Processing…" : "No-show"}
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
          {busyIcon("checkOut", DoorClosed)}
          {running === "checkOut" ? "Checking out…" : "Mark check-out"}
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
