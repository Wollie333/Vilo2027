"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Download,
  Home,
  MoreHorizontal,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";

// ── Shared shapes (built server-side in page.tsx) ───────────────────
export type BookingRow = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  origin: string;
  scope: string;
  guestName: string;
  guestEmail: string | null;
  guestAvatar: string | null;
  stayIndex: number; // 1-based: how many stays this guest has had
  listingName: string;
  listingThumb: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  guestsCount: number;
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

// ── Date helpers ────────────────────────────────────────────────────
const DAY = 86_400_000;
function dts(s: string): number {
  // Treat plain dates / timestamps as midday UTC to dodge TZ edges.
  const base = s.length <= 10 ? `${s}T12:00:00Z` : s;
  return new Date(base).getTime();
}
function fmtDay(s: string): string {
  return new Date(dts(s)).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  });
}
function fmtR(n: number, currency: string): string {
  const body = Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
  return `${currency === "ZAR" ? "R " : ""}${body}`;
}

// ── Channel (Vilo is direct-booking — map origin, not OTA channels) ──
function channelOf(origin: string): {
  label: string;
  mark: string;
  color: string;
} {
  switch (origin) {
    case "host_manual":
      return { label: "Manual", mark: "M", color: "#064E3B" };
    case "quote_converted":
      return { label: "From quote", mark: "Q", color: "#6366F1" };
    default:
      return { label: "Direct", mark: "V", color: "#10B981" };
  }
}

// ── Status → chip ───────────────────────────────────────────────────
const CANCELLED = new Set([
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
]);
const PENDING = new Set(["pending", "pending_eft", "pending_eft_review"]);

type Chip = {
  label: string;
  cls: string;
  dot?: boolean;
  pulse?: boolean;
  icon?: "check" | "x" | "clock";
};
function chipOf(status: string): Chip {
  switch (status) {
    case "checked_in":
      return {
        label: "In-house",
        cls: "bg-status-inhouse/10 text-status-inhouse",
        dot: true,
        pulse: true,
      };
    case "confirmed":
      return {
        label: "Confirmed",
        cls: "bg-status-confirmed/10 text-status-confirmed",
        icon: "check",
      };
    case "completed":
      return {
        label: "Completed",
        cls: "bg-status-completed/10 text-status-completed",
        icon: "check",
      };
    case "pending":
      return {
        label: "Pending",
        cls: "bg-status-pending/10 text-status-pending",
        dot: true,
        pulse: true,
      };
    case "pending_eft":
      return {
        label: "Awaiting EFT",
        cls: "bg-status-pending/10 text-status-pending",
        dot: true,
      };
    case "pending_eft_review":
      return {
        label: "EFT review",
        cls: "bg-status-pending/10 text-status-pending",
        dot: true,
      };
    case "no_show":
      return {
        label: "No show",
        cls: "bg-brand-light text-brand-mute",
        icon: "x",
      };
    default:
      if (CANCELLED.has(status))
        return {
          label: "Cancelled",
          cls: "bg-status-cancelled/10 text-status-cancelled",
          icon: "x",
        };
      return { label: status, cls: "bg-brand-light text-brand-mute" };
  }
}

// ── Tabs ────────────────────────────────────────────────────────────
type TabKey =
  | "all"
  | "upcoming"
  | "inhouse"
  | "pending"
  | "completed"
  | "cancelled";
