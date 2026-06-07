"use client";

import {
  Download,
  FileText,
  MoreHorizontal,
  ScrollText,
  Search,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { sendDocumentLinkAction } from "@/app/dashboard/documents-actions";
import { formatMoney } from "@/lib/format";
import type { Txn, TxnStats, TxnType } from "@/lib/finance/transactions";

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

const FILTERS: {
  key: string;
  label: string;
  match: (t: TxnType) => boolean;
}[] = [
  { key: "all", label: "All", match: () => true },
  { key: "charge", label: "Charges", match: (t) => t === "charge" },
  {
    key: "payment",
    label: "Payments",
    match: (t) => t === "payment" || t === "deposit" || t === "credit_applied",
  },
  { key: "refund", label: "Refunds", match: (t) => t === "refund" },
  { key: "credit", label: "Credits", match: (t) => t === "credit" },
];

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
  return { text: `+ ${money}`, cls: "text-emerald-700" };
}

export function LedgerBoard({
  entries,
  stats,
  guests,
  currency,
}: {
  entries: Txn[];
  stats: TxnStats;
  guests: { key: string; name: string }[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("all");
  const [guest, setGuest] = useState("all");
  const [search, setSearch] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS)
      c[f.key] = entries.filter((e) => f.match(e.type)).length;
    return c;
  }, [entries]);

  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    const q = search.trim().toLowerCase();
    return entries.filter(
      (e) =>
        f.match(e.type) &&
        (guest === "all" || e.guestKey === guest) &&
        (!q ||
          (e.guestName ?? "").toLowerCase().includes(q) ||
          (e.bookingRef ?? "").toLowerCase().includes(q) ||
          (e.doc?.number ?? "").toLowerCase().includes(q) ||
          (e.note ?? "").toLowerCase().includes(q)),
    );
  }, [entries, filter, guest, search]);

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

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 lg:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-brand-secondary text-white">
          <ScrollText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-brand-ink">
            Ledger
          </h1>
          <p className="text-[12.5px] text-brand-mute">
            Every transaction across your whole account
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label="Outstanding"
          value={formatMoney(stats.outstanding, currency)}
          sub={`across ${stats.owingGuests} guest${stats.owingGuests === 1 ? "" : "s"}`}
          tone="amber"
        />
        <Kpi
          label="Collected"
          value={formatMoney(stats.collected, currency)}
          tone="ink"
        />
        <Kpi
          label="Refunded"
          value={formatMoney(stats.refunded, currency)}
          tone="red"
        />
        <Kpi
          label="Credits"
          value={formatMoney(stats.credits, currency)}
          tone="indigo"
        />
        <Kpi
          label="Net"
          value={formatMoney(stats.net, currency)}
          tone="emerald"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                filter === f.key
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-brand-line bg-white text-brand-ink hover:bg-brand-light"
              }`}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-70">
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
        <select
          value={guest}
          onChange={(e) => setGuest(e.target.value)}
          className="ml-auto rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
        >
          <option value="all">All guests</option>
          {guests.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-44 rounded-[10px] border border-brand-line bg-white py-2 pl-8 pr-3 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-brand-line bg-white shadow-card">
        <table className="w-full min-w-[820px] text-[12.5px]">
          <thead>
            <tr className="border-b border-brand-line text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              <th className="px-4 py-2.5 text-left">Transaction</th>
              <th className="px-2 py-2.5 text-left">Date</th>
              <th className="px-2 py-2.5 text-left">Guest</th>
              <th className="px-2 py-2.5 text-left">Type</th>
              <th className="px-2 py-2.5 text-right">Amount</th>
              <th className="px-2 py-2.5 text-right">Balance</th>
              <th className="px-2 py-2.5 text-left">Document</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-brand-mute"
                >
                  No transactions match your filters.
                </td>
              </tr>
            ) : (
              rows.map((e) => {
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
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold ${tag.cls}`}
                      >
                        {tag.label}
                      </span>
                    </td>
                    <td
                      className={`num whitespace-nowrap px-2 py-3 text-right font-semibold ${amt.cls}`}
                    >
                      {amt.text}
                    </td>
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
                    <td className="px-4 py-3 text-right">
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
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px] text-brand-mute">
        Showing {rows.length} of {entries.length} transactions · Balance shows
        what each guest owes you (or their credit) after that entry.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "ink" | "amber" | "red" | "indigo" | "emerald";
}) {
  const toneCls =
    tone === "amber"
      ? "text-amber-700"
      : tone === "red"
        ? "text-red-600"
        : tone === "indigo"
          ? "text-indigo-600"
          : tone === "emerald"
            ? "text-emerald-700"
            : "text-brand-ink";
  return (
    <div className="rounded-[12px] border border-brand-line bg-white p-3.5 shadow-card">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className={`mt-1 font-display text-[18px] font-bold ${toneCls}`}>
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[11px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}
