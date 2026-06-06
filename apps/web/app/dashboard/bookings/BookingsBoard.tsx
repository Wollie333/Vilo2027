"use client";

import {
  ArrowDownAZ,
  ArrowRight,
  ArrowUpDown,
  Banknote,
  BadgeCheck,
  Calendar,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  GitBranch,
  Home as HomeIcon,
  Layers,
  Mail,
  Menu,
  MoreHorizontal,
  Phone,
  Plus,
  Rows3,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatMoney } from "@/lib/format";

// ── Shapes (built server-side in page.tsx) ──────────────────────────────
export type BookingRow = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  origin: string;
  channel: string | null;
  scope: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestAvatar: string | null;
  stayIndex: number;
  listingName: string;
  listingThumb: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  guestsCount: number;
  adults: number;
  children: number;
  infants: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
};

export type Kpis = {
  monthLabel: string;
  currency: string;
  revenue: {
    total: number;
    prevTotal: number;
    deltaPct: number | null;
    spark: number[];
  };
  bookings: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    delta: number;
    bars: number[];
  };
  occupancy: {
    pct: number;
    bookedNights: number;
    totalNights: number;
    deltaPp: number | null;
  };
  adr: {
    value: number;
    avgNights: number;
    leadDays: number;
    perListing: { name: string; adr: number }[];
  };
};

// ── Date helpers ────────────────────────────────────────────────────────
const DAY = 86_400_000;
function dts(s: string): number {
  return new Date(s.length <= 10 ? `${s}T12:00:00Z` : s).getTime();
}
function fmtDay(s: string): string {
  return new Date(dts(s)).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  });
}

// ── Channel ──────────────────────────────────────────────────────────────
function channelMeta(
  channel: string | null,
  origin: string,
): { mark: string; color: string; name: string } {
  switch (channel) {
    case "airbnb":
      return { mark: "A", color: "#FF5A5F", name: "Airbnb" };
    case "booking":
      return { mark: "B", color: "#003580", name: "Booking.com" };
    case "expedia":
      return { mark: "E", color: "#00355F", name: "Expedia" };
    case "other":
      return { mark: "O", color: "#6366F1", name: "Other" };
    default:
      if (origin === "host_manual")
        return { mark: "M", color: "#064E3B", name: "Manual" };
      if (origin === "quote_converted")
        return { mark: "Q", color: "#6366F1", name: "From quote" };
      return { mark: "V", color: "#10B981", name: "Direct" };
  }
}

// ── Status ───────────────────────────────────────────────────────────────
const CANCELLED = new Set([
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
]);
const PENDING = new Set(["pending", "pending_eft", "pending_eft_review"]);

type ToneKey = "green" | "sky" | "amber" | "indigo" | "red" | "gray";
const TONE: Record<ToneKey, { cls: string; dot: string; bar: string }> = {
  green: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-status-confirmed",
    bar: "#10B981",
  },
  sky: {
    cls: "bg-sky-50 text-sky-600 border-sky-200",
    dot: "bg-status-inhouse",
    bar: "#0EA5E9",
  },
  amber: {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-status-pending",
    bar: "#F59E0B",
  },
  indigo: {
    cls: "bg-indigo-50 text-indigo-600 border-indigo-200",
    dot: "bg-status-completed",
    bar: "#6366F1",
  },
  red: {
    cls: "bg-red-50 text-red-600 border-red-200",
    dot: "bg-status-cancelled",
    bar: "#EF4444",
  },
  gray: {
    cls: "bg-slate-50 text-slate-500 border-slate-200",
    dot: "bg-status-draft",
    bar: "#94A3B8",
  },
};

function tagOf(status: string): { label: string; tone: ToneKey } {
  switch (status) {
    case "checked_in":
      return { label: "In-house", tone: "sky" };
    case "confirmed":
      return { label: "Confirmed", tone: "green" };
    case "completed":
    case "checked_out":
      return { label: "Completed", tone: "indigo" };
    case "pending":
      return { label: "Pending", tone: "amber" };
    case "pending_eft":
      return { label: "Awaiting EFT", tone: "amber" };
    case "pending_eft_review":
      return { label: "EFT review", tone: "amber" };
    case "cancelled_by_guest":
      return { label: "Guest cancelled", tone: "red" };
    case "declined":
      return { label: "Declined", tone: "red" };
    case "expired":
      return { label: "Expired", tone: "red" };
    case "no_show":
      return { label: "No-show", tone: "red" };
    default:
      if (CANCELLED.has(status)) return { label: "Cancelled", tone: "red" };
      return { label: status.replace(/_/g, " "), tone: "gray" };
  }
}