function matchesTab(r: BookingRow, tab: TabKey, today: number): boolean {
  switch (tab) {
    case "all":
      return true;
    case "inhouse":
      return r.status === "checked_in";
    case "pending":
      return PENDING.has(r.status);
    case "completed":
      return r.status === "completed";
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

// ── Sparkline path generator ────────────────────────────────────────
function sparkPaths(
  values: number[],
  w = 200,
  h = 40,
): { line: string; area: string } {
  if (values.length === 0) return { line: "", area: "" };
  const max = Math.max(...values, 1);
  const n = values.length;
  const step = n > 1 ? w / (n - 1) : 0;
  const pts = values.map((v, i) => {
    const x = n > 1 ? i * step : w / 2;
    const y = h - 4 - (v / max) * (h - 8);
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area };
}

// ── CSV export ──────────────────────────────────────────────────────
function exportCsv(rows: BookingRow[]) {
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

// ── Small presentational bits ───────────────────────────────────────
function ChipIcon({ kind }: { kind?: "check" | "x" | "clock" }) {
  if (kind === "check")
    return <Check className="h-2.5 w-2.5" strokeWidth={3} />;
  if (kind === "x") return <X className="h-2.5 w-2.5" strokeWidth={2.5} />;
  if (kind === "clock") return <Clock className="h-2.5 w-2.5" />;
  return null;
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
      ) : (
        <ChipIcon kind={c.icon} />
      )}
      {c.label}
    </span>
  );
}

// Initials avatar fallback
function Avatar({
  name,
  src,
  ring,
}: {
  name: string;
  src: string | null;
  ring?: string;
}) {
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
      {ring ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
          style={{ background: ring }}
        />
      ) : null}
    </div>
  );
}

const GRID =
  "grid grid-cols-[36px_minmax(0,2.3fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_40px] items-center gap-3";

