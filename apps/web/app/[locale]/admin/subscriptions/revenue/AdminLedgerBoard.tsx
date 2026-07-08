"use client";

import { Download, ScrollText, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useMemo, useState } from "react";

import { AdminLedgerList } from "@/components/finance/AdminLedgerList";
import { formatMoney } from "@/lib/format";
import type { WieloTxn, WieloTxnType } from "@/lib/billing/wielo-ledger";

export type WieloKpis = {
  mrr: number;
  arr: number;
  collected: number;
  refunded: number;
  net: number;
  payingHosts: number;
};

type EnvFilter = "live" | "test" | "all";
type StatusFilter = "all" | "completed" | "pending" | "failed";

const TABS: {
  key: string;
  label: string;
  match: (t: WieloTxnType) => boolean;
}[] = [
  { key: "all", label: "All", match: () => true },
  { key: "charge", label: "Charges", match: (t) => t === "charge" },
  { key: "refund", label: "Refunds", match: (t) => t === "refund" },
  { key: "credit", label: "Credits", match: (t) => t === "credit" },
  {
    key: "adjustment",
    label: "Adjustments",
    match: (t) => t === "adjustment",
  },
];

// Everything an admin might type to find a Wielo transaction.
function searchBlob(e: WieloTxn, planLabels: Record<string, string>): string {
  const human = new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(e.date));
  return [
    e.reason,
    e.userName,
    e.userEmail,
    e.hostHandle ? `@${e.hostHandle}` : null,
    e.plan ? (planLabels[e.plan] ?? e.plan) : null,
    e.provider,
    e.providerReference,
    e.doc?.number,
    e.type,
    human,
    e.date.slice(0, 10),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function AdminLedgerBoard({
  entries,
  kpis,
  currency,
  planLabels,
  plans,
  env,
  userEmail,
  plan,
  status,
  dateFrom,
  dateTo,
}: {
  entries: WieloTxn[];
  kpis: WieloKpis;
  currency: string;
  planLabels: Record<string, string>;
  plans: { key: string; name: string }[];
  env: EnvFilter;
  userEmail: string;
  plan: string;
  status: StatusFilter;
  dateFrom: string;
  dateTo: string;
}) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS)
      c[t.key] = entries.filter((e) => t.match(e.type)).length;
    return c;
  }, [entries]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = TABS.find((x) => x.key === tab);
    return entries.filter(
      (e) =>
        (!f || f.match(e.type)) &&
        (!q || searchBlob(e, planLabels).includes(q)),
    );
  }, [entries, tab, search, planLabels]);

  function exportCsv() {
    const header = [
      "Date",
      "User",
      "Email",
      "Host",
      "Type",
      "For",
      "Amount",
      "Currency",
      "Status",
      "Environment",
      "Provider",
      "Reference",
      "Reason",
      "Document",
      "Balance",
    ];
    const lines = rows.map((e) =>
      [
        e.date.slice(0, 10),
        e.userName ?? "",
        e.userEmail ?? "",
        e.hostHandle ? `@${e.hostHandle}` : "",
        e.type,
        e.plan ? (planLabels[e.plan] ?? e.plan) : "",
        e.amount,
        e.currency,
        e.status,
        e.environment,
        e.provider ?? "",
        e.providerReference ?? "",
        e.reason ?? "",
        e.doc?.number ?? "",
        e.balance,
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wielo-ledger-${env}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-brand-secondary text-white">
          <ScrollText className="h-5 w-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[22px] font-extrabold tracking-tight text-brand-ink">
              Wielo revenue ledger
            </h1>
            {env === "test" ? (
              <span className="inline-flex items-center rounded-pill border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                Test
              </span>
            ) : env === "all" ? (
              <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Test + Live
              </span>
            ) : null}
          </div>
          <p className="text-[12.5px] text-brand-mute">
            Every transaction between a user and Wielo — subscriptions,
            products, refunds, credits and adjustments. Booking money goes to
            hosts and isn&apos;t shown here.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="MRR"
          value={formatMoney(Math.round(kpis.mrr), currency)}
          tone="ink"
        />
        <Kpi
          label="ARR"
          value={formatMoney(Math.round(kpis.arr), currency)}
          tone="ink"
        />
        <Kpi
          label="Collected"
          value={formatMoney(kpis.collected, currency)}
          tone="emerald"
        />
        <Kpi
          label="Refunded"
          value={formatMoney(kpis.refunded, currency)}
          tone="red"
        />
        <Kpi label="Net" value={formatMoney(kpis.net, currency)} tone="ink" />
        <Kpi label="Paying hosts" value={String(kpis.payingHosts)} tone="ink" />
      </div>

      {/* Server-side scope: env / user / plan / status / date range. Submitting
          re-fetches the ledger (these change running balances + KPIs). */}
      <form
        action="/admin/subscriptions/revenue"
        method="get"
        className="mb-4 flex flex-wrap items-end gap-2"
      >
        <Labelled label="User email">
          <input
            type="text"
            name="user"
            defaultValue={userEmail}
            placeholder="host@example.com"
            className="min-w-[13rem] rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none"
          />
        </Labelled>
        <Labelled label="Plan">
          <select
            name="plan"
            defaultValue={plan}
            className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
          >
            <option value="">All plans</option>
            {plans.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Status">
          <select
            name="status"
            defaultValue={status}
            className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
          >
            {(["all", "completed", "pending", "failed"] as const).map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="From">
          <input
            type="date"
            name="from"
            defaultValue={dateFrom}
            className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </Labelled>
        <Labelled label="To">
          <input
            type="date"
            name="to"
            defaultValue={dateTo}
            className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </Labelled>
        <Labelled label="Environment">
          <select
            name="env"
            defaultValue={env}
            className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-semibold text-brand-ink focus:border-brand-primary focus:outline-none"
          >
            <option value="live">Live</option>
            <option value="test">Test</option>
            <option value="all">Test + Live</option>
          </select>
        </Labelled>
        <button
          type="submit"
          className="rounded-[10px] bg-brand-primary px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary"
        >
          Apply
        </button>
        {userEmail || plan || status !== "all" || dateFrom || dateTo ? (
          <Link
            href="/admin/subscriptions/revenue"
            className="pb-2 text-[12px] font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {/* Type tabs (client) + search + CSV */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                tab === t.key
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-brand-line bg-white text-brand-ink hover:bg-brand-light"
              }`}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums opacity-70">
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, date, type, doc…"
            className="w-60 rounded-[10px] border border-brand-line bg-white py-2 pl-8 pr-3 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
          title="Download the filtered ledger as CSV"
        >
          <Download className="h-4 w-4 text-brand-mute" />
          CSV
        </button>
      </div>

      <AdminLedgerList entries={rows} planLabels={planLabels} />
      <p className="mt-3 text-[11.5px] text-brand-mute">
        Showing {rows.length} of {entries.length} transactions · Balance shows
        what each user owes Wielo (or their credit) after that entry.
      </p>
    </div>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
    </label>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ink" | "red" | "emerald";
}) {
  const toneCls =
    tone === "red"
      ? "text-red-600"
      : tone === "emerald"
        ? "text-emerald-700"
        : "text-brand-ink";
  return (
    <div className="rounded-[12px] border border-brand-line bg-white p-3.5 shadow-card">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className={`num mt-1 font-display text-[18px] font-bold ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}
