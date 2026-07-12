"use client";

import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Info,
  Pencil,
  Plus,
  Power,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { modal } from "@/components/ui/modal-host";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  copySeasonalRulesToListingAction,
  createSeasonalRuleAction,
  deleteSeasonalRuleAction,
  toggleSeasonalRuleActiveAction,
  updateSeasonalRuleAction,
} from "./actions";
import { nightsBetween, rangesOverlap } from "./schemas";

export type ListingRoom = {
  id: string;
  name: string;
  basePrice: number;
  weekendPrice: number | null;
  cleaningFee: number | null;
  currency: string;
  isActive: boolean;
};

export type ListingGroup = {
  id: string;
  name: string;
  slug: string | null;
  bookingMode: "whole_listing" | "rooms_only" | "flexible";
  basePrice: number | null;
  weekendPrice: number | null;
  cleaningFee: number | null;
  currency: string;
  minNights: number;
  rooms: ListingRoom[];
};

export type SeasonalRule = {
  id: string;
  listingId: string;
  roomId: string | null;
  label: string;
  startDate: string;
  endDate: string;
  /** How the rule is expressed. */
  adjustmentType: "absolute" | "percent";
  /** Absolute: nightly price. Percent: signed % on the room's own rate. */
  adjustmentValue: number;
  /** Effective nightly rate for display (absolute value, or base×(1±%)),
   *  computed server-side against the rule's reference base. */
  price: number;
  currency: string;
  minNights: number | null;
  priority: number;
  isActive: boolean;
};

type EditTarget =
  | { mode: "create"; listingId?: string; roomId?: string | null }
  | { mode: "edit"; rule: SeasonalRule };

// ─── Season tiers (derived from price vs base, no schema column) ──────
type Tier = "peak" | "high" | "shoulder" | "low";
const TIER_COLOR: Record<Tier, string> = {
  peak: "#064E3B",
  high: "#10B981",
  shoulder: "#6EE7B7",
  low: "#F59E0B",
};
const TIER_DESCRIPTOR: Record<Tier, string> = {
  peak: "Peak demand",
  high: "Higher demand",
  shoulder: "Moderate uplift",
  low: "Off-peak rate",
};

function tierFor(price: number, base: number | null): Tier {
  if (!base || base <= 0) return "shoulder";
  const pct = (price - base) / base;
  if (pct >= 0.4) return "peak";
  if (pct >= 0.15) return "high";
  if (pct >= 0) return "shoulder";
  return "low";
}

type SeasonStatus = "active" | "soon" | "upcoming" | "past" | "inactive";

function statusFor(rule: SeasonalRule, today: string): SeasonStatus {
  if (!rule.isActive) return "inactive";
  if (rule.endDate < today) return "past";
  if (rule.startDate <= today && today <= rule.endDate) return "active";
  if (rule.startDate === isoPlusDays(today, 1)) return "soon";
  return "upcoming";
}

// ─── Date helpers ─────────────────────────────────────────────────────
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoPlusDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}
function dayOfYear(iso: string, year: number): number {
  const start = Date.UTC(year, 0, 1);
  const d = Date.parse(`${iso}T00:00:00Z`);
  return Math.floor((d - start) / 86_400_000);
}
function isoFromDay(year: number, idx: number): string {
  return new Date(Date.UTC(year, 0, 1 + idx)).toISOString().slice(0, 10);
}
function yearsTouched(rule: SeasonalRule): number[] {
  const s = Number(rule.startDate.slice(0, 4));
  const e = Number(rule.endDate.slice(0, 4));
  const out: number[] = [];
  for (let y = s; y <= e; y++) out.push(y);
  return out;
}
function intersectsYear(rule: SeasonalRule, year: number): boolean {
  return rule.startDate <= `${year}-12-31` && rule.endDate >= `${year}-01-01`;
}

function formatZAR(amount: number): string {
  return `R ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}
function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
function fmtRange(start: string, end: string): string {
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const s = new Date(`${start}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: startYear === endYear ? undefined : "numeric",
    timeZone: "UTC",
  });
  const e = new Date(`${end}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${s} – ${e}`;
}

