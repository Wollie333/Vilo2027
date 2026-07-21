"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import { approveRefundAction, declineRefundAction } from "./actions";

type Props = {
  refundId: string;
  requestedAmount: number;
  currency: string;
  defaultMethod: RefundMethod;
};

type DeclineReason =
  | "outside_policy"
  | "no_show"
  | "terms_violated"
  | "services_rendered"
  | "other";

const DECLINE_LABELS: Record<DeclineReason, string> = {
  outside_policy: "Outside cancellation policy",
  no_show: "Guest no-show",
  terms_violated: "Booking terms violated",
  services_rendered: "Services already rendered",
  other: "Other (explain below)",
};

type RefundMethod = "paystack" | "paypal" | "eft" | "manual";

// Every rail is sent by the HOST — the guest paid the host's gateway directly,
// so Wielo has no funds to return. These labels must never imply otherwise.
const METHOD_LABELS: Record<RefundMethod, string> = {
  paystack: "Paystack (card) — refunded in your Paystack account",
  paypal: "PayPal — refunded in your PayPal account",
  eft: "EFT / bank transfer — sent by you",
  manual: "Manual / other — sent by you",
};

export function RefundActions({
  refundId,
  requestedAmount,
  currency,
  defaultMethod,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "approve" | "decline">("idle");
  const [amount, setAmount] = useState<number>(requestedAmount);
  const [method, setMethod] = useState<RefundMethod>(defaultMethod);
  const [note, setNote] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [confirmSent, setConfirmSent] = useState(false);
  const [reason, setReason] = useState<DeclineReason>("outside_policy");
  const [pending, start] = useTransition();

  function approve() {
    if (amount <= 0 || amount > requestedAmount) {
      toast.error(
        `Amount must be between R 1 and ${formatMoney(requestedAmount, currency)}.`,
      );
      return;
    }
    if (!confirmSent) {
      toast.error("Confirm you have sent the refund to the guest.");
      return;
    }
    start(async () => {
      const result = await approveRefundAction({
        refundId,
        amount,
        method,
        note: note.trim() || null,
        reference: reference.trim() || null,
        confirmSent: true,
      });
      if (result.ok) {
        toast.success("Refund recorded — the guest has been told.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function decline() {
    if (reason === "other" && note.trim().length < 5) {
      toast.error("Please add a short note explaining the decline.");
      return;
    }
    start(async () => {
      const result = await declineRefundAction({
        refundId,
        reason,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success("Refund declined.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (mode === "idle") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("approve")}
          className="inline-flex items-center gap-1 rounded bg-status-confirmed px-3 py-1.5 text-xs font-semibold text-white hover:bg-status-confirmed/90"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => setMode("decline")}
          className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-light"
        >
          <X className="h-3.5 w-3.5" />
          Decline
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded border border-brand-line bg-brand-light/40 p-3">
      {mode === "approve" ? (
        <>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Refund amount ({currency})
            </span>
            <input
              type="number"
              min={1}
              max={requestedAmount}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <span className="mt-1 block text-[11px] text-brand-mute">
              Up to {formatMoney(requestedAmount, currency)} requested
            </span>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              How you sent it
            </span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as RefundMethod)}
              className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              {(Object.entries(METHOD_LABELS) as [RefundMethod, string][]).map(
                ([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ),
              )}
            </select>
            <span className="mt-1 block text-[11px] text-brand-mute">
              {method === "paystack" || method === "paypal"
                ? `Refund the guest in your own ${method === "paystack" ? "Paystack" : "PayPal"} account first — the guest paid you directly, so Wielo can't move that money. Then record it here.`
                : "You send this refund yourself, then record it here."}
            </span>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Reference (optional)
            </span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Your gateway or bank reference"
              className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <span className="mt-1 block text-[11px] text-brand-mute">
              Saved with the refund, so you have proof if the guest says it
              never arrived.
            </span>
          </label>
        </>
      ) : (
        <>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Reason for declining
            </span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DeclineReason)}
              className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              {Object.entries(DECLINE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Note for the guest (optional)
        </span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 1000))}
          placeholder={
            mode === "approve"
              ? "e.g. Refund approved as a goodwill gesture."
              : "Explain briefly so the guest understands."
          }
          className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
      </label>

      {mode === "approve" ? (
        <label className="flex cursor-pointer items-start gap-2 rounded border border-brand-line bg-brand-light/40 p-3">
          <input
            type="checkbox"
            checked={confirmSent}
            onChange={(e) => setConfirmSent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
          <span className="text-[12.5px] leading-relaxed text-brand-ink">
            I have sent this refund to the guest. Recording it tells them the
            money is on its way and updates your books.
          </span>
        </label>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("idle");
            setNote("");
            setReference("");
            setConfirmSent(false);
          }}
          disabled={pending}
          className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={mode === "approve" ? approve : decline}
          disabled={pending || (mode === "approve" && !confirmSent)}
          className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
            mode === "approve"
              ? "bg-status-confirmed hover:bg-status-confirmed/90"
              : "bg-status-cancelled hover:bg-status-cancelled/90"
          }`}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {mode === "approve" ? "Record refund as sent" : "Confirm decline"}
        </button>
      </div>
    </div>
  );
}
