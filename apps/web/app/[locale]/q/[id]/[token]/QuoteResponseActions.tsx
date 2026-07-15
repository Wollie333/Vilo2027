"use client";

import { CheckCircle2, CircleSlash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { modal } from "@/components/ui/modal-host";
import { DECLINE_REASONS } from "@/lib/quotes/decline-reasons";

import { guestAcceptQuoteAction, guestDeclineQuoteAction } from "./actions";

export function QuoteResponseActions({
  quoteId,
  token,
}: {
  quoteId: string;
  token: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  function accept() {
    start(async () => {
      const r = await guestAcceptQuoteAction(quoteId, token);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      // Thank them, then offer to pay straight away (the booking is held).
      if (r.payToken) {
        const go = await modal.confirm({
          title: "Thank you for accepting! 🎉",
          description:
            "Your dates are now held. Continue to pay and secure your booking — or come back to it later from your trip.",
          confirmLabel: "Continue to pay",
          cancelLabel: "I'll pay later",
        });
        if (go) {
          router.push(`/pay/${r.payToken}`);
          return;
        }
      } else {
        toast.success("Quote accepted — the host will be in touch.");
      }
      router.refresh();
    });
  }
  function confirmDecline() {
    start(async () => {
      const r = await guestDeclineQuoteAction(quoteId, token, {
        reason: reason || undefined,
        note: note || undefined,
      });
      if (r.ok) {
        setDeclineOpen(false);
        toast.success("Quote declined — thanks for the feedback.");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <h2 className="text-center font-display text-base font-bold text-brand-ink">
        Ready to go ahead?
      </h2>
      <p className="mt-1 text-center text-xs text-brand-mute">
        Accepting holds your dates — you can pay securely right after to confirm
        your booking.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setDeclineOpen(true)}
          disabled={pending}
          className="gap-1.5"
        >
          <CircleSlash className="h-4 w-4" /> Decline
        </Button>
        <Button
          type="button"
          onClick={accept}
          disabled={pending}
          className="gap-1.5"
        >
          <CheckCircle2 className="h-4 w-4" /> Accept quote
        </Button>
      </div>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this quote?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-mute">
            This releases the hold on your dates and can&apos;t be undone. A
            quick reason helps the host — it&apos;s shared with them.
          </p>
          <div className="mt-2 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-mute">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              >
                <option value="">Select a reason (optional)</option>
                {DECLINE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-mute">
                Message to the host (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Anything you'd like to tell them…"
                className="block w-full resize-none rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeclineOpen(false)}
              disabled={pending}
            >
              Keep quote
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDecline}
              disabled={pending}
            >
              Decline quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
