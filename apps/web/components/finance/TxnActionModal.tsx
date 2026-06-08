"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addBookingAddonAction,
  issueBookingCreditNoteAction,
  recordBookingPaymentAction,
} from "@/app/dashboard/bookings/[id]/payment-actions";
import { voidTransactionAction } from "@/app/dashboard/ledger/actions";
import { hostInitiatedRefundAction } from "@/app/dashboard/refunds/actions";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

export type TxnActionMode =
  | "record_payment"
  | "refund"
  | "credit_note"
  | "add_charge"
  | "void";

const META: Record<
  TxnActionMode,
  { title: string; description: string; submit: string }
> = {
  record_payment: {
    title: "Record a payment",
    description:
      "Log a payment received for this booking. Overpayment is added to the guest's store credit.",
    submit: "Save payment",
  },
  refund: {
    title: "Issue a refund",
    description:
      "Record cash returned to the guest by EFT. This raises a refund against the booking and can't be undone.",
    submit: "Issue refund",
  },
  credit_note: {
    title: "Give a credit note",
    description:
      "Credit the booking and add the amount to the guest's store credit to spend later (no cash leaves your account).",
    submit: "Issue credit note",
  },
  add_charge: {
    title: "Add a charge",
    description:
      "Add an extra charge to this booking — it issues its own invoice and shows on the ledger.",
    submit: "Add charge",
  },
  void: {
    title: "Void transaction",
    description:
      "Reverse this transaction and remove it from the live ledger. It's kept in the audit trail with your reason and can be found under the Voided filter — never deleted.",
    submit: "Void transaction",
  },
};

const FIELD =
  "w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none";
const LABEL =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute";

/**
 * One modal for the booking-level money actions reachable from the ledger ⋯
 * menu — record payment, issue refund, give credit note, add a charge. Each
 * just drives the existing, proven server action; the ledger refreshes on done.
 */
