"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileMinus,
  FileText,
  MoreHorizontal,
  RotateCcw,
  ScrollText,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import {
  issueBookingCreditNoteAction,
  markPaymentReceivedAction,
} from "@/app/dashboard/bookings/[id]/payment-actions";
import { sendDocumentLinkAction } from "@/app/dashboard/documents-actions";
import { hostInitiatedRefundAction } from "@/app/dashboard/refunds/actions";
import { modal } from "@/components/ui/modal-host";
import { formatMoney } from "@/lib/format";
import type { Txn, TxnCategory, TxnType } from "@/lib/finance/transactions";

// Inbound payment kinds that can be refunded / credited after settling.
const INBOUND_KINDS = ["deposit", "balance", "addon", "payment"];

// The canonical transaction row. The account-wide Ledger, the per-guest
// Finances tab and the per-booking Payments tab all render with this exact
// component so the rows, money signs and running balances are identical
// everywhere. Each surface just passes a different (already-filtered) slice of
// the one transaction source.

const TYPE_TAG: Record<TxnType, { label: string; cls: string }> = {
  charge: { label: "Charge", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  payment: {
    label: "Payment",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  deposit: {
    label: "Deposit",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  credit_applied: {
    label: "Credit applied",
    cls: "border-indigo-200 bg-indigo-50 text-indigo-600",
  },
  credit: {
    label: "Credit note",
    cls: "border-indigo-200 bg-indigo-50 text-indigo-600",
  },
  refund: { label: "Refund", cls: "border-red-200 bg-red-50 text-red-600" },
};

// What the money was for — booking/stay vs add-on vs credit vs refund.
const CATEGORY_TAG: Record<TxnCategory, { label: string; cls: string }> = {
  booking: {
    label: "Booking",
    cls: "border-brand-line bg-brand-light text-brand-ink",
  },
  addon: {
    label: "Add-on",
    cls: "border-violet-200 bg-violet-50 text-violet-700",
  },
  credit: {
    label: "Store credit",
    cls: "border-indigo-200 bg-indigo-50 text-indigo-600",
  },
  refund: { label: "Refund", cls: "border-red-200 bg-red-50 text-red-600" },
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function amountDisplay(e: Txn): { text: string; cls: string } {
  const money = formatMoney(e.amount, e.currency);
  // Standard accounting convention: debits (charges & refunds — they increase
  // what the guest owes you) print plain; credits (payments, deposits, applied
  // or granted store credit — they reduce it) print in (parentheses).
  const isDebit = e.type === "charge" || e.type === "refund";
  const text = isDebit ? money : `(${money})`;
  let cls: string;
  if (e.type === "charge") cls = "text-brand-ink";
  else if (e.type === "refund") cls = "text-red-600";
  else if (e.type === "credit" || e.type === "credit_applied")
    cls = "text-indigo-600";
  else cls = e.pending ? "text-brand-mute" : "text-emerald-700";
  return { text, cls };
}

export function LedgerList({
  entries,
  showGuest = true,
  showBalance = true,
  emptyLabel = "No transactions match your filters.",
  minWidth = 820,
  canManage = false,
}: {
  entries: Txn[];
  /** Show the Guest column (hide on per-guest / per-booking views). */
  showGuest?: boolean;
  /** Show the running per-guest Balance column. */
  showBalance?: boolean;
  emptyLabel?: string;
  minWidth?: number;
  /** Host context — surface the manage actions (settle / refund / credit note)
   * in each row's ⋯ menu so any transaction can be managed from the ledger. */
  canManage?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // The actions menu is portalled to <body> so the table's horizontal-scroll
  // wrapper can't clip it. We remember which row is open and where to anchor it.
  const [menu, setMenu] = useState<{ entry: Txn; x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setMenu(null);
    };
    document.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function toggleMenu(ev: React.MouseEvent, entry: Txn) {
    ev.stopPropagation();
    if (menu?.entry.id === entry.id) {
      setMenu(null);
      return;
    }
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ entry, x: rect.right, y: rect.bottom });
  }

  // Date sort — newest-first by default (matches the source order); the Date
  // header toggles. Reordering is purely visual: each row keeps the running
  // balance it had after that entry, so the numbers stay correct either way.
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) =>
        dateSort === "desc"
          ? b.date.localeCompare(a.date)
          : a.date.localeCompare(b.date),
      ),
    [entries, dateSort],
  );

  function sendLink(e: Txn) {
    setMenu(null);
    if (!e.bookingId || !e.doc?.viewPath) {
      toast.error("This entry has no shareable document.");
      return;
    }
    const url = `${window.location.origin}${e.doc.viewPath}`;
    start(async () => {
      const r = await sendDocumentLinkAction({
        bookingId: e.bookingId!,
        url,
        label: `${e.doc!.kind.replace(/_/g, " ")} ${e.doc!.number}`,
      });
      if (r.ok) {
        toast.success("Sent to the guest's inbox.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  // ── Per-transaction management (host) ──────────────────────────────────
  // A pending EFT payment can be settled; a settled inbound payment can be
  // refunded (cash back) or credited (store credit). Same server actions and
  // confirmations the booking Payments tab uses — now reachable from any ledger.
  function markReceived(e: Txn) {
    setMenu(null);
    if (!e.paymentId) return;
    start(async () => {
      const ok = await modal.confirm({
        title: "Mark as received?",
        description: `Confirm the ${e.label.toLowerCase()} of ${formatMoney(
          e.amount,
          e.currency,
        )} reflects in your account. This updates the balance and confirms the booking if it's the first payment.`,
        confirmLabel: "Yes, mark received",
      });
      if (!ok) return;
      const r = await markPaymentReceivedAction(e.paymentId!);
      if (r.ok) {
        toast.success("Payment marked received.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function refundOne(e: Txn) {
    setMenu(null);
    if (!e.bookingId) return;
    start(async () => {
      const ok = await modal.destructive({
        title: "Refund this payment?",
        description: `Record a ${formatMoney(e.amount, e.currency)} refund for the ${e.label.toLowerCase()} (money returned to the guest by EFT). This can't be undone.`,
        confirmLabel: "Refund payment",
      });
      if (!ok) return;
      const r = await hostInitiatedRefundAction({
        bookingId: e.bookingId!,
        amount: e.amount,
        method: "eft",
        reason: `Refund of ${e.label.toLowerCase()}`,
      });
      if (r.ok) {
        toast.success("Refund recorded.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function creditOne(e: Txn) {
    setMenu(null);
    if (!e.bookingId) return;
    start(async () => {
      const ok = await modal.confirm({
        title: "Credit this payment?",
        description: `Issue a ${formatMoney(e.amount, e.currency)} credit note for the ${e.label.toLowerCase()} — added to the guest's store credit to spend later (no cash returned).`,
        confirmLabel: "Issue credit note",
      });
      if (!ok) return;
      const r = await issueBookingCreditNoteAction({
        bookingId: e.bookingId!,
        amount: e.amount,
        reason: `Credit of ${e.label.toLowerCase()}`,
      });
      if (r.ok) {
        toast.success("Credit note issued.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  // Whether a given entry has any host-manage action available.
  function canSettle(e: Txn): boolean {
    return Boolean(canManage && e.pending && e.method === "eft" && e.paymentId);
  }
  function canRefundOrCredit(e: Txn): boolean {
    return Boolean(
      canManage &&
      !e.pending &&
      e.status === "completed" &&
      e.kind &&
      INBOUND_KINDS.includes(e.kind) &&
      e.bookingId,
    );
  }

  const cols = 6 + (showGuest ? 1 : 0) + (showBalance ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-card border border-brand-line bg-white shadow-card">
      <table
        className="w-full text-[12.5px]"
        style={{ minWidth: `${minWidth}px` }}
      >
        <thead>
          <tr className="border-b border-brand-line text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            <th className="px-4 py-2.5 text-left">Transaction</th>
            <th className="px-2 py-2.5 text-left">
              <button
                type="button"
                onClick={() =>
                  setDateSort((d) => (d === "desc" ? "asc" : "desc"))
                }
                className="inline-flex items-center gap-1 uppercase tracking-wider text-brand-mute transition hover:text-brand-ink"
                title={`Sort by date (${dateSort === "desc" ? "newest first" : "oldest first"})`}
              >
                Date
                {dateSort === "desc" ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </button>
            </th>
            {showGuest ? (
              <th className="px-2 py-2.5 text-left">Guest</th>
            ) : null}
            <th className="px-2 py-2.5 text-left">Type</th>
            <th className="px-2 py-2.5 text-left">For</th>
            <th className="px-2 py-2.5 text-right">Amount</th>
            {showBalance ? (
              <th className="px-2 py-2.5 text-right">Balance</th>
            ) : null}
            <th className="px-2 py-2.5 text-left">Document</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-line">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={cols}
                className="px-4 py-12 text-center text-brand-mute"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            sorted.map((e) => {
              const tag = TYPE_TAG[e.type];
              const amt = amountDisplay(e);
              return (
                <tr key={e.id} className="align-middle">
                  <td className="px-4 py-3">
                    <div className="font-medium text-brand-ink">
                      {e.note ?? tag.label}
                    </div>
                    {e.bookingRef ? (
                      <div className="font-mono text-[10.5px] text-brand-mute">
                        {e.bookingRef}
                      </div>
                    ) : null}
                  </td>
                  <td className="num whitespace-nowrap px-2 py-3 text-brand-mute">
                    {fmtDate(e.date)}
                  </td>
                  {showGuest ? (
                    <td className="px-2 py-3">
                      {e.guestKey ? (
                        <Link
                          href={`/dashboard/guests/${e.guestKey}?tab=finances`}
                          className="font-semibold text-brand-ink hover:text-brand-secondary hover:underline"
                        >
                          {e.guestName ?? "Guest"}
                        </Link>
                      ) : (
                        <span className="text-brand-mute">
                          {e.guestName ?? "—"}
                        </span>
                      )}
                      {e.method ? (
                        <div className="text-[10.5px] text-brand-mute">
                          {e.method}
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold ${tag.cls}`}
                    >
                      {tag.label}
                    </span>
                    {e.pending ? (
                      <span className="ml-1 inline-flex rounded-pill border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        Pending
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold ${CATEGORY_TAG[e.category].cls}`}
                    >
                      {CATEGORY_TAG[e.category].label}
                    </span>
                  </td>
                  <td
                    className={`num whitespace-nowrap px-2 py-3 text-right font-semibold ${amt.cls}`}
                  >
                    {amt.text}
                  </td>
                  {showBalance ? (
                    <td className="num whitespace-nowrap px-2 py-3 text-right">
                      {Math.abs(e.balance) < 0.5 ? (
                        <span className="text-brand-mute">settled</span>
                      ) : e.balance > 0 ? (
                        <span className="font-semibold text-amber-700">
                          {formatMoney(e.balance, e.currency)} due
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-700">
                          {formatMoney(Math.abs(e.balance), e.currency)} credit
                        </span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-2 py-3">
                    {e.doc?.pdfPath ? (
                      <a
                        href={e.doc.pdfPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded border border-brand-line px-2 py-1 text-[11px] font-medium text-brand-secondary transition hover:bg-brand-accent"
                      >
                        <FileText className="h-3 w-3" /> {e.doc.number}
                        <Download className="h-3 w-3 opacity-60" />
                      </a>
                    ) : e.doc ? (
                      <span className="font-mono text-[10.5px] text-brand-mute">
                        {e.doc.number}
                      </span>
                    ) : (
                      <span className="text-brand-line">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={(ev) => toggleMenu(ev, e)}
                        className={`flex h-8 w-8 items-center justify-center rounded-pill transition hover:bg-brand-light hover:text-brand-ink ${
                          menu?.entry.id === e.id
                            ? "bg-brand-light text-brand-ink"
                            : "text-brand-mute"
                        }`}
                        title="Actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Actions menu — portalled to <body> so the scroll wrapper can't clip it. */}
      {menu
        ? createPortal(
            <div
              className="fixed z-[60] w-52 overflow-hidden rounded-[10px] border border-brand-line bg-white text-left shadow-lift"
              style={{
                top: menu.y + 6,
                left: Math.max(8, menu.x - 208),
              }}
              onClick={(ev) => ev.stopPropagation()}
            >
              {menu.entry.doc?.viewPath ? (
                <Link
                  href={menu.entry.doc.viewPath}
                  target="_blank"
                  onClick={() => setMenu(null)}
                  className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-brand-ink transition hover:bg-brand-light"
                >
                  <FileText className="h-3.5 w-3.5 text-brand-mute" />
                  Open document
                </Link>
              ) : null}
              {menu.entry.doc?.pdfPath ? (
                <a
                  href={menu.entry.doc.pdfPath}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenu(null)}
                  className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-brand-ink transition hover:bg-brand-light"
                >
                  <Download className="h-3.5 w-3.5 text-brand-mute" />
                  Download document
                </a>
              ) : null}
              {menu.entry.bookingId && menu.entry.doc?.viewPath ? (
                <button
                  type="button"
                  onClick={() => sendLink(menu.entry)}
                  disabled={pending}
                  className="flex w-full items-center gap-2 border-t border-brand-line px-3 py-2 text-left text-[12.5px] text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5 text-brand-mute" />
                  Send link to guest
                </button>
              ) : null}
              {menu.entry.bookingId ? (
                <Link
                  href={`/dashboard/bookings/${menu.entry.bookingId}?tab=payments`}
                  onClick={() => setMenu(null)}
                  className="flex items-center gap-2 border-t border-brand-line px-3 py-2 text-[12.5px] text-brand-ink transition hover:bg-brand-light"
                >
                  <ScrollText className="h-3.5 w-3.5 text-brand-mute" />
                  Open booking
                </Link>
              ) : null}

              {canSettle(menu.entry) ? (
                <button
                  type="button"
                  onClick={() => markReceived(menu.entry)}
                  disabled={pending}
                  className="flex w-full items-center gap-2 border-t border-brand-line px-3 py-2 text-left text-[12.5px] font-medium text-brand-primary transition hover:bg-brand-light disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark as received
                </button>
              ) : null}
              {canRefundOrCredit(menu.entry) ? (
                <>
                  <button
                    type="button"
                    onClick={() => refundOne(menu.entry)}
                    disabled={pending}
                    className="flex w-full items-center gap-2 border-t border-brand-line px-3 py-2 text-left text-[12.5px] text-brand-ink transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-brand-mute" />
                    Refund this payment
                  </button>
                  <button
                    type="button"
                    onClick={() => creditOne(menu.entry)}
                    disabled={pending}
                    className="flex w-full items-center gap-2 border-t border-brand-line px-3 py-2 text-left text-[12.5px] text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                  >
                    <FileMinus className="h-3.5 w-3.5 text-brand-mute" />
                    Credit to store credit
                  </button>
                </>
              ) : null}
              {!menu.entry.doc &&
              !menu.entry.bookingId &&
              !canSettle(menu.entry) &&
              !canRefundOrCredit(menu.entry) ? (
                <div className="px-3 py-2 text-[12px] text-brand-mute">
                  No actions for this entry
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