// ── Main board ──────────────────────────────────────────────────────
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
  const router = useRouter();
  const today = dts(todayStr);
  const [tab, setTab] = useState<TabKey>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const tabCounts = useMemo(() => {
    const c: Record<TabKey, number> = {
      all: 0,
      upcoming: 0,
      inhouse: 0,
      pending: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const r of rows) {
      (Object.keys(c) as TabKey[]).forEach((k) => {
        if (matchesTab(r, k, today)) c[k] += 1;
      });
    }
    return c;
  }, [rows, today]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesTab(r, tab, today)),
    [rows, tab, today],
  );

  // Group filtered rows into Today / This week / Later / Earlier.
  const groups = useMemo(() => {
    const buckets: Record<string, BookingRow[]> = {
      Today: [],
      "This week": [],
      Later: [],
      Earlier: [],
    };
    for (const r of filtered) {
      const anchorStr = r.checkIn ?? r.createdAt.slice(0, 10);
      const anchor = dts(anchorStr);
      const inHouseNow =
        r.checkIn &&
        r.checkOut &&
        dts(r.checkIn) <= today &&
        dts(r.checkOut) > today;
      const diffDays = Math.round((anchor - today) / DAY);
      if (r.status === "checked_in" || inHouseNow || diffDays === 0)
        buckets.Today.push(r);
      else if (diffDays > 0 && diffDays <= 7) buckets["This week"].push(r);
      else if (diffDays > 7) buckets.Later.push(r);
      else buckets.Earlier.push(r);
    }
    const sortAsc = (a: BookingRow, b: BookingRow) =>
      dts(a.checkIn ?? a.createdAt) - dts(b.checkIn ?? b.createdAt);
    buckets.Today.sort(sortAsc);
    buckets["This week"].sort(sortAsc);
    buckets.Later.sort(sortAsc);
    buckets.Earlier.sort((a, b) => -sortAsc(a, b));
    return (["Today", "This week", "Later", "Earlier"] as const)
      .map((label) => ({ label, rows: buckets[label] }))
      .filter((g) => g.rows.length > 0);
  }, [filtered, today]);

  // Actions needed — derived from real rows.
  const actions = useMemo(() => {
    const out: {
      id: string;
      tone: "urgent" | "warn" | "ok";
      title: string;
      sub: string;
      href: string;
    }[] = [];
    for (const r of rows) {
      if (PENDING.has(r.status)) {
        out.push({
          id: r.id,
          tone: r.status === "pending_eft_review" ? "warn" : "urgent",
          title:
            r.status === "pending_eft_review"
              ? `Review EFT proof — ${r.guestName}`
              : `Confirm booking — ${r.guestName}`,
          sub: `${fmtR(r.totalAmount, r.currency)} · ${r.listingName}`,
          href: `/dashboard/bookings/${r.id}`,
        });
      } else if (
        r.status === "checked_in" &&
        r.checkOut &&
        dts(r.checkOut) === today
      ) {
        out.push({
          id: r.id,
          tone: "ok",
          title: `Checkout today — ${r.guestName}`,
          sub: `${r.listingName} · ${r.reference}`,
          href: `/dashboard/bookings/${r.id}`,
        });
      }
    }
    return out.slice(0, 6);
  }, [rows, today]);

  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(r.id)),
    [filtered, selected],
  );
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (filtered.every((r) => prev.has(r.id))) return new Set();
      return new Set(filtered.map((r) => r.id));
    });
  }

  const TABS: { key: TabKey; label: string; tone?: string; pulse?: boolean }[] =
    [
      { key: "all", label: "All" },
      { key: "upcoming", label: "Upcoming", tone: "bg-status-confirmed" },
      {
        key: "inhouse",
        label: "In-house",
        tone: "bg-status-inhouse",
        pulse: true,
      },
      { key: "pending", label: "Pending", tone: "bg-status-pending" },
      { key: "completed", label: "Completed" },
      { key: "cancelled", label: "Cancelled" },
    ];

  const spark = sparkPaths(kpis.revenue.spark);
  const barMax = Math.max(...kpis.bookings.bars, 1);

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Bookings
          </div>
          <h1 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight text-brand-ink md:text-[30px]">
            Reservations &amp; stays
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            {rows.length} {rows.length === 1 ? "booking" : "bookings"} across{" "}
            {listingCount} {listingCount === 1 ? "listing" : "listings"}
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
          <Link
            href="/dashboard/calendar-sync"
            className="hidden items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-accent/40 sm:inline-flex"
          >
            <RefreshCw className="h-4 w-4" />
            Sync iCal
          </Link>
          <Link
            href="/dashboard/bookings/new"
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white shadow-glow transition-colors hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New booking
          </Link>
        </div>
      </section>

      {/* ── KPI strip ── */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* Revenue (dark) */}
        <div className="relative overflow-hidden rounded-card bg-brand-gradient-dark p-5 text-white shadow-card">
          <div aria-hidden className="dotgrid absolute inset-0 opacity-25" />
          <div
            aria-hidden
            className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-primary/30 blur-3xl"
          />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-accent/80">
                Booked revenue · {kpis.monthLabel}
              </span>
              {kpis.revenue.deltaPct != null ? (
                <span
                  className={`num inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[10px] font-bold ${
                    kpis.revenue.deltaPct >= 0
                      ? "bg-brand-primary/20 text-brand-primary"
                      : "bg-status-cancelled/20 text-status-cancelled"
                  }`}
                >
                  {kpis.revenue.deltaPct >= 0 ? (
                    <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={3} />
                  ) : (
                    <ArrowDownRight className="h-2.5 w-2.5" strokeWidth={3} />
                  )}
                  {kpis.revenue.deltaPct >= 0 ? "+" : ""}
                  {kpis.revenue.deltaPct}%
                </span>
              ) : null}
            </div>
            <div className="num mt-2 font-display text-[30px] font-bold leading-none">
              {fmtR(kpis.revenue.total, kpis.currency)}
            </div>
            <div className="num mt-1 text-[11.5px] text-brand-accent/70">
              {fmtR(kpis.revenue.prevTotal, kpis.currency)} · same period last
              month
            </div>
            <svg viewBox="0 0 200 40" className="mt-3 h-9 w-full">
              <defs>
                <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </linearGradient>
              </defs>
              {spark.area ? (
                <path d={spark.area} fill="url(#sparkGrad)" stroke="none" />
              ) : null}
              {spark.line ? (
                <path
                  d={spark.line}
                  stroke="#10B981"
                  strokeWidth={1.5}
                  fill="none"
                />
              ) : null}
            </svg>
          </div>
        </div>

        {/* New bookings */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              New bookings · {kpis.monthLabel}
            </span>
            {kpis.bookings.delta !== 0 ? (
              <span
                className={`num inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[10px] font-bold ${
                  kpis.bookings.delta >= 0
                    ? "bg-status-confirmed/10 text-status-confirmed"
                    : "bg-status-cancelled/10 text-status-cancelled"
                }`}
              >
                {kpis.bookings.delta >= 0 ? (
                  <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  <ArrowDownRight className="h-2.5 w-2.5" strokeWidth={3} />
                )}
                {kpis.bookings.delta >= 0 ? "+" : ""}
                {kpis.bookings.delta}
              </span>
            ) : null}
          </div>
          <div className="num mt-2 font-display text-[30px] font-bold leading-none text-brand-ink">
            {kpis.bookings.total}
          </div>
          <div className="mt-1 text-[11.5px] text-brand-mute">
            <span className="font-semibold text-brand-ink">
              {kpis.bookings.confirmed} confirmed
            </span>{" "}
            · {kpis.bookings.pending} pending · {kpis.bookings.cancelled}{" "}
            cancelled
          </div>
          <div className="mt-3 flex h-9 items-end gap-0.5">
            {kpis.bookings.bars.length > 0 ? (
              kpis.bookings.bars.map((v, i) => (
                <div
                  key={i}
                  className={`w-full rounded-sm ${v >= barMax && barMax > 0 ? "bg-brand-primary" : "bg-brand-line"}`}
                  style={{ height: `${Math.max((v / barMax) * 100, 6)}%` }}
                />
              ))
            ) : (
              <div className="w-full self-center text-center text-[11px] text-brand-mute">
                No bookings this month yet
              </div>
            )}
          </div>
        </div>

        {/* Occupancy */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              Occupancy · next 30 days
            </span>
            {kpis.occupancy.deltaPp != null && kpis.occupancy.deltaPp !== 0 ? (
              <span
                className={`num inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[10px] font-bold ${
                  kpis.occupancy.deltaPp >= 0
                    ? "bg-status-confirmed/10 text-status-confirmed"
                    : "bg-status-cancelled/10 text-status-cancelled"
                }`}
              >
                {kpis.occupancy.deltaPp >= 0 ? (
                  <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  <ArrowDownRight className="h-2.5 w-2.5" strokeWidth={3} />
                )}
                {kpis.occupancy.deltaPp >= 0 ? "+" : ""}
                {kpis.occupancy.deltaPp} pp
              </span>
            ) : null}
          </div>
          <div className="num mt-2 font-display text-[30px] font-bold leading-none text-brand-ink">
            {kpis.occupancy.pct}
            <span className="text-[20px] text-brand-mute">%</span>
          </div>
          <div className="mt-1 text-[11.5px] text-brand-mute">
            {kpis.occupancy.bookedNights} of {kpis.occupancy.totalNights} nights
            booked across all listings
          </div>
          <div className="mt-3 flex h-9 items-stretch gap-[2px]">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm ${i < Math.round((kpis.occupancy.pct / 100) * 30) ? "bg-brand-primary" : "bg-brand-line"}`}
              />
            ))}
          </div>
        </div>

        {/* ADR */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Avg nightly rate
          </span>
          <div className="num mt-2 font-display text-[30px] font-bold leading-none text-brand-ink">
            {fmtR(kpis.adr.value, kpis.currency)}
          </div>
          <div className="mt-1 text-[11.5px] text-brand-mute">
            avg stay{" "}
            <span className="font-semibold text-brand-ink">
              {kpis.adr.avgNights} nights
            </span>{" "}
            · lead time {kpis.adr.leadDays} days
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {kpis.adr.perListing.length > 0 ? (
              kpis.adr.perListing.map((l) => (
                <div
                  key={l.name}
                  className="rounded bg-brand-light px-2 py-1.5"
                >
                  <div className="num font-display text-[13px] font-bold text-brand-ink">
                    {fmtR(l.adr, kpis.currency)}
                  </div>
                  <div className="truncate text-[9.5px] text-brand-mute">
                    {l.name}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 rounded bg-brand-light px-2 py-2 text-[11px] text-brand-mute">
                No completed stays yet
              </div>
            )}
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
            <Calendar className="h-3.5 w-3.5 text-brand-mute" />
            All dates
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-primary bg-brand-accent/40 px-3 py-1.5 text-[12px] font-medium text-brand-secondary">
            <Home className="h-3.5 w-3.5" />
            All {listingCount} {listingCount === 1 ? "listing" : "listings"}
            <ChevronDown className="h-3 w-3" />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12px] font-medium text-brand-ink">
            <SlidersHorizontal className="h-3.5 w-3.5 text-brand-mute" />
            Any channel
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11.5px] text-brand-mute">
              Showing {filtered.length}{" "}
              {filtered.length === 1 ? "result" : "results"}
            </span>
          </div>
        </div>

        {/* Selection bar */}
        {selected.size > 0 ? (
          <div className="flex items-center gap-3 border-b border-brand-primary/30 bg-brand-accent/50 px-4 py-2.5">
            <span className="num text-[12px] font-semibold text-brand-secondary">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={() => exportCsv(selectedRows)}
              className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 text-[11.5px] font-medium text-brand-ink shadow-sm hover:bg-brand-light"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-[11.5px] font-medium text-brand-mute hover:text-brand-ink"
            >
              Clear
            </button>
          </div>
        ) : null}

        {/* Table head */}
        <div
          className={`${GRID} border-b border-brand-line bg-white px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute`}
        >
          <div>
            <input
              type="checkbox"
              className="vilo-check"
              checked={allVisibleSelected}
              onChange={toggleAll}
              aria-label="Select all"
            />
          </div>
          <div>Guest &amp; listing</div>
          <div>Stay dates</div>
          <div>Channel · Booked</div>
          <div>Guests</div>
          <div className="text-right">Amount</div>
          <div>Status</div>
          <div />
        </div>

        {/* Body */}
        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <h2 className="font-display text-lg font-bold text-brand-ink">
              No bookings here
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              {tab === "all"
                ? "Once a guest reserves and pays, the booking shows up here for you to confirm."
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
                  <BookingRowItem
                    key={r.id}
                    row={r}
                    today={today}
                    checked={selected.has(r.id)}
                    onToggle={() => toggle(r.id)}
                    onOpen={() => router.push(`/dashboard/bookings/${r.id}`)}
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
            bookings
          </div>
        </div>
      </section>

      {/* ── Actions needed ── */}
      {actions.length > 0 ? (
        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="border-b border-brand-line px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              Actions needed
            </div>
            <div className="mt-1 font-display text-[16px] font-bold text-brand-ink">
              {actions.length} {actions.length === 1 ? "thing" : "things"} to
              handle
            </div>
          </div>
          <ul className="divide-y divide-brand-line">
            {actions.map((a) => (
              <li key={a.id} className="flex gap-3 px-5 py-3.5">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill ${
                    a.tone === "urgent"
                      ? "bg-status-cancelled/10 text-status-cancelled"
                      : a.tone === "warn"
                        ? "bg-status-pending/10 text-status-pending"
                        : "bg-brand-accent text-brand-secondary"
                  }`}
                >
                  {a.tone === "ok" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-brand-ink">
                    {a.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-brand-mute">
                    {a.sub}
                  </div>
                  <Link
                    href={a.href}
                    className="mt-1.5 inline-flex text-[11.5px] font-semibold text-brand-primary hover:underline"
                  >
                    Open booking →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// ── One table row ───────────────────────────────────────────────────
function BookingRowItem({
  row,
  today,
  checked,
  onToggle,
  onOpen,
}: {
  row: BookingRow;
  today: number;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const ch = channelOf(row.origin);
  const isCancelled = CANCELLED.has(row.status);
  const inHouse = row.status === "checked_in";

  // Dates cell
  let dateMain: React.ReactNode = "—";
  let dateSub = "";
  if (row.checkIn && row.checkOut) {
    const ci = dts(row.checkIn);
    const co = dts(row.checkOut);
    const arriving = ci === today;
    const leaving = co === today;
    dateMain = (
      <>
        <span
          className={
            arriving
              ? "text-brand-primary"
              : leaving
                ? "text-status-inhouse"
                : ""
          }
        >
          {fmtDay(row.checkIn)}
        </span>{" "}
        →{" "}
        <span className={leaving ? "text-status-inhouse" : ""}>
          {fmtDay(row.checkOut)}
        </span>
      </>
    );
    const n = row.nights ?? Math.max(1, Math.round((co - ci) / DAY));
    if (leaving)
      dateSub = `${n} ${n === 1 ? "night" : "nights"} · checking out today`;
    else if (arriving)
      dateSub = `${n} ${n === 1 ? "night" : "nights"} · arriving today`;
    else if (inHouse) {
      const left = Math.max(0, Math.round((co - today) / DAY));
      dateSub = `${n} ${n === 1 ? "night" : "nights"} · ${left} more to go`;
    } else if (ci > today) {
      const inDays = Math.round((ci - today) / DAY);
      dateSub = `${n} ${n === 1 ? "night" : "nights"} · arrives in ${inDays}d`;
    } else {
      dateSub = `${n} ${n === 1 ? "night" : "nights"}`;
    }
  }

  // "Booked X · Nd lead"
  const bookedStr = fmtDay(row.createdAt.slice(0, 10));
  let leadStr = "";
  const startStr = row.checkIn;
  if (startStr) {
    const lead = Math.round(
      (dts(startStr) - dts(row.createdAt.slice(0, 10))) / DAY,
    );
    if (lead >= 0) leadStr = ` · ${lead}d lead`;
  }

  const stayLabel =
    row.stayIndex === 1
      ? "1st stay"
      : row.stayIndex === 2
        ? "2nd stay"
        : row.stayIndex === 3
          ? "3rd stay"
          : `${row.stayIndex}th stay`;
  const payHint =
    row.paymentStatus === "paid"
      ? "paid in full"
      : row.paymentStatus === "deposit_paid"
        ? "deposit only"
        : row.paymentStatus === "refunded"
          ? "refunded"
          : row.paymentStatus.replace(/_/g, " ");

  return (
    <li
      onClick={onOpen}
      className={`bk-row ${GRID} cursor-pointer px-4 py-3.5 transition-colors hover:bg-brand-accent/30 ${isCancelled ? "opacity-75" : ""}`}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="vilo-check row-check"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${row.reference}`}
        />
      </div>

      {/* Guest + listing */}
      <div className="flex min-w-0 items-center gap-3">
        <Avatar
          name={row.guestName}
          src={row.guestAvatar}
          ring={inHouse ? "#0EA5E9" : undefined}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`truncate text-[13.5px] font-semibold text-brand-ink ${isCancelled ? "line-through decoration-brand-mute/40" : ""}`}
            >
              {row.guestName}
            </span>
            <span
              className={`chip rounded-pill px-1.5 py-0.5 text-[10px] font-semibold ${row.stayIndex >= 3 ? "bg-brand-accent text-brand-secondary" : "bg-brand-light text-brand-mute"}`}
            >
              {stayLabel}
            </span>
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
            <span className="font-mono text-[10px]">{row.reference}</span>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="num">
        <div className="text-[12.5px] font-semibold text-brand-ink">
          {dateMain}
        </div>
        {dateSub ? (
          <div className="mt-0.5 text-[11px] text-brand-mute">{dateSub}</div>
        ) : null}
      </div>

      {/* Channel + booked */}
      <div>
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[8px] font-extrabold text-white"
            style={{ background: ch.color }}
          >
            {ch.mark}
          </span>
          <span className="font-semibold text-brand-ink">{ch.label}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-brand-mute">
          Booked {bookedStr}
          {leadStr}
        </div>
      </div>

      {/* Guests */}
      <div className="text-[12.5px]">
        <div className="num font-semibold text-brand-ink">
          {row.guestsCount} {row.guestsCount === 1 ? "guest" : "guests"}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right">
        <div
          className={`num font-display text-[14px] font-bold text-brand-ink ${isCancelled ? "text-brand-mute line-through" : ""}`}
        >
          {fmtR(row.totalAmount, row.currency)}
        </div>
        <div className="mt-0.5 text-[10.5px] text-brand-mute">{payHint}</div>
      </div>

      {/* Status */}
      <div>
        <StatusChip status={row.status} />
      </div>

      {/* Action */}
      <div className="text-right" onClick={(e) => e.stopPropagation()}>
        <Link
          href={`/dashboard/bookings/${row.id}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-brand-mute hover:bg-brand-light hover:text-brand-ink"
          aria-label="Open booking"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}
