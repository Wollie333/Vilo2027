"use client";

import { CheckCircle2, CircleSlash, Repeat, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { modal } from "@/components/ui/modal-host";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  convertQuoteAction,
  declineQuoteAction,
  markAcceptedAction,
  sendQuoteAction,
  softDeleteQuoteAction,
} from "../actions";
import type { QuoteStatus } from "../schemas";

export function QuoteActions({
  quoteId,
  status,
}: {
  quoteId: string;
  status: QuoteStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [convertPayState, setConvertPayState] = useState<"paid" | "unpaid">(
    "paid",
  );
  const [convertNote, setConvertNote] = useState("");

  function refresh() {
    router.refresh();
  }

  function send() {
    start(async () => {
      const r = await sendQuoteAction(quoteId);
      if (r.ok) {
        toast.success("Quote sent");
        refresh();
      } else toast.error(r.error);
    });
  }
  function markAccepted() {
    start(async () => {
      const r = await markAcceptedAction(quoteId);
      if (r.ok) {
        toast.success("Marked accepted");
        refresh();
      } else toast.error(r.error);
    });
  }
  async function decline() {
    const ok = await modal.destructive({
      title: "Decline this quote?",
      description:
        "The soft hold on the calendar will clear and this can't be undone.",
      confirmLabel: "Decline",
    });
    if (!ok) return;
    start(async () => {
      const r = await declineQuoteAction(quoteId);
      if (r.ok) {
        toast.success("Quote declined");
        refresh();
      } else toast.error(r.error);
    });
  }
  function convert() {
    start(async () => {
      const r = await convertQuoteAction(quoteId, {
        state: convertPayState,
        note: convertNote.trim() || null,
      });
      if (r.ok && r.data) {
        toast.success("Booking created — invoice attached");
        router.push(`/dashboard/bookings/${r.data.bookingId}`);
      } else if (!r.ok) toast.error(r.error);
    });
  }
  async function softDelete() {
    const ok = await modal.destructive({
      title: "Delete this quote?",
      description: "This can't be undone.",
      confirmLabel: "Delete quote",
    });
    if (!ok) return;
    start(async () => {
      const r = await softDeleteQuoteAction(quoteId);
      if (r.ok) {
        toast.success("Quote deleted");
        router.push("/dashboard/quotes");
      } else toast.error(r.error);
    });
  }

  const canSend = status === "draft";
  const canMarkAccepted = status === "sent";
  const canDecline = status === "draft" || status === "sent";
  const canConvert = status === "sent" || status === "accepted";
  const canDelete = status !== "converted";

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-base font-bold text-brand-ink">
          Actions
        </CardTitle>
        <CardDescription className="text-brand-mute">
          State changes from here are irreversible. Soft holds clear the moment
          a quote is declined, expires or converts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2">
          {canSend ? (
            <Button
              type="button"
              onClick={send}
              disabled={pending}
              className="w-full justify-center gap-1.5"
            >
              <Send className="h-4 w-4" /> Send quote
            </Button>
          ) : null}
          {canMarkAccepted ? (
            <Button
              type="button"
              variant="outline"
              onClick={markAccepted}
              disabled={pending}
              className="w-full justify-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Mark accepted
            </Button>
          ) : null}
          {canDecline ? (
            <Button
              type="button"
              variant="outline"
              onClick={decline}
              disabled={pending}
              className="w-full justify-center gap-1.5 text-status-cancelled hover:bg-red-50"
            >
              <CircleSlash className="h-4 w-4" /> Decline
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="outline"
              onClick={softDelete}
              disabled={pending}
              className="w-full justify-center gap-1.5 text-status-cancelled hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : null}
        </div>

        {canConvert ? (
          <div className="rounded border border-brand-line bg-brand-light/40 p-4">
            <div className="font-display text-sm font-semibold text-brand-ink">
              Convert to booking
            </div>
            <p className="mt-1 text-xs text-brand-mute">
              The booking lands as <code>confirmed</code> and an invoice is
              created automatically. Pick the payment state at conversion.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-brand-ink">
                <input
                  type="radio"
                  name="paystate"
                  value="paid"
                  checked={convertPayState === "paid"}
                  onChange={() => setConvertPayState("paid")}
                />
                Paid (cash / EFT / off-platform)
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-ink">
                <input
                  type="radio"
                  name="paystate"
                  value="unpaid"
                  checked={convertPayState === "unpaid"}
                  onChange={() => setConvertPayState("unpaid")}
                />
                Unpaid — collect later
              </label>
            </div>
            {convertPayState === "paid" ? (
              <input
                value={convertNote}
                onChange={(e) => setConvertNote(e.target.value)}
                placeholder="Payment note (e.g. EFT ref, cash receipt)"
                className="mt-3 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
              />
            ) : null}
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                onClick={convert}
                disabled={pending}
                className="gap-1.5"
              >
                <Repeat className="h-4 w-4" />
                {pending ? "Converting…" : "Convert to booking"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