/** Reference base price a rule's rate is measured against. */
function refBaseForRule(
  rule: SeasonalRule,
  listing: ListingGroup,
): number | null {
  if (rule.roomId) {
    const room = listing.rooms.find((r) => r.id === rule.roomId);
    if (room) return room.basePrice;
  }
  if (listing.basePrice != null) return listing.basePrice;
  return listing.rooms.length
    ? Math.min(...listing.rooms.map((r) => r.basePrice))
    : null;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function SeasonalPricingManager({
  listings,
  initialRules,
  embedded = false,
}: {
  listings: ListingGroup[];
  initialRules: SeasonalRule[];
  /** When rendered inside the setup wizard: hide the page heading (the wizard
   *  supplies its own step header) and the multi-listing switcher. */
  embedded?: boolean;
}) {
  const [rules, setRules] = useState<SeasonalRule[]>(initialRules);
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(listings[0]?.id ?? "");
  const today = todayIso();

  const listing = listings.find((l) => l.id === selectedId) ?? listings[0];

  const rulesForListing = useMemo(
    () => rules.filter((r) => r.listingId === listing?.id),
    [rules, listing?.id],
  );

  // Year options = every year any rule touches, plus the current year.
  const yearOptions = useMemo(() => {
    const set = new Set<number>([Number(today.slice(0, 4))]);
    for (const r of rulesForListing)
      for (const y of yearsTouched(r)) set.add(y);
    return [...set].sort((a, b) => a - b);
  }, [rulesForListing, today]);

  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  useEffect(() => {
    if (!yearOptions.includes(year)) {
      setYear(yearOptions.includes(currentYear) ? currentYear : yearOptions[0]);
    }
  }, [yearOptions, year, currentYear]);

  const rulesInYear = useMemo(
    () => rulesForListing.filter((r) => intersectsYear(r, year)),
    [rulesForListing, year],
  );

  function applyCreated(rule: SeasonalRule) {
    setRules((prev) => [...prev, rule]);
  }
  function applyUpdated(rule: SeasonalRule) {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)));
  }
  function applyDeleted(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  if (!listing) return null;

  const seasonCountByListing = (id: string) =>
    rules.filter((r) => r.listingId === id).length;

  return (
    <div className="space-y-6 lg:space-y-7">
      {/* ── Heading ── */}
      {embedded ? null : (
        <section className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
              Seasonal pricing
            </h1>
          </div>
          <div className="-mt-1 flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink md:text-2xl">
                Set rates that follow demand.
              </h2>
              <p className="mt-1 max-w-xl text-sm text-brand-mute">
                Seasonal rates override your base rate for specific date ranges.
                Weekend and minimum-stay rules still apply on top. Room rules
                beat listing rules on the same dates.
              </p>
            </div>
            <div className="flex items-center gap-2 md:ml-auto">
              <button
                type="button"
                onClick={() => setCopyOpen(true)}
                disabled={listings.length < 2}
                className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-4 w-4" /> Copy to listing
              </button>
              <button
                type="button"
                onClick={() => exportCsv(listing, rulesForListing, today)}
                disabled={rulesForListing.length === 0}
                className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          </div>

          {/* Listing switcher */}
          {listings.length > 1 ? (
            <div className="hscroll flex items-center gap-2 overflow-x-auto pb-1">
              {listings.map((l) => {
                const count = seasonCountByListing(l.id);
                const active = l.id === listing.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-pill border py-1.5 pl-1.5 pr-3 text-[13px] font-medium transition-all ${
                      active
                        ? "border-brand-primary text-brand-ink shadow-[0_0_0_1px_#10B981]"
                        : "border-brand-line text-brand-mute hover:bg-brand-light"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">
                      {l.name.slice(0, 2).toUpperCase()}
                    </span>
                    {l.name}
                    <span className="font-mono text-[10px] text-brand-mute">
                      {count} season{count === 1 ? "" : "s"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      )}

      <Kpis listing={listing} rulesInYear={rulesInYear} year={year} />

      <section className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        <Timeline
          listing={listing}
          rulesInYear={rulesInYear}
          year={year}
          yearOptions={yearOptions}
          onYearChange={setYear}
          today={today}
        />
        <PricingRules listing={listing} rulesInYear={rulesInYear} year={year} />
      </section>

      <SeasonsTable
        listing={listing}
        rulesInYear={rulesInYear}
        year={year}
        today={today}
        onCreate={() =>
          setTarget({ mode: "create", listingId: listing.id, roomId: null })
        }
        onEdit={(rule) => setTarget({ mode: "edit", rule })}
        onUpdated={applyUpdated}
        onDeleted={applyDeleted}
      />

      <GuestPreview listing={listing} rulesInYear={rulesInYear} year={year} />

      {target ? (
        <RuleDialog
          listings={listings}
          target={target}
          existingRules={rules}
          onClose={() => setTarget(null)}
          onCreated={applyCreated}
          onUpdated={applyUpdated}
        />
      ) : null}

      {copyOpen ? (
        <CopyDialog
          listings={listings}
          fromListing={listing}
          onClose={() => setCopyOpen(false)}
          onCopied={(newRules) => setRules((prev) => [...prev, ...newRules])}
        />
      ) : null}
    </div>
  );
}

// ════════════════════ KPI CARDS ════════════════════
function Kpis({
  listing,
  rulesInYear,
  year,
}: {
  listing: ListingGroup;
  rulesInYear: SeasonalRule[];
  year: number;
}) {
  const minRoomBase = listing.rooms.length
    ? Math.min(...listing.rooms.map((r) => r.basePrice))
    : null;
  const base = listing.basePrice ?? minRoomBase;
  const weekendPct =
    listing.weekendPrice != null && base
      ? Math.round(((listing.weekendPrice - base) / base) * 100)
      : null;

  // Whole-year day-by-day cover from listing-wide active rules.
  const cover = useMemo(
    () => computeYearCover(listing, rulesInYear, year),
    [listing, rulesInYear, year],
  );

  const baseLabel =
    listing.basePrice != null
      ? formatZAR(listing.basePrice)
      : minRoomBase != null
        ? `From ${formatZAR(minRoomBase)}`
        : "—";

  const total = daysInYear(year);
  const tierShare = (t: Tier) => (cover.tierNights[t] / total) * 100;

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
      {/* Base rate */}
      <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
            <Banknote className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-medium text-brand-mute">
            Base rate / night
          </span>
        </div>
        <div className="num mt-3 font-display text-3xl font-bold text-brand-ink">
          {baseLabel}
        </div>
        <div className="mt-1 text-xs text-brand-mute">
          Applies when no season is active
        </div>
      </div>

      {/* Weekend rate */}
      <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-medium text-brand-mute">
            Weekend rate
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="num font-display text-3xl font-bold text-brand-ink">
            {listing.weekendPrice != null
              ? formatZAR(listing.weekendPrice)
              : "—"}
          </span>
          {weekendPct != null && weekendPct !== 0 ? (
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                weekendPct > 0
                  ? "text-status-confirmed"
                  : "text-status-cancelled"
              }`}
            >
              {weekendPct > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {weekendPct > 0 ? "+" : ""}
              {weekendPct}%
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-xs text-brand-mute">
          {listing.weekendPrice != null ? "Fri & Sat nights" : "Not set"}
        </div>
      </div>

      {/* Seasons set */}
      <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <CalendarRange className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-medium text-brand-mute">
              Seasons set
            </span>
          </div>
          <span className="num rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-bold text-brand-secondary">
            {year}
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="num font-display text-3xl font-bold text-brand-ink">
            {rulesInYear.length}
          </span>
          <span className="text-xs text-brand-mute">
            covering {cover.coveredNights} night
            {cover.coveredNights === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-pill bg-brand-light">
          {(["peak", "high", "shoulder", "low"] as Tier[]).map((t) =>
            cover.tierNights[t] > 0 ? (
              <div
                key={t}
                style={{ width: `${tierShare(t)}%`, background: TIER_COLOR[t] }}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* Projected uplift */}
      <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-medium text-brand-mute">
              Projected uplift
            </span>
          </div>
          <span
            title="Estimated extra (or lower) revenue across the year versus charging the flat base rate every night, including weekend uplift."
            className="text-brand-mute"
          >
            <Info className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className={`num font-display text-3xl font-bold ${
              cover.uplift == null
                ? "text-brand-ink"
                : cover.uplift >= 0
                  ? "text-brand-secondary"
                  : "text-status-cancelled"
            }`}
          >
            {cover.uplift == null
              ? "—"
              : `${cover.uplift >= 0 ? "+" : "−"}${formatZAR(Math.abs(cover.uplift))}`}
          </span>
        </div>
        <div className="mt-1 text-xs text-brand-mute">
          Est. vs a flat base rate all year
        </div>
      </div>
    </section>
  );
}

type YearCover = {
  coveredNights: number;
  tierNights: Record<Tier, number>;
  uplift: number | null;
  avgNight: number | null;
  low: number | null;
  high: number | null;
};

/** Day-by-day walk of the year using listing-wide active rules (room-agnostic),
 *  mirroring calculate_booking_price: season > weekend > base. */
function computeYearCover(
  listing: ListingGroup,
  rulesInYear: SeasonalRule[],
  year: number,
): YearCover {
  const minRoomBase = listing.rooms.length
    ? Math.min(...listing.rooms.map((r) => r.basePrice))
    : null;
  const base = listing.basePrice ?? minRoomBase;
  const weekend = listing.weekendPrice;
  const wide = rulesInYear.filter((r) => r.roomId === null && r.isActive);
  const total = daysInYear(year);
  const tierNights: Record<Tier, number> = {
    peak: 0,
    high: 0,
    shoulder: 0,
    low: 0,
  };

  if (base == null) {
    return {
      coveredNights: 0,
      tierNights,
      uplift: null,
      avgNight: null,
      low: null,
      high: null,
    };
  }

  let covered = 0;
  let uplift = 0;
  let sum = 0;
  let low = Infinity;
  let high = -Infinity;

  for (let i = 0; i < total; i++) {
    const date = isoFromDay(year, i);
    let price: number | null = null;
    let winner: SeasonalRule | null = null;
    for (const r of wide) {
      if (date >= r.startDate && date <= r.endDate) {
        if (
          !winner ||
          r.priority > winner.priority ||
          (r.priority === winner.priority && r.startDate > winner.startDate)
        ) {
          winner = r;
        }
      }
    }
    if (winner) {
      price = winner.price;
      covered++;
      tierNights[tierFor(winner.price, base)]++;
    } else {
      // Weekend = Fri (5) + Sat (6), matching the pricing engine.
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      price = dow === 5 || dow === 6 ? (weekend ?? base) : base;
    }
    sum += price;
    uplift += price - base;
    low = Math.min(low, price);
    high = Math.max(high, price);
  }

  return {
    coveredNights: covered,
    tierNights,
    uplift: Math.round(uplift),
    avgNight: Math.round(sum / total),
    low: low === Infinity ? null : low,
    high: high === -Infinity ? null : high,
  };
}

// ════════════════════ YEAR TIMELINE ════════════════════
function Timeline({
  listing,
  rulesInYear,
  year,
  yearOptions,
  onYearChange,
  today,
}: {
  listing: ListingGroup;
  rulesInYear: SeasonalRule[];
  year: number;
  yearOptions: number[];
  onYearChange: (y: number) => void;
  today: string;
}) {
  const minRoomBase = listing.rooms.length
    ? Math.min(...listing.rooms.map((r) => r.basePrice))
    : null;
  const base = listing.basePrice ?? minRoomBase;
  const total = daysInYear(year);

  const wide = rulesInYear.filter((r) => r.roomId === null && r.isActive);
  const prices = wide.map((r) => r.price);
  const scaleMax =
    Math.max(
      prices.length ? Math.max(...prices) : 0,
      base ?? 0,
      listing.weekendPrice ?? 0,
    ) * 1.08 || 1;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const bars = wide.map((r) => {
    const cs = r.startDate < yearStart ? yearStart : r.startDate;
    const ce = r.endDate > yearEnd ? yearEnd : r.endDate;
    const s = Math.max(0, dayOfYear(cs, year));
    const e = Math.min(total - 1, dayOfYear(ce, year));
    const tier = tierFor(r.price, base);
    return {
      id: r.id,
      left: (s / total) * 100,
      width: ((e - s + 1) / total) * 100,
      height: Math.max(8, Math.min(100, (r.price / scaleMax) * 100)),
      tier,
      price: r.price,
      label: r.label,
    };
  });

  const baseTop = base ? (1 - base / scaleMax) * 100 : null;
  const showToday = year === Number(today.slice(0, 4));
  const todayLeft = showToday ? (dayOfYear(today, year) / total) * 100 : null;

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:col-span-2 lg:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Rate calendar
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            {listing.name} · {year}
          </h3>
          <div className="mt-0.5 text-xs text-brand-mute">
            Bar height reflects the nightly rate against your base.
          </div>
        </div>
        <div className="flex items-center gap-3">
          {yearOptions.length > 1 ? (
            <div className="relative">
              <select
                value={year}
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="appearance-none rounded border border-brand-line bg-white py-1.5 pl-3 pr-8 text-[12.5px] font-medium text-brand-ink outline-none hover:bg-brand-light/60"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-brand-mute" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-4 text-[11px] text-brand-ink">
        {(
          [
            ["peak", "Peak"],
            ["high", "High"],
            ["shoulder", "Shoulder"],
            ["low", "Low"],
          ] as [Tier, string][]
        ).map(([t, lbl]) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: TIER_COLOR[t] }}
            />
            {lbl}
          </span>
        ))}
      </div>

      {/* chart */}
      <div className="relative mb-1 h-[200px]">
        {/* gridlines + base line */}
        <div className="absolute inset-0">
          <div
            className="absolute left-0 right-0 border-t border-dashed border-brand-line"
            style={{ top: "5%" }}
          />
          <div
            className="absolute left-0 right-0 border-t border-dashed border-brand-line"
            style={{ top: "50%" }}
          />
          {baseTop != null ? (
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-status-draft"
              style={{ top: `${baseTop}%` }}
            >
              <span className="num absolute right-0 -translate-y-1/2 rounded border border-dashed border-status-draft bg-white px-1.5 py-px text-[10px] text-brand-mute">
                Base · {base != null ? formatZAR(base) : "—"}
              </span>
            </div>
          ) : null}
        </div>

        {bars.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-brand-mute">
            No seasons set for {year} yet.
          </div>
        ) : (
          bars.map((b) => (
            <div
              key={b.id}
              title={`${b.label} · ${formatZAR(b.price)}`}
              className="absolute bottom-0 flex items-start justify-center rounded-t-md transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-105"
              style={{
                left: `${b.left}%`,
                width: `${b.width}%`,
                height: `${b.height}%`,
                background: TIER_COLOR[b.tier],
              }}
            >
              {b.width > 6 ? (
                <span
                  className={`num mt-1.5 text-[10px] font-semibold ${
                    b.tier === "shoulder"
                      ? "text-brand-secondary"
                      : "text-white/95"
                  }`}
                >
                  {formatZAR(b.price)}
                </span>
              ) : null}
            </div>
          ))
        )}

        {/* today marker */}
        {todayLeft != null ? (
          <div
            className="absolute bottom-0 top-0 w-px bg-brand-secondary/70"
            style={{ left: `${todayLeft}%` }}
          >
            <span className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-brand-secondary" />
            <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded border border-brand-line bg-white px-1.5 py-0.5 text-[9px] font-semibold text-brand-secondary">
              Today
            </span>
          </div>
        ) : null}
      </div>

      {/* month axis */}
      <div className="grid grid-cols-12 border-t border-brand-line pt-2 text-center font-mono text-[10px] text-brand-mute">
        {MONTHS.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

// ════════════════════ PRICING RULES SIDEBAR ════════════════════
function PricingRules({
  listing,
  rulesInYear,
  year,
}: {
  listing: ListingGroup;
  rulesInYear: SeasonalRule[];
  year: number;
}) {
  const minRoomBase = listing.rooms.length
    ? Math.min(...listing.rooms.map((r) => r.basePrice))
    : null;
  const base = listing.basePrice ?? minRoomBase;
  const weekendPct =
    listing.weekendPrice != null && base
      ? Math.round(((listing.weekendPrice - base) / base) * 100)
      : null;
  const peakMin = Math.max(
    listing.minNights,
    ...rulesInYear
      .filter((r) => r.isActive && r.minNights != null)
      .map((r) => r.minNights as number),
    listing.minNights,
  );
  const cover = useMemo(
    () => computeYearCover(listing, rulesInYear, year),
    [listing, rulesInYear, year],
  );

  const rows: { label: string; sub: string; value: string }[] = [
    {
      label: "Base rate",
      sub: "Per night, no season active",
      value: base != null ? formatZAR(base) : "—",
    },
    {
      label: "Weekend uplift",
      sub: "Fri & Sat",
      value:
        weekendPct != null
          ? `${weekendPct > 0 ? "+" : ""}${weekendPct}%`
          : listing.weekendPrice != null
            ? formatZAR(listing.weekendPrice)
            : "Not set",
    },
    {
      label: "Cleaning fee",
      sub: "One-off per stay",
      value:
        listing.cleaningFee && listing.cleaningFee > 0
          ? formatZAR(listing.cleaningFee)
          : "None",
    },
    {
      label: "Min nights · peak",
      sub: "Highest seasonal minimum",
      value: String(peakMin),
    },
  ];

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        Pricing rules
      </div>
      <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
        Defaults &amp; uplifts
      </h3>

      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between rounded border border-brand-line p-3"
          >
            <div>
              <div className="text-sm font-medium text-brand-ink">
                {r.label}
              </div>
              <div className="text-[11px] text-brand-mute">{r.sub}</div>
            </div>
            <span className="num font-display font-bold text-brand-ink">
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {/* Real, computed year-at-a-glance card (no AI placeholder) */}
      <div className="relative mt-4 overflow-hidden rounded-card bg-brand-dark p-4 text-white">
        <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-brand-primary/30 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-brand-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">
              Year at a glance
            </span>
          </div>
          {cover.low != null && cover.high != null ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-brand-accent/90">
              Guests pay between{" "}
              <span className="num font-semibold text-white">
                {formatZAR(cover.low)}
              </span>{" "}
              and{" "}
              <span className="num font-semibold text-white">
                {formatZAR(cover.high)}
              </span>{" "}
              a night
              {cover.avgNight != null ? (
                <>
                  , averaging{" "}
                  <span className="num font-semibold text-white">
                    {formatZAR(cover.avgNight)}
                  </span>
                </>
              ) : null}
              .
            </p>
          ) : (
            <p className="mt-2 text-[12.5px] leading-relaxed text-brand-accent/90">
              Set a base rate to see how your year prices out.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════ SEASONS TABLE ════════════════════
type TableFilter = "all" | "upcoming" | "past";

function SeasonsTable({
  listing,
  rulesInYear,
  year,
  today,
  onCreate,
  onEdit,
  onUpdated,
  onDeleted,
}: {
  listing: ListingGroup;
  rulesInYear: SeasonalRule[];
  year: number;
  today: string;
  onCreate: () => void;
  onEdit: (rule: SeasonalRule) => void;
  onUpdated: (rule: SeasonalRule) => void;
  onDeleted: (id: string) => void;
}) {
  const [filter, setFilter] = useState<TableFilter>("all");

  const sorted = [...rulesInYear].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const visible = sorted.filter((r) => {
    if (filter === "upcoming") return r.endDate >= today;
    if (filter === "past") return r.endDate < today;
    return true;
  });

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line p-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Seasons
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            {rulesInYear.length} rate override
            {rulesInYear.length === 1 ? "" : "s"} · {listing.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-pill border border-brand-line bg-brand-light p-1 text-[11px] font-medium md:inline-flex">
            {(["all", "upcoming", "past"] as TableFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-pill px-3 py-1 capitalize ${
                  filter === f
                    ? "bg-white text-brand-ink shadow-card"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Button type="button" onClick={onCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> New season
          </Button>
        </div>
      </div>

      <div className="hscroll overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-brand-line bg-brand-light/40 text-[10px] font-medium uppercase tracking-wider text-brand-mute">
              <th className="px-5 py-2.5 text-left font-medium">Season</th>
              <th className="px-5 py-2.5 text-left font-medium">Date range</th>
              <th className="px-5 py-2.5 text-left font-medium">Nights</th>
              <th className="px-5 py-2.5 text-right font-medium">
                Rate / night
              </th>
              <th className="px-5 py-2.5 text-right font-medium">vs. base</th>
              <th className="px-5 py-2.5 pl-6 text-left font-medium">Status</th>
              <th className="w-10 px-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-xs text-brand-mute"
                >
                  {rulesInYear.length === 0
                    ? `No seasons for ${year} yet. Add one below.`
                    : "No seasons match this filter."}
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <SeasonRowItem
                  key={r.id}
                  rule={r}
                  listing={listing}
                  today={today}
                  onEdit={() => onEdit(r)}
                  onUpdated={onUpdated}
                  onDeleted={onDeleted}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-brand-line p-4">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-brand-line px-4 py-2.5 text-sm font-medium text-brand-secondary transition-colors hover:bg-brand-accent"
        >
          <Plus className="h-4 w-4" /> Add a season
          <span className="ml-2 text-[10px] text-brand-mute">
            Set a label, date range &amp; nightly rate
          </span>
        </button>
      </div>
    </section>
  );
}

const STATUS_PILL: Record<
  SeasonStatus,
  { cls: string; label: string; icon?: typeof Check }
> = {
  active: {
    cls: "bg-brand-primary/10 text-brand-secondary",
    label: "Active now",
  },
  soon: {
    cls: "bg-amber-100 text-amber-800",
    label: "Starts tomorrow",
    icon: Clock3,
  },
  upcoming: { cls: "bg-indigo-100 text-indigo-800", label: "Upcoming" },
  past: { cls: "bg-slate-100 text-slate-600", label: "Past", icon: Check },
  inactive: { cls: "bg-brand-light text-brand-mute", label: "Inactive" },
};

function SeasonRowItem({
  rule,
  listing,
  today,
  onEdit,
  onUpdated,
  onDeleted,
}: {
  rule: SeasonalRule;
  listing: ListingGroup;
  today: string;
  onEdit: () => void;
  onUpdated: (rule: SeasonalRule) => void;
  onDeleted: (id: string) => void;
}) {
  const [pending, start] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const refBase = refBaseForRule(rule, listing);
  const tier = tierFor(rule.price, refBase);
  const status = statusFor(rule, today);
  const pill = STATUS_PILL[status];
  const PillIcon = pill.icon;
  const nights = nightsBetween(rule.startDate, rule.endDate);
  const pct =
    refBase && refBase > 0
      ? Math.round(((rule.price - refBase) / refBase) * 100)
      : null;
  const roomName = rule.roomId
    ? (listing.rooms.find((r) => r.id === rule.roomId)?.name ?? "Room")
    : null;
  const sub = roomName
    ? `Room · ${roomName}`
    : `${TIER_DESCRIPTOR[tier]}${rule.minNights ? ` · min ${rule.minNights} nights` : ""}`;

  function toggleActive() {
    const next = !rule.isActive;
    setMenuOpen(false);
    start(async () => {
      const result = await toggleSeasonalRuleActiveAction(rule.id, next);
      if (result.ok) onUpdated({ ...rule, isActive: next });
      else toast.error(result.error);
    });
  }

  async function remove() {
    setMenuOpen(false);
    const confirmed = await modal.destructive({
      title: `Delete the "${rule.label}" season?`,
      description: "This removes the seasonal rate override.",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    start(async () => {
      const result = await deleteSeasonalRuleAction(rule.id);
      if (result.ok) {
        onDeleted(rule.id);
        toast.success("Season deleted");
      } else toast.error(result.error);
    });
  }

  return (
    <tr
      className={`transition-colors hover:bg-brand-light ${pending ? "opacity-50" : ""}`}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="h-8 w-1.5 shrink-0 rounded-pill"
            style={{ background: rule.isActive ? TIER_COLOR[tier] : "#94A3B8" }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-brand-ink">
                {rule.label}
              </span>
              {rule.priority > 0 ? (
                <span className="num rounded-pill bg-brand-light px-1.5 py-0.5 text-[9px] font-semibold text-brand-mute">
                  P{rule.priority}
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-brand-mute">{sub}</div>
          </div>
        </div>
      </td>
      <td className="num px-5 py-3.5 text-xs text-brand-ink">
        {fmtRange(rule.startDate, rule.endDate)}
      </td>
      <td className="num px-5 py-3.5 text-xs text-brand-ink">{nights}</td>
      <td className="num px-5 py-3.5 text-right font-display font-bold text-brand-ink">
        {formatZAR(rule.price)}
      </td>
      <td className="px-5 py-3.5 text-right">
        {pct == null || pct === 0 ? (
          <span className="text-xs text-brand-mute">—</span>
        ) : (
          <span
            className={`num inline-flex items-center gap-1 text-xs font-semibold ${
              pct > 0 ? "text-status-confirmed" : "text-status-cancelled"
            }`}
          >
            {pct > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {pct > 0 ? "+" : "−"}
            {Math.abs(pct)}%
          </span>
        )}
      </td>
      <td className="px-5 py-3.5 pl-6">
        <span
          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-[11px] font-semibold ${pill.cls}`}
        >
          {PillIcon ? <PillIcon className="h-3 w-3" /> : null}
          {pill.label}
        </span>
      </td>
      <td className="px-3">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={pending}
            aria-label="Season actions"
            className="flex h-7 w-7 items-center justify-center rounded text-brand-mute hover:bg-brand-light hover:text-brand-ink disabled:opacity-40"
          >
            <span className="text-lg leading-none">⋮</span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-card border border-brand-line bg-white p-1 shadow-lift">
              <MenuItem
                icon={<Pencil className="h-3.5 w-3.5" />}
                label="Edit season"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              />
              <MenuItem
                icon={<Power className="h-3.5 w-3.5" />}
                label={rule.isActive ? "Set inactive" : "Set active"}
                onClick={toggleActive}
              />
              <MenuItem
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="Delete"
                onClick={remove}
                danger
              />
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
        danger
          ? "text-status-cancelled hover:bg-red-50"
          : "text-brand-ink hover:bg-brand-light"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ════════════════════ GUEST PREVIEW STRIP ════════════════════
function GuestPreview({
  listing,
  rulesInYear,
  year,
}: {
  listing: ListingGroup;
  rulesInYear: SeasonalRule[];
  year: number;
}) {
  const minRoomBase = listing.rooms.length
    ? Math.min(...listing.rooms.map((r) => r.basePrice))
    : null;
  const base = listing.basePrice ?? minRoomBase;

  // Listing-wide rules grouped by label → representative (earliest) price.
  const groups = useMemo(() => {
    const byLabel = new Map<string, SeasonalRule[]>();
    for (const r of rulesInYear) {
      if (r.roomId !== null || !r.isActive) continue;
      const arr = byLabel.get(r.label) ?? [];
      arr.push(r);
      byLabel.set(r.label, arr);
    }
    return [...byLabel.entries()]
      .map(([label, rows]) => {
        const sorted = [...rows].sort((a, b) =>
          a.startDate.localeCompare(b.startDate),
        );
        const start = sorted[0].startDate;
        const end = sorted.reduce(
          (m, r) => (r.endDate > m ? r.endDate : m),
          sorted[0].endDate,
        );
        return { label, price: sorted[0].price, start, end };
      })
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [rulesInYear]);

  const cover = useMemo(
    () => computeYearCover(listing, rulesInYear, year),
    [listing, rulesInYear, year],
  );

  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Guest preview
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            What guests see across the year
          </h3>
        </div>
        <span className="text-xs text-brand-mute">
          Per night · excl. cleaning fee &amp; add-ons
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Base */}
        <div className="rounded border border-brand-line p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
            <span className="h-2 w-2 rounded-sm bg-status-draft" /> Standard
          </div>
          <div className="num mt-1.5 font-display text-lg font-bold text-brand-ink">
            {base != null ? formatZAR(base) : "—"}
          </div>
          <div className="mt-0.5 text-[10px] text-brand-mute">Base rate</div>
        </div>

        {groups.map((g) => {
          const tier = tierFor(g.price, base);
          const pct =
            base && base > 0
              ? Math.round(((g.price - base) / base) * 100)
              : null;
          return (
            <div
              key={g.label}
              className="rounded border border-brand-line p-3.5"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: TIER_COLOR[tier] }}
                />
                <span className="truncate">{g.label}</span>
              </div>
              <div className="num mt-1.5 font-display text-lg font-bold text-brand-ink">
                {formatZAR(g.price)}
              </div>
              <div
                className={`mt-0.5 text-[10px] font-medium ${
                  pct == null || pct === 0
                    ? "text-brand-mute"
                    : pct > 0
                      ? "text-status-confirmed"
                      : "text-status-cancelled"
                }`}
              >
                {pct == null || pct === 0
                  ? fmtDay(g.start)
                  : `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`}
              </div>
            </div>
          );
        })}

        {/* Avg / night */}
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-brand-line p-3.5 text-center">
          <BarChart3 className="h-4 w-4 text-brand-mute" />
          <div className="mt-1 text-[11px] text-brand-mute">Avg / night</div>
          <div className="num font-display text-base font-bold text-brand-secondary">
            {cover.avgNight != null ? formatZAR(cover.avgNight) : "—"}
          </div>
        </div>
      </div>
    </section>
  );
}

// ════════════════════ COPY DIALOG ════════════════════
function CopyDialog({
  listings,
  fromListing,
  onClose,
  onCopied,
}: {
  listings: ListingGroup[];
  fromListing: ListingGroup;
  onClose: () => void;
  onCopied: (rules: SeasonalRule[]) => void;
}) {
  const targets = listings.filter((l) => l.id !== fromListing.id);
  const [toId, setToId] = useState(targets[0]?.id ?? "");
  const [pending, start] = useTransition();

  function submit() {
    if (!toId) return;
    start(async () => {
      const result = await copySeasonalRulesToListingAction(
        fromListing.id,
        toId,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const target = listings.find((l) => l.id === toId);
      const refBase = target?.basePrice ?? 0;
      // Copied rules are listing-wide; resolve each one's display nightly so the
      // preview matches (absolute = value, percent = base×(1±%)).
      const copied: SeasonalRule[] = result.data!.rules.map((r) => ({
        ...r,
        price:
          r.adjustmentType === "absolute"
            ? r.adjustmentValue
            : Math.max(0, refBase * (1 + r.adjustmentValue / 100)),
      }));
      onCopied(copied);
      toast.success(
        `Copied ${result.data!.rules.length} season${
          result.data!.rules.length === 1 ? "" : "s"
        } to ${target?.name ?? "listing"}`,
      );
      onClose();
    });
  }

  return (
    <FormModal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Copy seasons to another listing"
      description="Copies every listing-wide season from this listing onto another. Room-specific seasons aren't copied."
    >
      <div className="space-y-4">
        <Field label="From">
          <Input value={fromListing.name} disabled />
        </Field>
        <Field label="Copy into">
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger>
              <SelectValue placeholder="Select listing" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="text-[11px] text-brand-mute">
          Existing seasons on the target listing are kept — copied seasons are
          added alongside them.
        </p>
      </div>
      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <Button type="button" onClick={submit} disabled={pending || !toId}>
          {pending ? "Copying…" : "Copy seasons"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}

// ════════════════════ RULE DIALOG (create / edit) ════════════════════
function RuleDialog({
  listings,
  target,
  existingRules,
  onClose,
  onCreated,
  onUpdated,
}: {
  listings: ListingGroup[];
  target: EditTarget;
  existingRules: SeasonalRule[];
  onClose: () => void;
  onCreated: (rule: SeasonalRule) => void;
  onUpdated: (rule: SeasonalRule) => void;
}) {
  const initial =
    target.mode === "edit"
      ? target.rule
      : {
          listingId: target.listingId ?? listings[0]?.id ?? "",
          roomId: target.roomId ?? null,
          label: "",
          startDate: "",
          endDate: "",
          adjustmentType: "absolute" as "absolute" | "percent",
          adjustmentValue: 0,
          price: 0,
          currency: "ZAR",
          minNights: null as number | null,
          priority: 0,
          isActive: true,
        };

  const [listingId, setListingId] = useState(initial.listingId);
  const [roomId, setRoomId] = useState<string | null>(initial.roomId);
  const [label, setLabel] = useState(initial.label);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [adjustmentType, setAdjustmentType] = useState<"absolute" | "percent">(
    initial.adjustmentType ?? "absolute",
  );
  const [value, setValue] = useState(String(initial.adjustmentValue || ""));
  const [minNights, setMinNights] = useState(
    initial.minNights == null ? "" : String(initial.minNights),
  );
  const [priority, setPriority] = useState(String(initial.priority));
  const [isActive, setIsActive] = useState(initial.isActive);
  const [pending, start] = useTransition();

  const listing = listings.find((l) => l.id === listingId);
  const canPerRoom = listing?.bookingMode !== "whole_listing";

  // Reference base the rule is measured against — the room's own base when
  // scoped to a room, else the listing base. Drives the % preview + the
  // display nightly stored on the rule.
  const refBase =
    (roomId
      ? listing?.rooms.find((r) => r.id === roomId)?.basePrice
      : listing?.basePrice) ?? 0;
  const valueNum = Number(value) || 0;
  const displayNightly =
    adjustmentType === "absolute"
      ? valueNum
      : Math.max(0, refBase * (1 + valueNum / 100));

  const overlaps = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [];
    return existingRules.filter(
      (r) =>
        r.listingId === listingId &&
        r.roomId === roomId &&
        r.isActive &&
        (target.mode === "create" || r.id !== target.rule.id) &&
        rangesOverlap(startDate, endDate, r.startDate, r.endDate),
    );
  }, [existingRules, listingId, roomId, startDate, endDate, target]);

  const nights = nightsBetween(startDate, endDate);
  const total = nights * displayNightly;

  function submit() {
    const parsedValue = Number(value);
    if (adjustmentType === "absolute") {
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        toast.error("Price must be greater than 0.");
        return;
      }
    } else if (
      !Number.isFinite(parsedValue) ||
      parsedValue === 0 ||
      parsedValue < -100 ||
      parsedValue > 1000
    ) {
      toast.error("Use a percentage from -100 to 1000 (not 0).");
      return;
    }
    const parsedMin =
      minNights.trim() === "" ? null : Number.parseInt(minNights, 10);
    if (parsedMin != null && (!Number.isFinite(parsedMin) || parsedMin < 1)) {
      toast.error("Min nights must be 1 or more.");
      return;
    }
    const parsedPriority = Number.parseInt(priority, 10);
    if (!Number.isFinite(parsedPriority) || parsedPriority < 0) {
      toast.error("Priority must be 0 or more.");
      return;
    }

    const payload = {
      property_id: listingId,
      room_id: roomId,
      label: label.trim(),
      start_date: startDate,
      end_date: endDate,
      adjustment_type: adjustmentType,
      adjustment_value: parsedValue,
      currency: "ZAR",
      min_nights: parsedMin,
      priority: parsedPriority,
      is_active: isActive,
    };

    // Display nightly stored on the merged rule (keeps the preview correct
    // without a refetch). Recomputed here so percent rules resolve vs refBase.
    const mergedPrice =
      adjustmentType === "absolute"
        ? parsedValue
        : Math.max(0, refBase * (1 + parsedValue / 100));

    start(async () => {
      if (target.mode === "create") {
        const result = await createSeasonalRuleAction(payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        onCreated({
          id: result.data!.id,
          listingId,
          roomId,
          label: payload.label,
          startDate,
          endDate,
          adjustmentType,
          adjustmentValue: parsedValue,
          price: mergedPrice,
          currency: "ZAR",
          minNights: parsedMin,
          priority: parsedPriority,
          isActive,
        });
        toast.success("Season created");
      } else {
        const result = await updateSeasonalRuleAction(target.rule.id, payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        onUpdated({
          id: target.rule.id,
          listingId,
          roomId,
          label: payload.label,
          startDate,
          endDate,
          adjustmentType,
          adjustmentValue: parsedValue,
          price: mergedPrice,
          currency: "ZAR",
          minNights: parsedMin,
          priority: parsedPriority,
          isActive,
        });
        toast.success("Season saved");
      }
      onClose();
    });
  }

  return (
    <FormModal
      open
      onOpenChange={(o) => !o && onClose()}
      title={target.mode === "create" ? "New season" : "Edit season"}
      description="Override the nightly rate for a date range. Most-specific wins: room rules beat listing rules, then highest priority wins on overlap."
    >
      <div className="space-y-4">
        <Field label="Listing">
          <Select
            value={listingId}
            onValueChange={(v) => {
              setListingId(v);
              setRoomId(null);
            }}
            disabled={target.mode === "edit"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select listing" />
            </SelectTrigger>
            <SelectContent>
              {listings.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Apply to">
          <Select
            value={roomId ?? "__listing__"}
            onValueChange={(v) => setRoomId(v === "__listing__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__listing__">
                This listing (all rooms)
              </SelectItem>
              {canPerRoom &&
                listing?.rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="December holidays, Easter, Winter sale…"
            maxLength={80}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End date (inclusive)">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
            />
          </Field>
        </div>

        <Field label="Rate type">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdjustmentType("absolute")}
              className={`flex-1 rounded-card border px-3 py-2 text-sm font-medium transition-colors ${
                adjustmentType === "absolute"
                  ? "border-brand-primary bg-brand-accent text-brand-primary"
                  : "border-brand-line text-brand-mute hover:bg-brand-light"
              }`}
            >
              Set price
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentType("percent")}
              className={`flex-1 rounded-card border px-3 py-2 text-sm font-medium transition-colors ${
                adjustmentType === "percent"
                  ? "border-brand-primary bg-brand-accent text-brand-primary"
                  : "border-brand-line text-brand-mute hover:bg-brand-light"
              }`}
            >
              % change
            </button>
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label={
              adjustmentType === "absolute"
                ? "Price / night (ZAR)"
                : "Adjustment (%)"
            }
          >
            <Input
              type="number"
              inputMode="decimal"
              step={adjustmentType === "absolute" ? "0.01" : "1"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                adjustmentType === "absolute" ? "" : "e.g. 40 or -20"
              }
            />
          </Field>
          <Field label="Min nights (optional)">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Inherit"
              value={minNights}
              onChange={(e) => setMinNights(e.target.value)}
            />
          </Field>
          <Field label="Priority">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </Field>
        </div>

        {adjustmentType === "percent" && refBase > 0 && valueNum !== 0 && (
          <p className="text-[11px] text-brand-mute">
            ≈ {formatZAR(displayNightly)} / night against this{" "}
            {roomId ? "room" : "listing"}&rsquo;s {formatZAR(refBase)} base. The
            % scales your per-guest and extra-guest rates too.
          </p>
        )}

        <p className="text-[11px] text-brand-mute">
          Priority decides which season wins when two cover the same date. Layer
          a short peak (e.g. Christmas week, priority 10) over a longer season
          (December, priority 1).
        </p>

        <label className="flex items-center gap-2 text-sm text-brand-dark">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
          Active (counts toward booking prices)
        </label>

        {nights > 0 && displayNightly > 0 ? (
          <div className="rounded border border-brand-line bg-brand-light/40 px-3 py-2 text-xs text-brand-dark">
            <CalendarRange className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            {formatZAR(displayNightly)} × {nights} night
            {nights === 1 ? "" : "s"} ={" "}
            <strong className="font-semibold">{formatZAR(total)}</strong>
          </div>
        ) : null}

        {overlaps.length > 0 ? (
          <div className="flex gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              Overlaps with{" "}
              {overlaps
                .map(
                  (r) =>
                    `"${r.label}" (${fmtRange(r.startDate, r.endDate)}, priority ${r.priority})`,
                )
                .join(", ")}
              . The higher-priority season will apply on shared dates.
            </div>
          </div>
        ) : null}
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <Button
          type="button"
          onClick={submit}
          disabled={
            pending ||
            !listingId ||
            !label.trim() ||
            !startDate ||
            !endDate ||
            !value
          }
        >
          {pending
            ? "Saving…"
            : target.mode === "create"
              ? "Create season"
              : "Save season"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ════════════════════ CSV EXPORT ════════════════════
function exportCsv(
  listing: ListingGroup,
  rules: SeasonalRule[],
  today: string,
) {
  const header = [
    "Label",
    "Scope",
    "Start",
    "End",
    "Nights",
    "Price",
    "vs base %",
    "Min nights",
    "Priority",
    "Status",
  ];
  const rows = [...rules]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((r) => {
      const refBase = refBaseForRule(r, listing);
      const pct =
        refBase && refBase > 0
          ? Math.round(((r.price - refBase) / refBase) * 100)
          : "";
      const scope = r.roomId
        ? (listing.rooms.find((x) => x.id === r.roomId)?.name ?? "Room")
        : "Listing-wide";
      return [
        r.label,
        scope,
        r.startDate,
        r.endDate,
        String(nightsBetween(r.startDate, r.endDate)),
        String(r.price),
        pct === "" ? "" : String(pct),
        r.minNights == null ? "" : String(r.minNights),
        String(r.priority),
        statusFor(r, today),
      ];
    });

  const csv = [header, ...rows]
    .map((cols) =>
      cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");

  const blob = new Blob([`﻿${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seasons-${(listing.slug ?? listing.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