export function TxnActionModal({
  open,
  onOpenChange,
  mode,
  bookingId,
  currency,
  defaultAmount,
  txnId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: TxnActionMode;
  bookingId: string;
  currency: string;
  defaultAmount?: number;
  /** Ledger Txn id — required for the destructive `void` mode. */
  txnId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const meta = META[mode];

  const [amount, setAmount] = useState(
    defaultAmount && defaultAmount > 0 ? String(defaultAmount) : "",
  );
  const [kind, setKind] = useState<"deposit" | "balance" | "payment">(
    "balance",
  );
  const [method, setMethod] = useState<"eft" | "paystack" | "paypal">("eft");
  const [reference, setReference] = useState(""); // provider txn id / EFT ref
  const [text, setText] = useState(""); // note / reason / charge label
  const [markPaid, setMarkPaid] = useState(false);

  function done(msg: string) {
    toast.success(msg);
    onOpenChange(false);
    setAmount("");
    setText("");
    setReference("");
    setMarkPaid(false);
    router.refresh();
  }

  function submit() {
    if (mode === "void") {
      if (text.trim().length < 3) {
        toast.error("Give a reason for voiding this transaction.");
        return;
      }
      if (!txnId) return;
      start(async () => {
        const r = await voidTransactionAction({ txnId, reason: text.trim() });
        if (r.ok) done("Transaction voided.");
        else toast.error(r.error);
      });
      return;
    }

    const value = Math.round((Number(amount) || 0) * 100) / 100;
    if (mode === "add_charge" && !text.trim()) {
      toast.error("Give the charge a name.");
      return;
    }
    if (!(value > 0)) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    if ((mode === "refund" || mode === "credit_note") && !text.trim()) {
      toast.error("Add a reason.");
      return;
    }

    start(async () => {
      if (mode === "record_payment") {
        const r = await recordBookingPaymentAction({
          bookingId,
          amount: value,
          kind,
          method,
          reference: reference.trim() || null,
          note: text.trim() || null,
        });
        if (r.ok) done("Payment recorded.");
        else toast.error(r.error);
      } else if (mode === "refund") {
        const r = await hostInitiatedRefundAction({
          bookingId,
          amount: value,
          method,
          reference: reference.trim() || null,
          reason: text.trim(),
        });
        if (r.ok) done("Refund recorded.");
        else toast.error(r.error);
      } else if (mode === "credit_note") {
        const r = await issueBookingCreditNoteAction({
          bookingId,
          amount: value,
          reason: text.trim(),
        });
        if (r.ok) done("Credit note issued.");
        else toast.error(r.error);
      } else {
        const r = await addBookingAddonAction({
          bookingId,
          items: [{ label: text.trim(), quantity: 1, unitPrice: value }],
          markPaid,
        });
        if (r.ok) done("Charge added.");
        else toast.error(r.error);
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={meta.title}
      description={meta.description}
    >
      <form
        id="txn-action-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        {mode === "add_charge" ? (
          <label className="block">
            <span className={LABEL}>Charge</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Late checkout"
              className={FIELD}
              autoFocus
            />
          </label>
        ) : null}

        {mode !== "void" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mode === "record_payment" ? (
              <label className="block">
                <span className={LABEL}>Type</span>
                <select
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as "deposit" | "balance" | "payment")
                  }
                  className={FIELD}
                >
                  <option value="deposit">Deposit</option>
                  <option value="balance">Balance</option>
                  <option value="payment">Other payment</option>
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className={LABEL}>Amount ({currency})</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={FIELD}
              />
            </label>
          </div>
        ) : null}

        {mode === "record_payment" || mode === "refund" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Method</span>
              <select
                value={method}
                onChange={(e) =>
                  setMethod(e.target.value as "eft" | "paystack" | "paypal")
                }
                className={FIELD}
              >
                <option value="eft">EFT / bank transfer</option>
                <option value="paystack">Paystack (card)</option>
                <option value="paypal">PayPal</option>
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>
                {method === "eft" ? "Reference" : "Transaction ID"}
              </span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={
                  method === "eft"
                    ? "e.g. EFT ref 4471"
                    : method === "paystack"
                      ? "Paystack transaction ID"
                      : "PayPal transaction ID"
                }
                className={FIELD}
              />
            </label>
          </div>
        ) : null}

        {method !== "eft" &&
        (mode === "record_payment" || mode === "refund") ? (
          <p className="-mt-1 text-[11px] text-brand-mute">
            Once card payments go live, the{" "}
            {method === "paystack" ? "Paystack" : "PayPal"} transaction ID is
            captured automatically — until then, paste it here for the record.
          </p>
        ) : null}

        {mode === "record_payment" ? (
          <label className="block">
            <span className={LABEL}>Note (optional)</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. paid in cash"
              className={FIELD}
            />
          </label>
        ) : null}

        {mode === "refund" || mode === "credit_note" || mode === "void" ? (
          <label className="block">
            <span className={LABEL}>Reason</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus={mode === "void"}
              placeholder={
                mode === "refund"
                  ? "e.g. Cancelled — deposit returned"
                  : mode === "void"
                    ? "e.g. Entered in error / duplicate"
                    : "e.g. Goodwill for late check-in"
              }
              className={FIELD}
            />
          </label>
        ) : null}

        {mode === "add_charge" ? (
          <label className="flex items-center gap-2 text-[12.5px] text-brand-ink">
            <input
              type="checkbox"
              checked={markPaid}
              onChange={(e) => setMarkPaid(e.target.checked)}
              className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
            />
            Mark as paid now (money already collected)
          </label>
        ) : null}
      </form>

      <FormModalFooter>
        <FormModalCancel>Cancel</FormModalCancel>
        <button
          type="submit"
          form="txn-action-form"
          disabled={pending}
          className={`rounded px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
            mode === "void"
              ? "bg-red-600 hover:bg-red-700"
              : "bg-brand-primary hover:bg-brand-secondary"
          }`}
        >
          {meta.submit}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}
