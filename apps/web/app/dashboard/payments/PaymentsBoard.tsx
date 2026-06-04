"use client";

import {
  CreditCard,
  Download,
  Home,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";

import { formatMoney } from "@/lib/format";

// ── Shared shapes (built server-side in page.tsx) ───────────────────
export type PaymentRow = {
  id: string;
  bookingId: string;
  bookingRef: string;
  guestName: string;
  guestAvatar: string | null;
  listingName: string;
  listingThumb: string | null;
  method: "paystack" | "paypal" | "eft" | string;
  status: string; // pending | authorised | completed | failed | refunded | partially_refunded | voided
  amount: number;
  currency: string;
  providerRef: string | null;
  createdAt: string;
  capturedAt: string | null;
};

export type PaymentKpis = {
  collected: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  methods: string[]; // distinct method labels present, e.g. ["Card", "EFT"]
};

// ── Date helpers ────────────────────────────────────────────────────
const DAY = 86_400_000;
function dts(s: string): number {
  const base = s.length <= 10 ? `${s}T12:00:00Z` : s;
  return new Date(base).getTime();
}
function fmtDt(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

// ── Method → label ──────────────────────────────────────────────────
function methodInfo(m: string): { label: string; mark: string; color: string } {
  switch (m) {
    case "paystack":
      return { label: "Card via Paystack", mark: "P", color: "#0EA5E9" };
    case "paypal":
      return { label: "PayPal", mark: "P", color: "#6366F1" };
    case "eft":
      return { label: "Manual EFT", mark: "E", color: "#064E3B" };
    default:
      return {
        label: m,
        mark: m.slice(0, 1).toUpperCase() || "·",
        color: "#94A3B8",
      };
  }
}

// ── Status → chip ───────────────────────────────────────────────────
const REFUNDED = new Set(["refunded", "partially_refunded"]);

type Chip = { label: string; cls: string; dot?: boolean; pulse?: boolean };
function chipOf(status: string): Chip {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        cls: "bg-status-completed/10 text-status-completed",
      };
    case "authorised":
      return {
        label: "Authorised",
        cls: "bg-emerald-100 text-emerald-800",
      };
    case "pending":
      return {
        label: "Pending",
        cls: "bg-status-pending/10 text-status-pending",
        dot: true,
        pulse: true,
      };
    case "failed":
      return {
        label: "Failed",
        cls: "bg-status-cancelled/10 text-status-cancelled",
      };
    case "refunded":
      return { label: "Refunded", cls: "bg-indigo-100 text-indigo-800" };
    case "partially_refunded":
      return {
        label: "Part refund",
        cls: "bg-indigo-100 text-indigo-800",
      };
    case "voided":
      return { label: "Voided", cls: "bg-slate-100 text-slate-700" };
    default:
      return {
        label: status.replace(/_/g, " "),
        cls: "bg-brand-light text-brand-mute",
      };
  }
}

function StatusChip({ status }: { status: string }) {
  const c = chipOf(status);
  return (
    <span
      className={`chip inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${c.cls}`}
    >
      {c.dot ? (
        <span
          className={`h-1.5 w-1.5 rounded-full bg-current ${c.pulse ? "pulse-soft" : ""}`}
        />
      ) : null}
      {c.label}
    </span>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────
type TabKey = "all" | "pending" | "completed" | "failed" | "refunded";
function matchesTab(r: PaymentRow, tab: TabKey): boolean {
  switch (tab) {
    case "all":
      return true;
    case "pending":
      return r.status === "pending";
    case "completed":
      return r.status === "completed";
    case "failed":
      return r.status === "failed";
    case "refunded":
      return REFUNDED.has(r.status);
  }
}

// ── Initials avatar fallback ────────────────────────────────────────
function Avatar({ name, src }: { name: string; src: string | null }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill ring-2 ring-white">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-brand-gradient text-[12px] font-bold text-white">
          {initials || "·"}
        </div>
      )}
    </div>
  );
}

