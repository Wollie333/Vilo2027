"use client";

import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import type { WieloTxn, WieloTxnType } from "@/lib/billing/wielo-ledger";

// The Wielo revenue ledger's row renderer — the admin-side sibling of the host
// LedgerList (components/finance/LedgerList.tsx). Same columns, tags, money signs
// and running-balance styling, but typed to WieloTxn (user↔Wielo money) with a
// per-user account balance and a Wielo document (invoice / credit note) per row.

const TYPE_TAG: Record<WieloTxnType, { label: string; cls: string }> = {
  charge: { label: "Charge", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  refund: { label: "Refund", cls: "border-red-200 bg-red-50 text-red-600" },
  credit: {
    label: "Credit",
    cls: "border-indigo-200 bg-indigo-50 text-indigo-600",
  },
  adjustment: {
    label: "Adjustment",
    cls: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

const MENU_ITEM =
  "flex w-full items-center gap-2 border-t border-brand-line px-3 py-2 text-left text-[12.5px] text-brand-ink transition hover:bg-brand-light first:border-t-0 disabled:opacity-50";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function providerLabel(p: string | null): string {
  if (p === "paystack") return "Paystack";
  if (p === "paypal") return "PayPal";
  if (p === "manual") return "Manual";
  if (p === "eft") return "EFT";
  return p ?? "";
}

// What the money was for — the plan/product name, else the provider, else type.
function forLabel(e: WieloTxn, planLabels: Record<string, string>): string {
  if (e.plan) return planLabels[e.plan] ?? e.plan;
  if (e.provider === "manual") return "Manual entry";
  return TYPE_TAG[e.type].label;
}

const FOR_CLS: Record<WieloTxnType, string> = {
  charge: "border-brand-line bg-brand-light text-brand-ink",
  refund: "border-red-200 bg-red-50 text-red-600",
  credit: "border-indigo-200 bg-indigo-50 text-indigo-600",
  adjustment: "border-amber-200 bg-amber-50 text-amber-700",
};

function amountDisplay(e: WieloTxn): { text: string; cls: string } {
  const neg = e.amount < 0;
  const money = formatMoney(Math.abs(e.amount), e.currency);
  const text = neg ? `(${money})` : money;
  let cls: string;
  if (e.type === "refund") cls = "text-red-600";
  else if (e.type === "credit") cls = "text-indigo-600";
  else if (e.type === "adjustment")
    cls = neg ? "text-red-600" : "text-brand-ink";
  else cls = "text-brand-ink";
  return { text, cls };
}

export function AdminLedgerList({
  entries,
  planLabels,
  emptyLabel = "No transactions match your filters.",
  minWidth = 900,
}: {
  entries: WieloTxn[];
  /** Plan key → product name, so a row reads "Starter" not "pro". */
  planLabels: Record<string, string>;
  emptyLabel?: string;
  minWidth?: number;
}) {
  const [menu, setMenu] = useState<{
    entry: WieloTxn;
    x: number;
    y: number;
  } | null>(null);

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

  function toggleMenu(ev: React.MouseEvent, entry: WieloTxn) {
    ev.stopPropagation();
    if (menu?.entry.id === entry.id) {
      setMenu(null);
      return;
    }
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ entry, x: rect.right, y: rect.bottom });
  }

  function copyLink(e: WieloTxn) {
    setMenu(null);
    if (!e.doc?.viewPath) {
      toast.error("This entry has no document.");
      return;
    }
    const url = `${window.location.origin}${e.doc.viewPath}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Document link copied."),
      () => toast.error("Couldn't copy the link."),
    );
  }

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
            <th className="px-2 py-2.5 text-left">User</th>
            <th className="px-2 py-2.5 text-left">Type</th>
            <th className="px-2 py-2.5 text-left">For</th>
            <th className="px-2 py-2.5 text-right">Amount</th>
            <th className="px-2 py-2.5 text-right">Balance</th>
            <th className="px-2 py-2.5 text-left">Document</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-line">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                className="px-4 py-12 text-center text-brand-mute"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            sorted.map((e) => {
              const tag = TYPE_TAG[e.type];
              const amt = amountDisplay(e);
              const isPending = e.status === "pending";
              const failed = e.status === "failed";
              return (
                <tr
                  key={e.id}
                  className={`align-middle ${failed ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-brand-ink">
                      {e.reason ?? tag.label}
                    </div>
                    {e.providerReference ? (
                      <div className="text-[10.5px] text-brand-mute">
                        {providerLabel(e.provider)}
                        {e.provider ? " · " : ""}
                        <span className="font-mono">{e.providerReference}</span>
                      </div>
                    ) : e.provider ? (
                      <div className="text-[10.5px] text-brand-mute">
                        {providerLabel(e.provider)}
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-brand-mute">
                    <div className="num">{fmtDate(e.date)}</div>
                    <div className="num text-[10.5px] opacity-70">
                      {fmtTime(e.date)}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="font-semibold text-brand-ink">
                      {e.userName ?? e.userEmail ?? "—"}
                    </div>
                    {e.userEmail && e.userName ? (
                      <div className="text-[10.5px] text-brand-mute">
                        {e.userEmail}
                      </div>
                    ) : null}
                    {e.hostHandle ? (
                      <div className="font-mono text-[10.5px] text-brand-mute">
                        @{e.hostHandle}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold ${tag.cls}`}
                    >
                      {tag.label}
                    </span>
                    {isPending ? (
                      <span className="ml-1 inline-flex rounded-pill border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        Pending
                      </span>
                    ) : null}
                    {failed ? (
                      <span className="ml-1 inline-flex rounded-pill border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                        Failed
                      </span>
                    ) : null}
                    {e.environment === "test" ? (
                      <span className="ml-1 inline-flex rounded-pill border border-brand-line bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand-mute">
                        Test
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold ${FOR_CLS[e.type]}`}
                    >
                      {forLabel(e, planLabels)}
                    </span>
                    {e.billingCycle ? (
                      <div className="mt-0.5 text-[10.5px] text-brand-mute">
                        {e.billingCycle}
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={`num whitespace-nowrap px-2 py-3 text-right font-semibold ${amt.cls}`}
                  >
                    {amt.text}
                  </td>
                  <td className="num whitespace-nowrap px-2 py-3 text-right">
                    {isPending && e.type === "charge" ? (
                      <span className="text-brand-mute">awaiting</span>
                    ) : Math.abs(e.balance) < 0.5 ? (
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
                  <td className="px-2 py-3">
                    {e.doc ? (
                      <a
                        href={e.doc.pdfPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded border border-brand-line px-2 py-1 text-[11px] font-medium text-brand-secondary transition hover:bg-brand-accent"
                      >
                        <FileText className="h-3 w-3" /> {e.doc.number}
                        <Download className="h-3 w-3 opacity-60" />
                      </a>
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

      {menu
        ? createPortal(
            <div
              className="fixed z-[60] w-52 overflow-hidden rounded-[10px] border border-brand-line bg-white text-left shadow-lift"
              style={{ top: menu.y + 6, left: Math.max(8, menu.x - 208) }}
              onClick={(ev) => ev.stopPropagation()}
            >
              {menu.entry.doc ? (
                <>
                  <Link
                    href={menu.entry.doc.viewPath}
                    target="_blank"
                    onClick={() => setMenu(null)}
                    className={MENU_ITEM}
                  >
                    <FileText className="h-3.5 w-3.5 text-brand-mute" />
                    Open document
                  </Link>
                  <a
                    href={menu.entry.doc.pdfPath}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMenu(null)}
                    className={MENU_ITEM}
                  >
                    <Download className="h-3.5 w-3.5 text-brand-mute" />
                    Download PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => copyLink(menu.entry)}
                    className={MENU_ITEM}
                  >
                    <Copy className="h-3.5 w-3.5 text-brand-mute" />
                    Copy link
                  </button>
                </>
              ) : (
                <div className="px-3 py-2 text-[12px] text-brand-mute">
                  No document for this entry
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