// ── Tabs ─────────────────────────────────────────────────────────────────
type TabKey =
  | "all"
  | "upcoming"
  | "inhouse"
  | "checkingout"
  | "pending"
  | "completed"
  | "cancelled";

function matchesTab(r: BookingRow, tab: TabKey, today: number): boolean {
  switch (tab) {
    case "all":
      return true;
    case "inhouse":
      return r.status === "checked_in";
    case "checkingout":
      return (
        r.status === "checked_in" && !!r.checkOut && dts(r.checkOut) === today
      );
    case "pending":
      return PENDING.has(r.status);
    case "completed":
      return r.status === "completed" || r.status === "checked_out";
    case "cancelled":
      return CANCELLED.has(r.status);
    case "upcoming": {
      if (
        CANCELLED.has(r.status) ||
        r.status === "completed" ||
        r.status === "checked_in"
      )
        return false;
      const end = r.checkOut ?? r.checkIn;
      return end ? dts(end) >= today : true;
    }
  }
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "inhouse", label: "In-house" },
  { key: "checkingout", label: "Checking out" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const SORTS = [
  { key: "group", label: "Date grouped", icon: Layers },
  { key: "soon", label: "Soonest check-in", icon: CalendarClock },
  { key: "amount", label: "Amount: high → low", icon: Banknote },
  { key: "name", label: "Guest: A → Z", icon: ArrowDownAZ },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

function bucketOf(r: BookingRow, today: number): string {
  const inHouse =
    r.checkIn &&
    r.checkOut &&
    dts(r.checkIn) <= today &&
    dts(r.checkOut) > today;
  const anchor = dts(r.checkIn ?? r.createdAt.slice(0, 10));
  const diff = Math.round((anchor - today) / DAY);
  if (r.status === "checked_in" || inHouse || diff === 0) return "Today";
  if (diff > 0 && diff <= 7) return "This week";
  if (diff > 7) return "Later";
  return "Earlier";
}
const BUCKET_RANK: Record<string, number> = {
  Today: 0,
  "This week": 1,
  Later: 2,
  Earlier: 3,
};

const PAGE_SIZE = 20;

const GRID =
  "grid grid-cols-[34px_minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_40px] items-center gap-3.5";

function payHintOf(r: BookingRow): string {
  switch (r.paymentStatus) {
    case "paid":
    case "captured":
    case "completed":
      return "paid in full";
    case "deposit_paid":
      return "deposit only";
    case "refunded":
      return "refunded";
    case "partially_refunded":
      return "part refunded";
    default:
      return r.paymentStatus.replace(/_/g, " ");
  }
}

function csvExport(rows: BookingRow[]) {
  const head = [
    "Reference",
    "Guest",
    "Listing",
    "Check-in",
    "Check-out",
    "Nights",
    "Guests",
    "Status",
    "Amount",
    "Currency",
  ];
  const lines = rows.map((r) =>
    [
      r.reference,
      r.guestName,
      r.listingName,
      r.checkIn ?? "",
      r.checkOut ?? "",
      r.nights ?? "",
      r.guestsCount,
      r.status,
      Math.round(r.totalAmount),
      r.currency,
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
  a.download = `vilo-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "·"
  );
}

// ── Main board ──────────────────────────────────────────────────────────
export function BookingsBoard({
  rows,
  kpis,
  todayStr,
  listingCount,
}: {
  rows: BookingRow[];
  kpis: Kpis;
  todayStr: string;
  listingCount: number;
}) {
  const today = dts(todayStr);
  const [tab, setTab] = useState<TabKey>("all");
  const [sort, setSort] = useState<SortKey>("group");
  const [sortOpen, setSortOpen] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const compact = density === "compact";

  useEffect(() => setPage(1), [tab, sort]);

  const tabCounts = useMemo(() => {
    const c = {} as Record<TabKey, number>;
    for (const t of TABS) c[t.key] = 0;
    for (const r of rows)
      for (const t of TABS) if (matchesTab(r, t.key, today)) c[t.key] += 1;
    return c;
  }, [rows, today]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesTab(r, tab, today)),
    [rows, tab, today],
  );

  // Sort (group mode orders by date bucket then check-in).
  const sorted = useMemo(() => {
    const arr = filtered.slice();
    if (sort === "amount") arr.sort((a, b) => b.totalAmount - a.totalAmount);
    else if (sort === "name")
      arr.sort((a, b) => a.guestName.localeCompare(b.guestName));
    else if (sort === "soon")
      arr.sort(
        (a, b) => dts(a.checkIn ?? a.createdAt) - dts(b.checkIn ?? b.createdAt),
      );
    else
      arr.sort((a, b) => {
        const ra = BUCKET_RANK[bucketOf(a, today)] ?? 9;
        const rb = BUCKET_RANK[bucketOf(b, today)] ?? 9;
        if (ra !== rb) return ra - rb;
        const da = dts(a.checkIn ?? a.createdAt);
        const db = dts(b.checkIn ?? b.createdAt);
        return ra === 3 ? db - da : da - db;
      });
    return arr;
  }, [filtered, sort, today]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const selectedRows = filtered.filter((r) => selected.has(r.id));
  const allVisibleSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(
      allVisibleSelected ? new Set() : new Set(pageRows.map((r) => r.id)),
    );

  // KPI extras.
  const upcoming = useMemo(() => {
    let count = 0;
    let nights = 0;
    for (const r of rows) {
      if (matchesTab(r, "upcoming", today)) {
        count += 1;
        nights += r.nights ?? 0;
      }
    }
    return { count, nights };
  }, [rows, today]);

  const attention = tabCounts.pending + tabCounts.checkingout;
  const drawerRow = openId ? (rows.find((r) => r.id === openId) ?? null) : null;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 lg:px-6">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-brand-ink">
            Bookings
          </h1>
          <p className="mt-1 text-[13.5px] text-brand-mute">
            <span className="font-semibold text-brand-ink">{rows.length}</span>{" "}
            reservations
            {attention > 0 ? (
              <>
                {" "}
                ·{" "}
                <span className="font-semibold text-status-pending">
                  {attention}
                </span>{" "}
                need your attention
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => csvExport(filtered)}
            className="hidden h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light sm:inline-flex"
          >
            <Download className="h-4 w-4 text-brand-mute" /> Export
          </button>
          <Link
            href="/dashboard/bookings/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-5 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" /> New booking
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label={`Booked revenue · ${kpis.monthLabel}`}
          value={formatMoney(kpis.revenue.total, kpis.currency)}
          delta={kpis.revenue.deltaPct}
          deltaSuffix="%"
        />
        <KpiCard
          label="Upcoming stays"
          value={String(upcoming.count)}
          chip={`${upcoming.nights} nights`}
        />
        <KpiCard
          label="Occupancy · 30d"
          value={`${kpis.occupancy.pct}%`}
          delta={kpis.occupancy.deltaPp}
          deltaSuffix="pp"
        />
        <KpiCard
          label="Avg nightly rate"
          value={formatMoney(kpis.adr.value, kpis.currency)}
          chip={`avg ${kpis.adr.avgNights}n stay`}
        />
      </section>

      {/* table card */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {/* tabs */}
        <div
          className="flex items-stretch gap-1 overflow-x-auto border-b border-brand-line px-4"
          style={{ scrollbarWidth: "none" }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13px] font-semibold transition-colors ${
                  active
                    ? "text-brand-secondary"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {t.label}
                <span
                  className={`rounded-pill border px-1.5 py-px text-[10.5px] tabular-nums ${
                    active
                      ? "border-brand-accent bg-brand-accent text-brand-secondary"
                      : "border-brand-line bg-brand-light text-brand-mute"
                  }`}
                >
                  {tabCounts[t.key]}
                </span>
                {active ? (
                  <span className="absolute inset-x-2 -bottom-px h-[2.5px] rounded bg-brand-primary" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* filter row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-line bg-[#FBFDFC] px-4 py-2.5">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-brand-primary bg-brand-light px-3 text-[12.5px] font-medium text-brand-secondary">
            <HomeIcon className="h-3.5 w-3.5" /> All{" "}
            {listingCount > 0 ? listingCount : ""} listings
          </span>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-mute">
            <GitBranch className="h-3.5 w-3.5" /> All channels
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex items-center rounded-[9px] border border-brand-line bg-white p-0.5">
              <button
                onClick={() => setDensity("comfortable")}
                title="Comfortable"
                className={`flex h-7 items-center rounded-[7px] px-2.5 ${
                  !compact
                    ? "bg-brand-secondary text-white"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                <Rows3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDensity("compact")}
                title="Compact"
                className={`flex h-7 items-center rounded-[7px] px-2.5 ${
                  compact
                    ? "bg-brand-secondary text-white"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="relative">
              <button
                onClick={() => setSortOpen((v) => !v)}
                onBlur={() => setTimeout(() => setSortOpen(false), 150)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-brand-mute" />
                {SORTS.find((s) => s.key === sort)?.label}
              </button>
              {sortOpen ? (
                <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[208px] rounded-xl border border-brand-line bg-white p-1.5 shadow-lift">
                  {SORTS.map((s) => {
                    const Icon = s.icon;
                    const on = sort === s.key;
                    return (
                      <button
                        key={s.key}
                        onMouseDown={() => setSort(s.key)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] ${
                          on
                            ? "font-bold text-brand-secondary"
                            : "font-medium text-brand-ink hover:bg-brand-light"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-brand-mute" />
                        {s.label}
                        {on ? (
                          <Check className="ml-auto h-4 w-4 text-brand-primary" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* column header / bulk bar */}
        <div className="border-b border-brand-line">
          {selected.size > 0 ? (
            <div className="flex items-center gap-2.5 bg-emerald-50 px-4 py-2.5">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-[13px] font-semibold text-brand-secondary">
                {selected.size} selected
              </span>
              <span className="mx-1 h-4 w-px bg-brand-primary/30" />
              <button
                onClick={() => csvExport(selectedRows)}
                className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-light"
              >
                <Download className="h-3.5 w-3.5 text-brand-primary" /> Export
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="ml-auto text-[12.5px] font-medium text-brand-mute hover:text-brand-ink"
              >
                Clear
              </button>
            </div>
          ) : (
            <div
              className={`${GRID} px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]`}
            >
              <div>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                />
              </div>
              <div>Guest &amp; listing</div>
              <div>Stay dates</div>
              <div>Channel</div>
              <div>Guests</div>
              <div className="text-right">Amount</div>
              <div>Status</div>
              <div />
            </div>
          )}
        </div>

        {/* rows */}
        {pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand-mute">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="mt-3 text-[15px] font-semibold text-brand-ink">
              No bookings here
            </div>
            <div className="mt-1 max-w-sm text-[13px] text-brand-mute">
              {tab === "all"
                ? "Once a guest reserves, the booking shows up here."
                : "Nothing matches this filter right now."}
            </div>
          </div>
        ) : (
          <div>
            {pageRows.map((r, i) => {
              const showHeader =
                sort === "group" &&
                (i === 0 ||
                  bucketOf(r, today) !== bucketOf(pageRows[i - 1], today));
              return (
                <div key={r.id}>
                  {showHeader ? (
                    <div className="bg-[#F7FAF8] px-[18px] py-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7A988C]">
                      {bucketOf(r, today)}
                    </div>
                  ) : null}
                  <BookingRowItem
                    row={r}
                    today={today}
                    compact={compact}
                    active={openId === r.id}
                    checked={selected.has(r.id)}
                    onToggle={() => toggle(r.id)}
                    onOpen={() => setOpenId(r.id)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* footer */}
        <div className="flex items-center justify-between border-t border-brand-line px-4 py-3">
          <div className="text-[12px] tabular-nums text-brand-mute">
            {sorted.length === 0
              ? "0 bookings"
              : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, sorted.length)} of ${sorted.length} bookings`}
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center gap-1">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-mute hover:bg-brand-light disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-[12px] font-semibold tabular-nums text-brand-ink">
                {safePage} / {totalPages}
              </span>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-mute hover:bg-brand-light disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* detail drawer */}
      <BookingDrawer row={drawerRow} onClose={() => setOpenId(null)} />
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  delta,
  deltaSuffix,
  chip,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaSuffix?: string;
  chip?: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          {label}
        </span>
        {delta != null && delta !== 0 ? (
          <span
            className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10.5px] font-semibold ${
              delta >= 0
                ? "bg-brand-light text-status-confirmed"
                : "bg-amber-50 text-status-pending"
            }`}
          >
            {delta >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {delta >= 0 ? "+" : ""}
            {delta}
            {deltaSuffix}
          </span>
        ) : chip ? (
          <span className="rounded-pill bg-brand-light px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-mute">
            {chip}
          </span>
        ) : null}
      </div>
      <div className="mt-2 font-display text-[26px] font-bold leading-none text-brand-ink">
        {value}
      </div>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────
function guestsCell(r: BookingRow): { main: string; sub: string } {
  const main =
    r.adults > 0
      ? `${r.adults} adult${r.adults === 1 ? "" : "s"}`
      : `${r.guestsCount} guest${r.guestsCount === 1 ? "" : "s"}`;
  const extras: string[] = [];
  if (r.children > 0)
    extras.push(`+${r.children} child${r.children === 1 ? "" : "ren"}`);
  if (r.infants > 0)
    extras.push(`+${r.infants} infant${r.infants === 1 ? "" : "s"}`);
  return { main, sub: extras.join(" · ") };
}

function datesCell(
  r: BookingRow,
  today: number,
): { main: React.ReactNode; sub: string } {
  if (!r.checkIn || !r.checkOut) return { main: "—", sub: "" };
  const ci = dts(r.checkIn);
  const co = dts(r.checkOut);
  const arriving = ci === today;
  const leaving = co === today;
  const n = r.nights ?? Math.max(1, Math.round((co - ci) / DAY));
  const inHouse = r.status === "checked_in";
  let sub = `${n} night${n === 1 ? "" : "s"}`;
  if (leaving) sub += " · checking out today";
  else if (arriving) sub += " · arriving today";
  else if (inHouse)
    sub += ` · ${Math.max(0, Math.round((co - today) / DAY))} more to go`;
  else if (ci > today)
    sub += ` · arrives in ${Math.round((ci - today) / DAY)}d`;
  const main = (
    <>
      <span className={arriving ? "text-brand-primary" : ""}>
        {fmtDay(r.checkIn)}
      </span>{" "}
      →{" "}
      <span className={leaving ? "text-sky-600" : ""}>
        {fmtDay(r.checkOut)}
      </span>
    </>
  );
  return { main, sub };
}

function BookingRowItem({
  row,
  today,
  compact,
  active,
  checked,
  onToggle,
  onOpen,
}: {
  row: BookingRow;
  today: number;
  compact: boolean;
  active: boolean;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const ch = channelMeta(row.channel, row.origin);
  const tag = tagOf(row.status);
  const tone = TONE[tag.tone];
  const isCancelled = CANCELLED.has(row.status);
  const inHouse = row.status === "checked_in";
  const dc = datesCell(row, today);
  const gc = guestsCell(row);
  const av = compact ? "h-8 w-8" : "h-10 w-10";

  return (
    <div
      onClick={onOpen}
      className={`group relative ${GRID} cursor-pointer border-b border-[#F1F6F2] px-4 transition-colors hover:bg-[#F8FCF9] ${
        compact ? "py-2.5" : "py-3.5"
      } ${isCancelled ? "opacity-60" : ""} ${active ? "bg-[#F4FBF6]" : ""}`}
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px] transition-opacity group-hover:opacity-100"
        style={{
          background: tone.bar,
          opacity: active ? 1 : 0,
        }}
      />

      {/* select */}
      <div>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
        />
      </div>

      {/* guest + listing */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          {row.guestAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.guestAvatar}
              alt=""
              className={`${av} rounded-pill object-cover ring-2 ring-white`}
            />
          ) : (
            <div
              className={`${av} flex items-center justify-center rounded-pill bg-brand-secondary font-display text-[12px] font-bold text-white`}
            >
              {initials(row.guestName)}
            </div>
          )}
          {inHouse ? (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-status-inhouse" />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`truncate text-[14px] font-semibold text-brand-ink ${isCancelled ? "line-through decoration-brand-mute/40" : ""}`}
            >
              {row.guestName}
            </span>
            {row.stayIndex >= 3 ? (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-status-confirmed" />
            ) : null}
            <span
              className={`shrink-0 rounded-pill px-1.5 py-px text-[10px] font-semibold ${row.stayIndex >= 3 ? "bg-brand-accent text-brand-secondary" : "bg-brand-light text-brand-mute"}`}
            >
              {row.stayIndex === 1
                ? "1st stay"
                : row.stayIndex === 2
                  ? "2nd stay"
                  : row.stayIndex === 3
                    ? "3rd stay"
                    : `${row.stayIndex}th stay`}
            </span>
          </div>
          {!compact ? (
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-brand-mute">
              <span className="truncate">{row.listingName}</span>
              <span className="text-brand-line">·</span>
              <span className="font-mono text-[10px]">{row.reference}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* dates */}
      <div>
        <div className="text-[12.5px] font-semibold tabular-nums text-brand-ink">
          {dc.main}
        </div>
        {!compact && dc.sub ? (
          <div className="mt-0.5 text-[11px] text-brand-mute">{dc.sub}</div>
        ) : null}
      </div>

      {/* channel */}
      <div>
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <span
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] font-display text-[9px] font-extrabold text-white"
            style={{ background: ch.color }}
          >
            {ch.mark}
          </span>
          <span className="font-semibold text-brand-ink">{ch.name}</span>
        </div>
        {!compact ? (
          <div className="mt-0.5 text-[11px] text-brand-mute">
            Booked {fmtDay(row.createdAt.slice(0, 10))}
          </div>
        ) : null}
      </div>

      {/* guests */}
      <div className="text-[12.5px]">
        <div className="font-semibold tabular-nums text-brand-ink">
          {gc.main}
        </div>
        {!compact && gc.sub ? (
          <div className="mt-0.5 text-[11px] text-brand-mute">{gc.sub}</div>
        ) : null}
      </div>

      {/* amount */}
      <div className="text-right">
        <div className="font-display text-[14px] font-bold tabular-nums text-brand-ink">
          {formatMoney(row.totalAmount, row.currency)}
        </div>
        {!compact ? (
          <div className="mt-0.5 text-[10.5px] text-brand-mute">
            {payHintOf(row)}
          </div>
        ) : null}
      </div>

      {/* status */}
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11.5px] font-semibold ${tone.cls}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {tag.label}
        </span>
      </div>

      {/* quick actions */}
      <div className="flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
        <Link
          href={`/dashboard/bookings/${row.id}`}
          onClick={(e) => e.stopPropagation()}
          title="Open booking"
          className="flex h-8 w-8 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          <MoreHorizontal className="h-[16px] w-[16px]" />
        </Link>
      </div>
    </div>
  );
}

// ── Detail drawer ──────────────────────────────────────────────────────────
function BookingDrawer({
  row,
  onClose,
}: {
  row: BookingRow | null;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = !!row;
  const ch = row ? channelMeta(row.channel, row.origin) : null;
  const tag = row ? tagOf(row.status) : null;
  const tone = tag ? TONE[tag.tone] : null;
  const gc = row ? guestsCell(row) : null;
  const nights =
    row && row.checkIn && row.checkOut
      ? (row.nights ??
        Math.max(1, Math.round((dts(row.checkOut) - dts(row.checkIn)) / DAY)))
      : null;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-brand-dark/30 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-[94vw] flex-col bg-white shadow-lift transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {row && ch && tag && tone ? (
          <>
            <div className="flex h-14 shrink-0 items-center border-b border-brand-line px-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
                  Vilo booking
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-brand-ink">
                  {row.reference}
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light hover:text-brand-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="thin-scroll flex-1 overflow-y-auto">
              {/* guest */}
              <div className="flex items-center gap-3 border-b border-brand-line px-5 py-4">
                {row.guestAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.guestAvatar}
                    alt=""
                    className="h-12 w-12 rounded-pill object-cover ring-2 ring-white"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-brand-secondary font-display text-sm font-bold text-white">
                    {initials(row.guestName)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-brand-ink">
                    {row.guestName}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-brand-mute">
                    {row.guestEmail ?? "No email on file"}
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11.5px] font-semibold ${tone.cls}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {tag.label}
                </span>
              </div>

              {/* quick actions */}
              <div className="grid grid-cols-3 gap-2 border-b border-brand-line px-5 py-4">
                <DrawerAction
                  icon={Mail}
                  label="Message"
                  href={row.guestEmail ? `mailto:${row.guestEmail}` : undefined}
                />
                <DrawerAction
                  icon={Phone}
                  label="Call"
                  href={row.guestPhone ? `tel:${row.guestPhone}` : undefined}
                />
                <DrawerAction
                  icon={FileText}
                  label="Invoice"
                  href={`/dashboard/bookings/${row.id}?tab=payments`}
                />
              </div>

              {/* stay */}
              <div className="border-b border-brand-line px-5 py-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
                  Stay
                </div>
                <div className="flex items-center gap-3">
                  {row.listingThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.listingThumb}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-[10px] object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-[10px] bg-brand-light" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-brand-ink">
                      {row.listingName}
                    </div>
                    <div className="text-[11.5px] text-brand-mute">
                      {gc?.main}
                      {gc?.sub ? ` · ${gc.sub}` : ""}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[9px] bg-brand-light py-2">
                    <div className="font-display text-[14px] font-bold text-brand-ink">
                      {row.checkIn ? fmtDay(row.checkIn) : "—"}
                    </div>
                    <div className="text-[10px] text-brand-mute">check-in</div>
                  </div>
                  <div className="rounded-[9px] bg-brand-light py-2">
                    <div className="font-display text-[14px] font-bold text-brand-ink">
                      {nights ?? "—"}
                    </div>
                    <div className="text-[10px] text-brand-mute">nights</div>
                  </div>
                  <div className="rounded-[9px] bg-brand-accent py-2">
                    <div className="font-display text-[14px] font-bold text-brand-secondary">
                      {row.checkOut ? fmtDay(row.checkOut) : "—"}
                    </div>
                    <div className="text-[10px] text-brand-secondary/80">
                      check-out
                    </div>
                  </div>
                </div>
              </div>

              {/* payment */}
              <div className="px-5 py-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
                  Payment
                </div>
                <dl className="text-[13.5px]">
                  <DrawerRow
                    label="Channel"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] font-display text-[9px] font-extrabold text-white"
                          style={{ background: ch.color }}
                        >
                          {ch.mark}
                        </span>
                        {ch.name}
                      </span>
                    }
                  />
                  <DrawerRow
                    label="Booked"
                    value={fmtDay(row.createdAt.slice(0, 10))}
                  />
                  <DrawerRow
                    label="Total"
                    value={
                      <span className="font-display">
                        {formatMoney(row.totalAmount, row.currency)}
                      </span>
                    }
                  />
                </dl>
                <div
                  className={`mt-3 flex items-center gap-2 rounded-[9px] px-3 py-2 text-[11.5px] ${
                    tag.tone === "red"
                      ? "bg-red-50 text-status-cancelled"
                      : "bg-brand-light text-brand-secondary"
                  }`}
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span className="capitalize">{payHintOf(row)}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-brand-line bg-white px-5 py-3">
              <Link
                href={`/dashboard/bookings/${row.id}`}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-pill border border-brand-line bg-white text-[13px] font-semibold text-brand-ink hover:bg-brand-light"
              >
                Full record
              </Link>
              <a
                href={
                  row.guestEmail
                    ? `mailto:${row.guestEmail}`
                    : "/dashboard/inbox"
                }
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-pill bg-brand-primary text-[13px] font-semibold text-white hover:bg-brand-secondary"
              >
                Message guest <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}

function DrawerAction({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Mail;
  label: string;
  href?: string;
}) {
  const cls =
    "flex flex-col items-center gap-1 rounded-[10px] border border-brand-line bg-white py-2.5 text-[11px] font-medium text-brand-ink hover:bg-brand-light";
  const inner = (
    <>
      <Icon className="h-4 w-4 text-brand-primary" /> {label}
    </>
  );
  if (!href)
    return (
      <span className={`${cls} cursor-not-allowed opacity-50`}>{inner}</span>
    );
  return (
    <a href={href} className={cls}>
      {inner}
    </a>
  );
}

function DrawerRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#F1F6F2] py-2 last:border-0">
      <dt className="text-brand-mute">{label}</dt>
      <dd className="text-right font-semibold text-brand-ink">{value}</dd>
    </div>
  );
}
