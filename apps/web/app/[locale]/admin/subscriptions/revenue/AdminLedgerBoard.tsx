"use client";

import {
  CreditCard,
  Download,
  FileMinus,
  Link2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminLedgerList } from "@/components/finance/AdminLedgerList";
import { DatePicker } from "@/components/ui/date-picker";
import { formatMoney } from "@/lib/format";
import type { WieloTxn, WieloTxnType } from "@/lib/billing/wielo-ledger";

import {
  WieloFinanceModals,
  type WieloFinanceAction,
  type WieloFinanceRequest,
} from "./WieloFinanceModals";

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
  { key: "adjustment", label: "Adjustments", match: (t) => t === "adjustment" },
  {
    key: "affiliate",
    label: "Affiliate",
    match: (t) => t === "commission" || t === "payout",
  },
];

const SELECT_CLS =
  "rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none";

// The three product types, in display order, for grouping product dropdowns.
export const PRODUCT_TYPE_GROUPS: { key: string; label: string }[] = [
  { key: "membership", label: "Memberships" },
  { key: "service", label: "Services" },
  { key: "product", label: "Once-off products" },
];

// Everything an admin might type to find a Wielo transaction.
function searchBlob(
  e: WieloTxn,
  planLabels: Record<string, string>,
  productLabels: Record<string, string>,
): string {
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
    e.productId ? (productLabels[e.productId] ?? null) : null,
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
  productLabels,
  products,
  payableProducts,
  env,
  userEmail,
  product,
  status,
  dateFrom,
  dateTo,
}: {
  entries: WieloTxn[];
  kpis: WieloKpis;
  currency: string;
  planLabels: Record<string, string>;
  /** product_id → name, for the "For" column on product-keyed rows. */
  productLabels: Record<string, string>;
  /** Every sellable product for the filter (value = product_id, label = name). */
  products: { key: string; name: string; productType: string }[];
  /** Payable products for the pay-link picker (id + price + product type). */
  payableProducts: {
    id: string;
    name: string;
    price: number;
    currency: string;
    productType: string;
  }[];
  env: EnvFilter;
  userEmail: string;
  product: string;
  status: StatusFilter;
  dateFrom: string;
  dateTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [emailInput, setEmailInput] = useState(userEmail);
  // Finance action modals (record payment / refund / credit / adjustment / link).
  const [financeReq, setFinanceReq] = useState<WieloFinanceRequest | null>(
    null,
  );
  function openAction(action: WieloFinanceAction, email = "") {
    setFinanceReq({ action, email });
  }

  // Unique users seen in the ledger — feeds the modal's email datalist.
  const users = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const e of entries) {
      if (e.userEmail && !seen.has(e.userEmail))
        seen.set(e.userEmail, e.userName);
    }
    return [...seen.entries()].map(([email, name]) => ({ email, name }));
  }, [entries]);

  // The env / product / status / user / date filters are a SERVER scope — they
  // change the fetched set (and therefore the running balances + KPIs), so
  // changing one navigates with new query params and the page re-fetches. This
  // mirrors the host ledger's business filter (change → navigate, no button).
  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasServerFilter = Boolean(
    userEmail || product || status !== "all" || dateFrom || dateTo,
  );

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
        (!q || searchBlob(e, planLabels, productLabels).includes(q)),
    );
  }, [entries, tab, search, planLabels, productLabels]);

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
        e.plan
          ? (planLabels[e.plan] ?? e.plan)
          : e.productId
            ? (productLabels[e.productId] ?? "")
            : "",
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

      {/* Finance actions — the platform-side sibling of the guest record's
          finance toolbar. Each opens a host-scoped modal (record payment /
          refund / credit / adjustment / send payment link). */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => openAction("payment", userEmail)}
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
        >
          <CreditCard className="h-4 w-4" /> Record payment
        </button>
        <button
          type="button"
          onClick={() => openAction("refund", userEmail)}
          className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <RotateCcw className="h-4 w-4 text-brand-mute" /> Issue refund
        </button>
        <button
          type="button"
          onClick={() => openAction("credit", userEmail)}
          className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <FileMinus className="h-4 w-4 text-brand-mute" /> Credit note
        </button>
        <button
          type="button"
          onClick={() => openAction("adjustment", userEmail)}
          className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <FileMinus className="h-4 w-4 text-brand-mute" /> Adjustment
        </button>
        <button
          type="button"
          onClick={() => openAction("link", userEmail)}
          className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <Link2 className="h-4 w-4 text-brand-mute" /> Send payment link
        </button>
      </div>

      {/* Filters — one clean row like the host ledger: type tabs (client) on the
          left, product / status scope selects (navigate → re-fetch) on the right. */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={env}
            onChange={(e) => pushParams({ env: e.target.value })}
            className={`${SELECT_CLS} font-semibold`}
            title="Environment"
          >
            <option value="live">Live</option>
            <option value="test">Test</option>
            <option value="all">Test + Live</option>
          </select>
          <select
            value={product}
            onChange={(e) => pushParams({ product: e.target.value })}
            className={SELECT_CLS}
            title="Product"
          >
            <option value="">All products</option>
            {PRODUCT_TYPE_GROUPS.map(({ key, label }) => {
              const inGroup = products.filter((p) => p.productType === key);
              if (inGroup.length === 0) return null;
              return (
                <optgroup key={key} label={label}>
                  {inGroup.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <select
            value={status}
            onChange={(e) => pushParams({ status: e.target.value })}
            className={SELECT_CLS}
            title="Status"
          >
            {(["all", "completed", "pending", "failed"] as const).map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2 — search (client) + user / date scope + CSV, like the host's
          search row. */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, date, type, doc…"
            className="w-60 rounded-[10px] border border-brand-line bg-white py-2 pl-8 pr-3 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </div>
        <input
          type="text"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParams({ user: emailInput.trim() });
          }}
          onBlur={() => {
            if (emailInput.trim() !== userEmail)
              pushParams({ user: emailInput.trim() });
          }}
          placeholder="Filter by user email…"
          className="w-52 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-[12.5px] text-brand-mute">
          From
          <DatePicker
            value={dateFrom}
            onChange={(iso) => pushParams({ from: iso })}
            clearable
            className="w-40"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-brand-mute">
          To
          <DatePicker
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(iso) => pushParams({ to: iso })}
            clearable
            className="w-40"
          />
        </label>
        {hasServerFilter ? (
          <button
            type="button"
            onClick={() => {
              setEmailInput("");
              pushParams({
                user: "",
                product: "",
                status: "",
                from: "",
                to: "",
              });
            }}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
          title="Download the filtered ledger as CSV"
        >
          <Download className="h-4 w-4 text-brand-mute" />
          CSV
        </button>
      </div>

      <AdminLedgerList
        entries={rows}
        planLabels={planLabels}
        productLabels={productLabels}
        onAction={(action, txn) => openAction(action, txn.userEmail ?? "")}
      />
      <p className="mt-3 text-[11.5px] text-brand-mute">
        Showing {rows.length} of {entries.length} transactions · Balance shows
        what each user owes Wielo (or their credit) after that entry.
      </p>

      <WieloFinanceModals
        request={financeReq}
        users={users}
        products={payableProducts}
        onClose={() => setFinanceReq(null)}
      />
    </div>
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
