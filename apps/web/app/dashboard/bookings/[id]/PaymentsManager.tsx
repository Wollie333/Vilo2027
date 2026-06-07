"use client";

import {
  Check,
  Clock,
  CreditCard,
  FileMinus,
  MoreHorizontal,
  Plus,
  Receipt,
  RotateCcw,
  Wallet,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { modal } from "@/components/ui/modal-host";
import { formatMoney } from "@/lib/format";

import { hostInitiatedRefundAction } from "../../refunds/actions";
import {
  applyGuestCreditAction,
  issueBookingCreditNoteAction,
  markPaymentReceivedAction,
  recordBookingPaymentAction,
} from "./payment-actions";

const INBOUND_KINDS = ["deposit", "balance", "addon", "payment"];

export type LedgerEntry = {
  id: string;
  kind: string;
  label: string;
  amount: number;
  status: string;
  method: string;
  note: string | null;
  date: string | null;
  receiptNumber: string | null;
  receiptToken: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_BADGE: Record<string, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-red-200 bg-red-50 text-red-600",
  refunded: "border-rose-200 bg-rose-50 text-rose-600",
  voided: "border-brand-line bg-brand-light text-brand-mute",
};

export function PaymentsManager({
  bookingId,
  currency,
  totalAmount,
  amountPaid,
  balanceDue,
  guestCredit,
  payments,
  canRecord,
}: {
  bookingId: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  guestCredit: number;
  payments: LedgerEntry[];
  canRecord: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState<string>(
    balanceDue > 0 ? String(balanceDue) : "",
  );
  const [kind, setKind] = useState<"deposit" | "balance" | "payment">(
    amountPaid <= 0 ? "deposit" : "balance",
  );
  const [note, setNote] = useState("");

  const paidPct =
    totalAmount > 0
      ? Math.min(100, Math.round((amountPaid / totalAmount) * 100))
      : 0;

  function record() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    start(async () => {
      const r = await recordBookingPaymentAction({
        bookingId,
        amount: value,
        kind,
        note: note.trim() || null,
      });
      if (r.ok) {
        toast.success("Payment recorded.");
        setShowForm(false);
        setNote("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function markReceived(id: string, label: string, amt: number) {
    start(async () => {
      const ok = await modal.confirm({
        title: "Mark as received?",
        description: `Confirm the ${label.toLowerCase()} of ${formatMoney(
          amt,
          currency,
        )} reflects in your account. This updates the balance and confirms the booking if it's the first payment.`,
        confirmLabel: "Yes, mark received",
      });
      if (!ok) return;
      const r = await markPaymentReceivedAction(id);
      if (r.ok) {
        toast.success("Payment marked received.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function applyCredit() {
    const usable = Math.min(guestCredit, balanceDue);
    start(async () => {
      const ok = await modal.confirm({
        title: "Apply store credit?",
        description: `Apply ${formatMoney(
          usable,
          currency,
        )} of this guest's store credit to the outstanding balance.`,
        confirmLabel: "Apply credit",
      });
      if (!ok) return;
      const r = await applyGuestCreditAction({ bookingId, amount: usable });
      if (r.ok) {
        toast.success("Credit applied.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  const [menuId, setMenuId] = useState<string | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  function issueCredit() {
    const value = Number(creditAmount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    if (!creditReason.trim()) {
      toast.error("Add a reason.");
      return;
    }
    start(async () => {
      const r = await issueBookingCreditNoteAction({
        bookingId,
        amount: value,
        reason: creditReason.trim(),
      });
      if (r.ok) {
        toast.success(
          "Credit note issued — added to the guest's store credit.",
        );
        setCreditOpen(false);
        setCreditAmount("");
        setCreditReason("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function refundOne(amount: number, label: string) {
    setMenuId(null);
    start(async () => {
      const ok = await modal.destructive({
        title: "Refund this payment?",
        description: `Record a ${formatMoney(amount, currency)} refund for the ${label.toLowerCase()} (money returned to the guest by EFT). This can't be undone.`,
        confirmLabel: "Refund payment",
      });
      if (!ok) return;
      const r = await hostInitiatedRefundAction({
        bookingId,
        amount,
        method: "eft",
        reason: `Refund of ${label.toLowerCase()}`,
      });
      if (r.ok) {
        toast.success("Refund recorded.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function creditOne(amount: number, label: string) {
    setMenuId(null);
    start(async () => {
      const ok = await modal.confirm({
        title: "Credit this payment?",
        description: `Issue a ${formatMoney(amount, currency)} credit note for the ${label.toLowerCase()} — added to the guest's store credit to spend later (no cash returned).`,
        confirmLabel: "Issue credit note",
      });
      if (!ok) return;
      const r = await issueBookingCreditNoteAction({
        bookingId,
        amount,
        reason: `Credit of ${label.toLowerCase()}`,
      });
      if (r.ok) {
        toast.success("Credit note issued.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* money summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Paid"
          value={formatMoney(amountPaid, currency)}
          tone="ink"
        />
        <Stat
          label="Balance due"
          value={formatMoney(balanceDue, currency)}
          tone={balanceDue > 0 ? "amber" : "emerald"}
        />
        <Stat
          label="Store credit"
          value={formatMoney(guestCredit, currency)}
          tone={guestCredit > 0 ? "emerald" : "mute"}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-brand-mute">
          <span>{paidPct}% collected</span>
          <span>{formatMoney(totalAmount, currency)} total</span>
        </div>
        <div className="h-2 overflow-hidden rounded-pill bg-brand-line">
          <div
            className="h-full rounded-pill bg-brand-primary transition-all"
            style={{ width: `${Math.max(paidPct, paidPct > 0 ? 4 : 0)}%` }}
          />
        </div>
      </div>

      {/* ledger */}
      <div className="overflow-hidden rounded-[12px] border border-brand-line">
        <div className="border-b border-brand-line bg-brand-light px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Payment ledger
        </div>
        {payments.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-brand-mute">
            No payments recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-brand-ink">
                      {p.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-pill border px-2 py-px text-[10px] font-semibold capitalize ${
                        STATUS_BADGE[p.status] ??
                        "border-brand-line bg-brand-light text-brand-mute"
                      }`}
                    >
                      {p.status === "completed" ? (
                        <Check className="h-2.5 w-2.5" />
                      ) : p.status === "pending" ? (
                        <Clock className="h-2.5 w-2.5" />
                      ) : null}
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
                    {fmtDate(p.date)} · {p.method.replace(/_/g, " ")}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="font-display text-[14px] font-bold tabular-nums text-brand-ink">
                    {formatMoney(p.amount, currency)}
                  </span>
                  {p.status === "completed" && p.receiptToken ? (
                    <a
                      href={`/receipt/${p.receiptToken}`}
                      target="_blank"
                      rel="noreferrer"
                      title={p.receiptNumber ?? "Receipt"}
                      className="inline-flex items-center gap-1 rounded border border-brand-line px-2 py-1 text-[11.5px] font-medium text-brand-secondary transition hover:bg-brand-accent"
                    >
                      <Receipt className="h-3 w-3" /> Receipt
                    </a>
                  ) : null}
                  {canRecord && p.status === "pending" && p.method === "eft" ? (
                    <button
                      type="button"
                      onClick={() => markReceived(p.id, p.label, p.amount)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded border border-brand-primary bg-brand-primary px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> Received
                    </button>
                  ) : null}
                  {canRecord &&
                  p.status === "completed" &&
                  INBOUND_KINDS.includes(p.kind) ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuId(menuId === p.id ? null : p.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-pill text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                        title="More"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuId === p.id ? (
                        <div className="absolute right-0 top-8 z-10 w-44 overflow-hidden rounded-[10px] border border-brand-line bg-white shadow-card">
                          <button
                            type="button"
                            onClick={() => refundOne(p.amount, p.label)}
                            disabled={pending}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-brand-mute" />
                            Refund this
                          </button>
                          <button
                            type="button"
                            onClick={() => creditOne(p.amount, p.label)}
                            disabled={pending}
                            className="flex w-full items-center gap-2 border-t border-brand-line px-3 py-2 text-left text-[12.5px] text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                          >
                            <FileMinus className="h-3.5 w-3.5 text-brand-mute" />
                            Credit this
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* actions */}
      {canRecord ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              <Plus className="h-4 w-4" /> Record a payment
            </button>
            {guestCredit > 0 && balanceDue > 0 ? (
              <button
                type="button"
                onClick={applyCredit}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded border border-brand-line px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-accent disabled:opacity-50"
              >
                <Wallet className="h-4 w-4 text-brand-secondary" /> Apply store
                credit
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setCreditOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded border border-brand-line px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-accent"
            >
              <FileMinus className="h-4 w-4 text-brand-mute" /> Issue credit
              note
            </button>
          </div>

          {creditOpen ? (
            <div className="rounded-[12px] border border-brand-line bg-brand-light/40 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    Amount ({currency})
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    Reason
                  </span>
                  <input
                    type="text"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    placeholder="e.g. Goodwill for late check-in"
                    className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
                  />
                </label>
              </div>
              <p className="mt-2.5 text-[11.5px] text-brand-mute">
                Issues a credit-note document and adds the amount to this
                guest&apos;s store credit (no cash leaves your account).
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={issueCredit}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
                >
                  <FileMinus className="h-3.5 w-3.5" /> Issue credit note
                </button>
                <button
                  type="button"
                  onClick={() => setCreditOpen(false)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded border border-brand-line px-4 py-2 text-[13px] font-medium text-brand-mute transition hover:bg-white disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : null}

          {showForm ? (
            <div className="rounded-[12px] border border-brand-line bg-brand-light/40 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    Type
                  </span>
                  <select
                    value={kind}
                    onChange={(e) =>
                      setKind(
                        e.target.value as "deposit" | "balance" | "payment",
                      )
                    }
                    className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
                  >
                    <option value="deposit">Deposit</option>
                    <option value="balance">Balance</option>
                    <option value="payment">Other payment</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    Amount ({currency})
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    Note (optional)
                  </span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. EFT ref 4471"
                    className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
                  />
                </label>
              </div>
              <p className="mt-2.5 text-[11.5px] text-brand-mute">
                Records a manual EFT payment as received. Overpayment is added
                to the guest&apos;s store credit automatically.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={record}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Save payment
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded border border-brand-line px-4 py-2 text-[13px] font-medium text-brand-mute transition hover:bg-white disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ink" | "amber" | "emerald" | "mute";
}) {
  const toneCls =
    tone === "amber"
      ? "text-amber-700"
      : tone === "emerald"
        ? "text-emerald-700"
        : tone === "mute"
          ? "text-brand-mute"
          : "text-brand-ink";
  return (
    <div className="rounded-[12px] border border-brand-line p-3.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className={`mt-1 font-display text-[17px] font-bold ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}
