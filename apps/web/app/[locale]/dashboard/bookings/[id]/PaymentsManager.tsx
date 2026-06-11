"use client";

import { CreditCard, FileMinus, Plus, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { LedgerList } from "@/components/finance/LedgerList";
import { modal } from "@/components/ui/modal-host";
import { formatMoney } from "@/lib/format";
import type { Txn } from "@/lib/finance/transactions";

import { AddonManager } from "./AddonManager";
import { PaymentLinkCard } from "./PaymentLinkCard";
import {
  applyGuestCreditAction,
  issueBookingCreditNoteAction,
  recordBookingPaymentAction,
} from "./payment-actions";

export function PaymentsManager({
  bookingId,
  currency,
  totalAmount,
  amountPaid,
  balanceDue,
  depositAmount,
  guestCredit,
  txns,
  canRecord,
  addonCatalog,
  canAddAddons,
  payLink,
}: {
  bookingId: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  depositAmount: number;
  guestCredit: number;
  // The same canonical transactions as the account-wide Ledger and the guest
  // record, filtered to this booking (incl. pending) — rendered with the one
  // shared <LedgerList> so the rows and balances are identical everywhere.
  txns: Txn[];
  canRecord: boolean;
  // Add-ons live here now (the dedicated tab was removed) — "Add add-on" opens
  // the AddonManager modal right beside Record a payment.
  addonCatalog: {
    id: string;
    name: string;
    unitPrice: number;
    active: boolean;
  }[];
  canAddAddons: boolean;
  // Shareable pay-now link — present only while the booking is payable with an
  // outstanding balance (built from the booking's pay_token in the page).
  payLink: {
    url: string;
    reference: string;
    listingName: string;
    guestName: string | null;
    guestEmail: string | null;
    guestPhone: string | null;
  } | null;
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
  // Quick amount presets: Deposit (= the booking's deposit), Full (= the
  // outstanding balance) or Custom (host-entered).
  const [amountMode, setAmountMode] = useState<"deposit" | "full" | "custom">(
    balanceDue > 0 ? "full" : "custom",
  );
  function setQuick(mode: "deposit" | "full" | "custom") {
    setAmountMode(mode);
    if (mode === "deposit") {
      setAmount(depositAmount > 0 ? String(depositAmount) : "");
      setKind("deposit");
    } else if (mode === "full") {
      setAmount(balanceDue > 0 ? String(balanceDue) : "");
      setKind(amountPaid > 0 ? "balance" : "deposit");
    }
  }

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
      // Safety check: warn before recording more than what's owed — the excess
      // becomes store credit, so make sure that's intended.
      if (value > balanceDue + 0.005) {
        const over = value - balanceDue;
        const ok = await modal.confirm({
          title: "That's more than the balance due",
          description: `The balance due is ${formatMoney(
            balanceDue,
            currency,
          )}. Recording ${formatMoney(
            value,
            currency,
          )} overpays by ${formatMoney(
            over,
            currency,
          )}, which will be added to the guest's store credit. Continue?`,
          confirmLabel: "Record anyway",
        });
        if (!ok) return;
      }
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

      {/* shareable pay-now link (only while there's an outstanding balance) */}
      {payLink && balanceDue > 0 ? (
        <PaymentLinkCard
          bookingId={bookingId}
          url={payLink.url}
          reference={payLink.reference}
          listingName={payLink.listingName}
          amountLabel={formatMoney(balanceDue, currency)}
          guestName={payLink.guestName}
          guestEmail={payLink.guestEmail}
          guestPhone={payLink.guestPhone}
        />
      ) : null}

      {/* ledger — every transaction for this booking, the shared canonical rows */}
      <LedgerList
        entries={txns}
        showGuest={false}
        minWidth={720}
        emptyLabel="No transactions yet."
        canManage={canRecord}
      />

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
            {canAddAddons ? (
              <AddonManager
                bookingId={bookingId}
                currency={currency}
                catalog={addonCatalog}
              />
            ) : null}
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
              <div className="mb-3 flex flex-wrap gap-2">
                {(
                  [
                    {
                      m: "deposit" as const,
                      label: `Deposit · ${formatMoney(depositAmount, currency)}`,
                    },
                    {
                      m: "full" as const,
                      label: `Full · ${formatMoney(balanceDue, currency)}`,
                    },
                    { m: "custom" as const, label: "Custom" },
                  ] as const
                ).map(({ m, label }) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setQuick(m)}
                    className={`rounded-pill border px-3 py-1.5 text-[12px] font-semibold transition ${
                      amountMode === m
                        ? "border-brand-primary bg-brand-accent text-brand-secondary"
                        : "border-brand-line bg-white text-brand-ink hover:bg-brand-light/60"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setAmountMode("custom");
                    }}
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
