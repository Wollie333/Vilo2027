"use client";

import {
  Check,
  Copy,
  CreditCard,
  FileMinus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { formatMoney } from "@/lib/format";

import {
  addBookingAddonAction,
  issueBookingCreditNoteAction,
  recordBookingPaymentAction,
} from "../../bookings/[id]/payment-actions";
import { hostInitiatedRefundAction } from "../../refunds/actions";
import type { AddonCatalogItem, BookingItem } from "./GuestRecord";

// The guest record's finance actions, in modals. Each is booking-scoped, so the
// modal always opens with a booking picker, then the action form — and every
// submit calls the SAME canonical server action the booking record uses
// (recordBookingPaymentAction / hostInitiatedRefundAction /
// issueBookingCreditNoteAction / addBookingAddonAction). No forked money logic;
// this is just a faster, modal-first way for the host to reach those actions.

export type FinanceAction = "payment" | "refund" | "credit" | "addon";
export type FinanceRequest = {
  action: FinanceAction;
  /** Pre-selected booking (e.g. from the What-to-do banner); null = host picks. */
  bookingId: string | null;
};

const REFUND_REASONS = [
  "Goodwill / customer service",
  "Property issue mid-stay",
  "Booking cancelled",
  "Overcharge",
  "Other",
] as const;

const REFUND_METHODS: { value: string; label: string }[] = [
  { value: "eft", label: "EFT / bank transfer — sent by you" },
  { value: "manual", label: "Manual / other — sent by you" },
  { value: "paystack", label: "Paystack (card) — automatic" },
  { value: "paypal", label: "PayPal — automatic" },
];

const TITLES: Record<FinanceAction, { title: string; description: string }> = {
  payment: {
    title: "Record a payment",
    description:
      "Log a payment received against a booking, or copy the pay link to send.",
  },
  refund: {
    title: "Issue a refund",
    description: "Refund part or all of what the guest has paid.",
  },
  credit: {
    title: "Issue a credit note",
    description:
      "Add store credit for this guest (a credit-note document; no cash leaves your account).",
  },
  addon: {
    title: "Add an add-on",
    description:
      "Add an extra to a booking — issues a separate invoice and shows on the ledger.",
  },
};

function paidOf(b: BookingItem): number {
  return Math.round((b.totalAmount - b.balanceDue) * 100) / 100;
}

export function GuestFinanceModals({
  request,
  bookings,
  addonCatalog,
  onClose,
}: {
  request: FinanceRequest | null;
  bookings: BookingItem[];
  addonCatalog: AddonCatalogItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const action = request?.action ?? null;

  // Bookings worth offering for this action. Refunds need money in; the rest
  // just need a live (non-cancelled) booking. The picker always shows, per the
  // host's request, but pre-filters to sensible options.
  const eligible = useMemo(() => {
    if (!action) return [];
    if (action === "refund") return bookings.filter((b) => paidOf(b) > 0.005);
    return bookings;
  }, [action, bookings]);

  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"deposit" | "balance" | "payment">(
    "balance",
  );
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<string>(REFUND_REASONS[0]);
  const [method, setMethod] = useState<string>("eft");
  const [addonLabel, setAddonLabel] = useState("");
  const [addonQty, setAddonQty] = useState("1");
  const [addonPrice, setAddonPrice] = useState("");
  const [markPaid, setMarkPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialise the form whenever a new request opens.
  useEffect(() => {
    if (!request) return;
    const pick =
      (request.bookingId &&
        eligible.find((b) => b.id === request.bookingId)?.id) ||
      eligible[0]?.id ||
      "";
    setSelectedId(pick);
    const b = eligible.find((x) => x.id === pick);
    if (request.action === "payment") {
      setAmount(b && b.balanceDue > 0 ? String(b.balanceDue) : "");
      setKind(b && paidOf(b) > 0 ? "balance" : "deposit");
    } else if (request.action === "refund") {
      setAmount(b ? String(paidOf(b)) : "");
      setMethod("eft");
      setReason(REFUND_REASONS[0]);
    } else {
      setAmount("");
    }
    setNote("");
    setReason(REFUND_REASONS[0]);
    setAddonLabel("");
    setAddonQty("1");
    setAddonPrice("");
    setMarkPaid(false);
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const selected = eligible.find((b) => b.id === selectedId) ?? null;
  const currency = selected?.currency ?? "ZAR";

  function onPickBooking(id: string) {
    setSelectedId(id);
    const b = eligible.find((x) => x.id === id);
    if (action === "payment") {
      setAmount(b && b.balanceDue > 0 ? String(b.balanceDue) : "");
      setKind(b && paidOf(b) > 0 ? "balance" : "deposit");
    } else if (action === "refund") {
      setAmount(b ? String(paidOf(b)) : "");
    }
    setCopied(false);
  }

  async function copyLink() {
    if (!selected?.payUrl) return;
    try {
      await navigator.clipboard.writeText(selected.payUrl);
      setCopied(true);
      toast.success("Pay link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the link manually.");
    }
  }

  function submit() {
    if (!selected) {
      toast.error("Pick a booking first.");
      return;
    }
    const bookingId = selected.id;

    if (action === "payment") {
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
          onClose();
          router.refresh();
        } else {
          toast.error(r.error);
        }
      });
      return;
    }

    if (action === "refund") {
      const value = Number(amount);
      const max = paidOf(selected);
      if (!Number.isFinite(value) || value <= 0 || value > max + 0.005) {
        toast.error(
          `Amount must be between 0 and ${formatMoney(max, currency)}.`,
        );
        return;
      }
      start(async () => {
        const r = await hostInitiatedRefundAction({
          bookingId,
          amount: value,
          method: method as "paystack" | "paypal" | "eft" | "manual",
          reason,
          reasonDetail: note.trim() || null,
        });
        if (r.ok) {
          toast.success("Refund issued — guest will be notified.");
          onClose();
          router.refresh();
        } else {
          toast.error(r.error);
        }
      });
      return;
    }

    if (action === "credit") {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        toast.error("Enter an amount greater than zero.");
        return;
      }
      if (!note.trim()) {
        toast.error("Add a reason for the credit note.");
        return;
      }
      start(async () => {
        const r = await issueBookingCreditNoteAction({
          bookingId,
          amount: value,
          reason: note.trim(),
        });
        if (r.ok) {
          toast.success("Credit note issued — added to store credit.");
          onClose();
          router.refresh();
        } else {
          toast.error(r.error);
        }
      });
      return;
    }

    if (action === "addon") {
      const qty = Math.max(1, Math.round(Number(addonQty) || 0));
      const price = Math.round((Number(addonPrice) || 0) * 100) / 100;
      if (!addonLabel.trim()) {
        toast.error("Give the add-on a name.");
        return;
      }
      if (!(price >= 0)) {
        toast.error("Enter a valid price.");
        return;
      }
      start(async () => {
        const r = await addBookingAddonAction({
          bookingId,
          items: [
            { label: addonLabel.trim(), quantity: qty, unitPrice: price },
          ],
          markPaid,
        });
        if (r.ok) {
          toast.success(markPaid ? "Add-on added & paid." : "Add-on added.");
          onClose();
          router.refresh();
        } else {
          toast.error(r.error);
        }
      });
    }
  }

  if (!action) return null;
  const meta = TITLES[action];
  const labelCls =
    "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute";
  const fieldCls =
    "w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none";

  return (
    <FormModal
      open={Boolean(request)}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={meta.title}
      description={meta.description}
    >
      {eligible.length === 0 ? (
        <p className="py-4 text-[13px] text-brand-mute">
          {action === "refund"
            ? "This guest has no payments to refund yet."
            : "This guest has no bookings to act on yet."}
        </p>
      ) : (
        <form
          id="guest-finance-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          {/* booking picker — always shown */}
          <label className="block">
            <span className={labelCls}>Booking</span>
            <select
              value={selectedId}
              onChange={(e) => onPickBooking(e.target.value)}
              className={fieldCls}
            >
              {eligible.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.reference} — {b.listingName} ·{" "}
                  {b.balanceDue > 0.005
                    ? `${formatMoney(b.balanceDue, b.currency)} due`
                    : `${formatMoney(paidOf(b), b.currency)} paid`}
                </option>
              ))}
            </select>
          </label>

          {action === "payment" ? (
            <>
              {selected?.payUrl ? (
                <div className="rounded-[10px] border border-brand-line bg-brand-light/50 p-3">
                  <div className={labelCls}>Pay link — send to the guest</div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={selected.payUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 truncate rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 font-mono text-[11.5px] text-brand-ink"
                    />
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-brand-line bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-brand-light"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-brand-mute">
                    Guest pays by card or EFT online — or record what
                    you&apos;ve already received below.
                  </p>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={labelCls}>Type</span>
                  <select
                    value={kind}
                    onChange={(e) =>
                      setKind(
                        e.target.value as "deposit" | "balance" | "payment",
                      )
                    }
                    className={fieldCls}
                  >
                    <option value="deposit">Deposit</option>
                    <option value="balance">Balance</option>
                    <option value="payment">Other payment</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>Amount ({currency})</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={fieldCls}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Note (optional)</span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. EFT ref 4471"
                    className={fieldCls}
                  />
                </label>
              </div>
              <p className="text-[11.5px] text-brand-mute">
                Records a manual payment as received. Any overpayment is added
                to the guest&apos;s store credit automatically.
              </p>
            </>
          ) : null}

          {action === "refund" ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelCls}>Amount ({currency})</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={fieldCls}
                  />
                  <span className="mt-1 block text-[11px] text-brand-mute">
                    Up to{" "}
                    {formatMoney(selected ? paidOf(selected) : 0, currency)}{" "}
                    paid
                  </span>
                </label>
                <label className="block">
                  <span className={labelCls}>How to refund</span>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className={fieldCls}
                  >
                    {REFUND_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className={labelCls}>Reason</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={fieldCls}
                >
                  {REFUND_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Note (optional)</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 2000))}
                  placeholder="Add context for the guest."
                  className={fieldCls}
                />
              </label>
            </>
          ) : null}

          {action === "credit" ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
                <label className="block">
                  <span className={labelCls}>Amount ({currency})</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={fieldCls}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Reason</span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Goodwill for late check-in"
                    className={fieldCls}
                  />
                </label>
              </div>
              <p className="text-[11.5px] text-brand-mute">
                Issues a credit-note document and adds the amount to this
                guest&apos;s store credit. The booking must be confirmed (it
                needs an invoice).
              </p>
            </>
          ) : null}

          {action === "addon" ? (
            <>
              {addonCatalog.length > 0 ? (
                <label className="block">
                  <span className={labelCls}>Pick from your add-ons</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const item = addonCatalog.find(
                        (c) => c.id === e.target.value,
                      );
                      if (item) {
                        setAddonLabel(item.name);
                        setAddonPrice(String(item.unitPrice));
                      }
                    }}
                    className={fieldCls}
                  >
                    <option value="">Choose an existing add-on…</option>
                    {addonCatalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {formatMoney(c.unitPrice, currency)}
                        {c.active ? "" : " (inactive)"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_80px_120px]">
                <label className="block">
                  <span className={labelCls}>Add-on</span>
                  <input
                    type="text"
                    value={addonLabel}
                    onChange={(e) => setAddonLabel(e.target.value)}
                    placeholder="e.g. Airport transfer"
                    className={fieldCls}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Qty</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={addonQty}
                    onChange={(e) => setAddonQty(e.target.value)}
                    className={fieldCls}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Unit price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addonPrice}
                    onChange={(e) => setAddonPrice(e.target.value)}
                    className={fieldCls}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-brand-ink">
                <input
                  type="checkbox"
                  checked={markPaid}
                  onChange={(e) => setMarkPaid(e.target.checked)}
                  className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                />
                Mark as paid now (money already collected)
              </label>
            </>
          ) : null}
        </form>
      )}

      <FormModalFooter>
        <FormModalCancel>Cancel</FormModalCancel>
        {eligible.length > 0 ? (
          <button
            type="submit"
            form="guest-finance-form"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
          >
            {action === "payment" ? (
              <CreditCard className="h-3.5 w-3.5" />
            ) : action === "refund" ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : action === "credit" ? (
              <FileMinus className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {action === "payment"
              ? "Save payment"
              : action === "refund"
                ? "Confirm refund"
                : action === "credit"
                  ? "Issue credit note"
                  : "Add to booking"}
          </button>
        ) : null}
      </FormModalFooter>
    </FormModal>
  );
}