// ── CSV export ──────────────────────────────────────────────────────
function exportCsv(rows: PaymentRow[]) {
  const head = [
    "Booking ref",
    "Guest",
    "Listing",
    "Method",
    "Status",
    "Amount",
    "Currency",
    "Provider ref",
    "Captured at",
    "Created at",
  ];
  const lines = rows.map((r) =>
    [
      r.bookingRef,
      r.guestName,
      r.listingName,
      methodInfo(r.method).label,
      r.status,
      Math.round(r.amount),
      r.currency,
      r.providerRef ?? "",
      r.capturedAt ?? "",
      r.createdAt,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[head.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vilo-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const GRID =
  "grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_40px] items-center gap-3";

// ── Main board ──────────────────────────────────────────────────────
export function PaymentsBoard({
  rows,
  kpis,
  currency,
}: {
  rows: PaymentRow[];
  kpis: PaymentKpis;
  currency: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");

  const today = useMemo(() => {
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
    }).format(new Date());
    return dts(todayStr);
  }, []);

  const tabCounts = useMemo(() => {
    const c: Record<TabKey, number> = {
      all: 0,
      pending: 0,
      completed: 0,
      failed: 0,
      refunded: 0,
    };
    for (const r of rows) {
      (Object.keys(c) as TabKey[]).forEach((k) => {
        if (matchesTab(r, k)) c[k] += 1;
      });
    }
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesTab(r, tab)),
    [rows, tab],
  );

  // Group filtered rows into Today / This week / Earlier by capturedAt ?? createdAt.
  const groups = useMemo(() => {
    const buckets: Record<string, PaymentRow[]> = {
      Today: [],
      "This week": [],
      Earlier: [],
    };
    for (const r of filtered) {
      const anchorStr = (r.capturedAt ?? r.createdAt).slice(0, 10);
      const anchor = dts(anchorStr);
      const diffDays = Math.round((anchor - today) / DAY);
      if (diffDays === 0) buckets.Today.push(r);
      else if (diffDays < 0 && diffDays >= -7) buckets["This week"].push(r);
      else buckets.Earlier.push(r);
    }
    const sortDesc = (a: PaymentRow, b: PaymentRow) =>
      dts(b.capturedAt ?? b.createdAt) - dts(a.capturedAt ?? a.createdAt);
    buckets.Today.sort(sortDesc);
    buckets["This week"].sort(sortDesc);
    buckets.Earlier.sort(sortDesc);
    return (["Today", "This week", "Earlier"] as const)
      .map((label) => ({ label, rows: buckets[label] }))
      .filter((g) => g.rows.length > 0);
  }, [filtered, today]);

  const TABS: { key: TabKey; label: string; tone?: string; pulse?: boolean }[] =
    [
      { key: "all", label: "All" },
      {
        key: "pending",
        label: "Pending",
        tone: "bg-status-pending",
        pulse: true,
      },
      { key: "completed", label: "Completed", tone: "bg-status-completed" },
      { key: "failed", label: "Failed", tone: "bg-status-cancelled" },
      { key: "refunded", label: "Refunded" },
    ];

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Payments
          </div>
          <h1 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight text-brand-ink md:text-[30px]">
            Money &amp; settlements
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            {rows.length} {rows.length === 1 ? "payment" : "payments"} · money
            settles directly to your provider account
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-accent/40"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </section>

      {/* ── KPI strip ── */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* Collected (dark) */}
        <div className="relative overflow-hidden rounded-card bg-brand-gradient-dark p-5 text-white shadow-card">
          <div aria-hidden className="dotgrid absolute inset-0 opacity-25" />
          <div
            aria-hidden
            className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-primary/30 blur-3xl"
          />
          <div className="relative">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-accent/80">
              Collected
            </span>
            <div className="num mt-2 font-display text-[30px] font-bold leading-none">
              {formatMoney(kpis.collected, currency)}
            </div>
            <div className="num mt-1 text-[11.5px] text-brand-accent/70">
              across {kpis.completedCount}{" "}
              {kpis.completedCount === 1
                ? "settled payment"
                : "settled payments"}
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Pending
          </span>
          <div className="num mt-2 font-display text-[30px] font-bold leading-none text-brand-ink">
            {kpis.pendingCount}
          </div>
          <div className="mt-1 text-[11.5px] text-brand-mute">
            awaiting settlement
          </div>
        </div>

        {/* Failed */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Failed
          </span>
          <div className="num mt-2 font-display text-[30px] font-bold leading-none text-brand-ink">
            {kpis.failedCount}
          </div>
          <div className="mt-1 text-[11.5px] text-brand-mute">
            charges that didn&apos;t go through
          </div>
        </div>

        {/* Methods */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Methods
          </span>
          <div className="num mt-2 font-display text-[22px] font-bold leading-none text-brand-ink">
            {kpis.methods.length > 0 ? kpis.methods.join(" · ") : "—"}
          </div>
          <div className="mt-1 text-[11.5px] text-brand-mute">
            ways guests have paid
          </div>
        </div>
      </section>

      {/* ── Table card ── */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {/* Status tabs */}
        <div className="border-b border-brand-line px-2 sm:px-4">
          <div
            className="hscroll flex items-center gap-1 overflow-x-auto"
            role="tablist"
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={`relative flex shrink-0 items-center gap-2 border-b-2 px-3 py-3.5 text-[13px] transition-colors ${
                    active
                      ? "border-brand-primary font-semibold text-brand-ink"
                      : "border-transparent font-medium text-brand-mute hover:text-brand-ink"
                  }`}
                >
                  {t.tone ? (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${t.tone} ${t.pulse ? "pulse-soft" : ""}`}
                    />
                  ) : null}
                  {t.label}
                  <span
                    className={`num rounded-pill px-1.5 py-0.5 text-[10px] font-bold ${
                      active
                        ? "bg-brand-accent text-brand-secondary"
                        : "bg-brand-light text-brand-mute"
                    }`}
                  >
                    {tabCounts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-line bg-brand-light/40 px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12px] font-medium text-brand-ink">
            <SlidersHorizontal className="h-3.5 w-3.5 text-brand-mute" />
            Any method
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11.5px] text-brand-mute">
              Showing {filtered.length}{" "}
              {filtered.length === 1 ? "result" : "results"}
            </span>
          </div>
        </div>

        {/* Table head */}
        <div
          className={`${GRID} border-b border-brand-line bg-white px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute`}
        >
          <div>Guest &amp; listing</div>
          <div>Method</div>
          <div>Provider ref</div>
          <div className="text-right">Amount</div>
          <div>Status</div>
          <div />
        </div>

        {/* Body */}
        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <CreditCard className="h-6 w-6" />
            </div>
            <h2 className="font-display text-lg font-bold text-brand-ink">
              {rows.length === 0 ? "No payments yet" : "No payments here"}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              {rows.length === 0
                ? "Once a guest pays, every charge appears here with its provider reference and status."
                : "Nothing matches this filter right now."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-brand-line">
            {groups.map((group) => (
              <Fragment key={group.label}>
                <li className="bg-brand-light/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                  {group.label}
                </li>
                {group.rows.map((r) => (
                  <PaymentRowItem
                    key={r.id}
                    row={r}
                    onOpen={() => router.push(`/dashboard/payments/${r.id}`)}
                  />
                ))}
              </Fragment>
            ))}
          </ul>
        )}

        {/* Footer summary */}
        <div className="flex items-center justify-between gap-3 border-t border-brand-line bg-white px-4 py-3 text-[12px]">
          <div className="text-brand-mute">
            Showing{" "}
            <span className="num font-semibold text-brand-ink">
              {filtered.length}
            </span>{" "}
            of{" "}
            <span className="num font-semibold text-brand-ink">
              {rows.length}
            </span>{" "}
            payments
          </div>
        </div>
      </section>
    </div>
  );
}

// ── One table row ───────────────────────────────────────────────────
function PaymentRowItem({
  row,
  onOpen,
}: {
  row: PaymentRow;
  onOpen: () => void;
}) {
  const method = methodInfo(row.method);
  const isNegative = REFUNDED.has(row.status) || row.status === "voided";
  const when = fmtDt(row.capturedAt ?? row.createdAt);

  return (
    <li
      onClick={onOpen}
      className={`bk-row ${GRID} cursor-pointer px-4 py-3.5 transition-colors hover:bg-brand-accent/30 ${isNegative ? "opacity-75" : ""}`}
    >
      {/* Guest + listing */}
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={row.guestName} src={row.guestAvatar} />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-brand-ink">
            {row.guestName}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-brand-mute">
            {row.listingThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.listingThumb}
                alt=""
                className="h-4 w-4 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-brand-accent text-brand-secondary">
                <Home className="h-2.5 w-2.5" />
              </span>
            )}
            <span className="truncate">{row.listingName}</span>
            <span className="text-brand-line">·</span>
            <span className="font-mono text-[10px]">{row.bookingRef}</span>
          </div>
        </div>
      </div>

      {/* Method */}
      <div>
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[8px] font-extrabold text-white"
            style={{ background: method.color }}
          >
            {method.mark}
          </span>
          <span className="truncate font-semibold text-brand-ink">
            {method.label}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-brand-mute">{when}</div>
      </div>

      {/* Provider ref */}
      <div className="min-w-0">
        <span className="block truncate font-mono text-[11px] text-brand-mute">
          {row.providerRef ?? "—"}
        </span>
      </div>

      {/* Amount */}
      <div className="text-right">
        <div
          className={`num font-display text-[14px] font-bold ${isNegative ? "text-brand-mute line-through" : "text-brand-ink"}`}
        >
          {formatMoney(row.amount, row.currency)}
        </div>
      </div>

      {/* Status */}
      <div>
        <StatusChip status={row.status} />
      </div>

      {/* Action */}
      <div className="text-right">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded text-brand-mute"
          aria-hidden
        >
          <MoreHorizontal className="h-4 w-4" />
        </span>
      </div>
    </li>
  );
}
