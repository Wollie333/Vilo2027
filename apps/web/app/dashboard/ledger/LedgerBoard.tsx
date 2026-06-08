"use client";

import { ScrollText, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { LedgerList } from "@/components/finance/LedgerList";
import { formatMoney } from "@/lib/format";
import type { Txn, TxnStats, TxnType } from "@/lib/finance/transactions";

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

// Everything a host might type to find a transaction: document/ID number,
// document type (invoice / receipt / credit note / refund), booking reference,
// guest name, the note, the transaction type & category, and the date — both
// human ("7 Jun 2026") and ISO ("2026-06-07") so any of them match.
function searchBlob(e: Txn): string {
  const human = new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(e.date));
  return [
    e.doc?.number,
    e.doc?.kind?.replace(/_/g, " "), // invoice / receipt / credit note / refund
    e.bookingRef,
    e.guestName,
    e.note,
    e.type.replace(/_/g, " "), // charge / payment / deposit / credit / refund
    e.category === "addon" ? "add-on addon" : e.category,
    human,
    e.date.slice(0, 10),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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
  const [filter, setFilter] = useState("all");
  const [guest, setGuest] = useState("all");
  const [search, setSearch] = useState("");

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
        (!q || searchBlob(e).includes(q)),
    );
  }, [entries, filter, guest, search]);

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
            placeholder="Search ID, guest, date, type…"
            className="w-60 rounded-[10px] border border-brand-line bg-white py-2 pl-8 pr-3 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Table — the shared canonical ledger rows */}
      <LedgerList entries={rows} canManage />
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
