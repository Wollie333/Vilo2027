"use client";

import { CheckCircle2, CircleSlash, Repeat, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
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
  total,
  deposit,
  currency,
}: {
  quoteId: string;
  status: QuoteStatus;
  total: number;
  deposit: number;
  currency: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [convertPayState, setConvertPayState] = useState<"paid" | "unpaid">(
    "unpaid",
  );
  const [convertNote, setConvertNote] = useState("");
  // What the guest pays now to confirm: deposit / full / custom.
  const [payMode, setPayMode] = useState<"deposit" | "full" | "custom">(
    deposit > 0 && deposit < total ? "deposit" : "full",
  );
  const [payCustom, setPayCustom] = useState(String(deposit || total || ""));
  const payNow =
    payMode === "deposit"
      ? deposit
      : payMode === "full"
        ? total
        : Number(payCustom) || 0;

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
        payNow,
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
              Creates the booking and posts a payment card to the guest&rsquo;s
              chat. Set what they pay now to confirm.
            </p>

            {/* What the guest pays now */}
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Pay now to confirm
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(
                  [
                    {
                      m: "deposit" as const,
                      label: `Deposit · ${formatMoney(deposit, currency)}`,
                      show: deposit > 0 && deposit < total,
                    },
                    {
                      m: "full" as const,
                      label: `Full · ${formatMoney(total, currency)}`,
                      show: true,
                    },
                    { m: "custom" as const, label: "Custom", show: true },
                  ] as const
                )
                  .filter((o) => o.show)
                  .map((o) => (
                    <button
                      key={o.m}
                      type="button"
                      onClick={() => setPayMode(o.m)}
                      className={`rounded-pill border px-3 py-1.5 text-[12px] font-semibold transition ${
                        payMode === o.m
                          ? "border-brand-primary bg-brand-accent text-brand-secondary"
                          : "border-brand-line bg-white text-brand-ink hover:bg-brand-light/60"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
              </div>
              {payMode === "custom" ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payCustom}
                  onChange={(e) => setPayCustom(e.target.value)}
                  placeholder={`Amount (${currency})`}
                  className="mt-2 block w-40 rounded border border-brand-line bg-white px-3 py-2 text-sm"
                />
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-brand-ink">
                <input
                  type="radio"
                  name="paystate"
                  value="unpaid"
                  checked={convertPayState === "unpaid"}
                  onChange={() => setConvertPayState("unpaid")}
                />
                Request payment (or collect later)
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-ink">
                <input
                  type="radio"
                  name="paystate"
                  value="paid"
                  checked={convertPayState === "paid"}
                  onChange={() => setConvertPayState("paid")}
                />
                Already paid (cash / EFT)
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
