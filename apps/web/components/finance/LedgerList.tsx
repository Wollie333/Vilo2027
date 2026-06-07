"use client";

import {
  Download,
  FileText,
  MoreHorizontal,
  ScrollText,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { sendDocumentLinkAction } from "@/app/dashboard/documents-actions";
import { formatMoney } from "@/lib/format";
import type { Txn, TxnType } from "@/lib/finance/transactions";

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

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function amountDisplay(e: Txn): { text: string; cls: string } {
  const money = formatMoney(e.amount, e.currency);
  if (e.type === "charge") return { text: money, cls: "text-brand-ink" };
  if (e.type === "refund") return { text: `− ${money}`, cls: "text-red-600" };
  if (e.type === "credit")
    return { text: `− ${money}`, cls: "text-indigo-600" };
  if (e.type === "credit_applied")
    return { text: `+ ${money}`, cls: "text-indigo-600" };
  // Pending inbound payment — show the sign but mute it until it settles.
  if (e.pending) return { text: `+ ${money}`, cls: "text-brand-mute" };
  return { text: `+ ${money}`, cls: "text-emerald-700" };
}

export function LedgerList({
  entries,
  showGuest = true,
  showBalance = true,
  emptyLabel = "No transactions match your filters.",
  minWidth = 820,
  rowActions,
}: {
  entries: Txn[];
  /** Show the Guest column (hide on per-guest / per-booking views). */
  showGuest?: boolean;
  /** Show the running per-guest Balance column. */
  showBalance?: boolean;
  emptyLabel?: string;
  minWidth?: number;
  /** Per-row controls injected by the booking tab (settle / refund / credit),
   * rendered in the actions cell before the shared document menu. */
  rowActions?: (e: Txn) => React.ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  function sendLink(e: Txn) {
    setMenuId(null);
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

  const cols = 5 + (showGuest ? 1 : 0) + (showBalance ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-card border border-brand-line bg-white shadow-card">
      <table
        className="w-full text-[12.5px]"
        style={{ minWidth: `${minWidth}px` }}
      >
        <thead>
          <tr className="border-b border-brand-line text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            <th className="px-4 py-2.5 text-left">Transaction</th>
            <th className="px-2 py-2.5 text-left">Date</th>
            {showGuest ? (
              <th className="px-2 py-2.5 text-left">Guest</th>
            ) : null}
            <th className="px-2 py-2.5 text-left">Type</th>
            <th className="px-2 py-2.5 text-right">Amount</th>
            {showBalance ? (
              <th className="px-2 py-2.5 text-right">Balance</th>
            ) : null}
            <th className="px-2 py-2.5 text-left">Document</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-line">
          {entries.length === 0 ? (
            <tr>
              <td
                colSpan={cols}
                className="px-4 py-12 text-center text-brand-mute"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            entries.map((e) => {
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
                      {rowActions ? rowActions(e) : null}
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setMenuId(menuId === e.id ? null : e.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-pill text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                          title="Actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === e.id ? (
                          <div
                            className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-[10px] border border-brand-line bg-white text-left shadow-card"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            {e.doc?.viewPath ? (
                              <Link
                                href={e.doc.viewPath}
                                target="_blank"
                                className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-brand-ink transition hover:bg-brand-light"
                              >
                                <FileText className="h-3.5 w-3.5 text-brand-mute" />
                                Open document
                              </Link>
                            ) : null}
                            {e.doc?.pdfPath ? (
                              <a
                                href={e.doc.pdfPath}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-brand-ink transition hover:bg-brand-light"
                              >
                                <Download className="h-3.5 w-3.5 text-brand-mute" />
                                Download document
                              </a>
                            ) : null}
                            {e.bookingId && e.doc?.viewPath ? (
                              <button
                                type="button"
                                onClick={() => sendLink(e)}
                                disabled={pending}
                                className="flex w-full items-center gap-2 border-t border-brand-line px-3 py-2 text-left text-[12.5px] text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                              >
                                <Send className="h-3.5 w-3.5 text-brand-mute" />
                                Send link to guest
                              </button>
                            ) : null}
                            {e.bookingId ? (
                              <Link
                                href={`/dashboard/bookings/${e.bookingId}?tab=payments`}
                                className="flex items-center gap-2 border-t border-brand-line px-3 py-2 text-[12.5px] text-brand-ink transition hover:bg-brand-light"
                              >
                                <ScrollText className="h-3.5 w-3.5 text-brand-mute" />
                                Open booking
                              </Link>
                            ) : null}
                            {!e.doc && !e.bookingId ? (
                              <div className="px-3 py-2 text-[12px] text-brand-mute">
                                No actions
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
