"use client";

import {
  BedDouble,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  GanttChartSquare,
  Home as HomeIcon,
  Loader2,
  LogIn,
  LogOut,
  Lock,
  LockOpen,
  Moon,
  Plus,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import {
  type CalBlock,
  type CalBooking,
  type CalListing,
  type CalStatus,
  type SeasonalRange,
  addDays,
  DOW_MON,
  dateFromKey,
  fmtShort,
  MONTH_NAMES,
  monthDays,
  monthMatrix,
  nightsBetween,
  STATUS_META,
  vmoney,
} from "./calendar-data";
import { createManualBookingAction } from "../bookings/new/actions";
import type { ManualBookingInput } from "../quotes/schemas";

import { setManualBlocksAction, toggleBlockedDateAction } from "./actions";

type Props = {
  listings: CalListing[];
  bookings: CalBooking[];
  blocks: CalBlock[];
  seasonal: SeasonalRange[];
  today: string;
  refYear: number;
  refMonth: number;
};

type BlockRange = { listingId: string; ci: string; co: string; label: string };

// Coalesce per-day blocked dates (non-booking) into contiguous ranges per listing.
function buildBlockRanges(blocks: CalBlock[]): BlockRange[] {
  const byListing = new Map<string, CalBlock[]>();
  for (const b of blocks) {
    if (b.kind === "booking") continue; // the booking bar already shows this
    const arr = byListing.get(b.listingId) ?? [];
    arr.push(b);
    byListing.set(b.listingId, arr);
  }
  const out: BlockRange[] = [];
  for (const [listingId, arr] of byListing) {
    const dates = [...new Set(arr.map((b) => b.date))].sort();
    const labelByDate = new Map(
      arr.map((b) => [b.date, b.source ?? "Blocked"]),
    );
    let i = 0;
    while (i < dates.length) {
      let j = i;
      while (j + 1 < dates.length && addDays(dates[j], 1) === dates[j + 1]) j++;
      out.push({
        listingId,
        ci: dates[i],
        co: addDays(dates[j], 1),
        label: labelByDate.get(dates[i]) ?? "Blocked",
      });
      i = j + 1;
    }
  }
  return out;
}

type WeekEvent = {
  type: "bk" | "blk";
  ci: string;
  co: string;
  s: number;
  e: number;
  startsHere: boolean;
  endsHere: boolean;
  lane: number;
  booking?: CalBooking;
  label?: string;
};

const MAXLANE = 3;

export function CalendarWorkspace(props: Props) {
  const router = useRouter();
  const [curYear, setCurYear] = useState(props.refYear);
  const [curMonth, setCurMonth] = useState(props.refMonth);
  const [view, setView] = useState<"month" | "timeline">("month");
  const [filter, setFilter] = useState<string>("all");
  const [selDay, setSelDay] = useState<string>(props.today);
  const [blockOpen, setBlockOpen] = useState(false);
  // Range selection (check-in → check-out) drawn straight on the month grid.
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const hasRange = !!(rangeStart && rangeEnd && rangeEnd > rangeStart);

  const refresh = () => router.refresh();

  function clearRange() {
    setRangeStart(null);
    setRangeEnd(null);
  }

  // Click a day: 1st click sets the check-in anchor, 2nd (later) click sets
  // check-out. Clicking on/before the anchor restarts the selection.
  function pickDay(k: string) {
    setSelDay(k);
    if (!rangeStart || rangeEnd) {
      setRangeStart(k);
      setRangeEnd(null);
    } else if (k <= rangeStart) {
      setRangeStart(k);
      setRangeEnd(null);
    } else {
      setRangeEnd(k);
    }
  }

  // Listings shown in the right-rail availability panel follow the filter.
  const railListings = useMemo(
    () =>
      filter === "all"
        ? props.listings
        : props.listings.filter((l) => l.id === filter),
    [props.listings, filter],
  );

  const blockRanges = useMemo(
    () => buildBlockRanges(props.blocks),
    [props.blocks],
  );

  const bookings = useMemo(
    () =>
      filter === "all"
        ? props.bookings
        : props.bookings.filter((b) => b.listingId === filter),
    [props.bookings, filter],
  );
  const ranges = useMemo(
    () =>
      filter === "all"
        ? blockRanges
        : blockRanges.filter((b) => b.listingId === filter),
    [blockRanges, filter],
  );

  // ── Glance + header (per-listing occupancy this month) ──
  const glance = useMemo(() => {
    const n = new Date(curYear, curMonth + 1, 0).getDate();
    const monthStart = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-01`;
    const monthEndExcl = addDays(
      `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`,
      1,
    );
    return props.listings.map((l) => {
      const bks = props.bookings.filter(
        (b) => b.listingId === l.id && b.co > monthStart && b.ci < monthEndExcl,
      );
      let booked = 0;
      let rev = 0;
      for (const b of bks) {
        const s = b.ci < monthStart ? monthStart : b.ci;
        const e = b.co > monthEndExcl ? monthEndExcl : b.co;
        const nn = Math.max(0, nightsBetween(s, e));
        booked += nn;
        rev += nn * b.rate;
      }
      const cap = n * Math.max(1, l.rooms);
      return { l, booked, rev, occ: Math.round((booked / cap) * 100) };
    });
  }, [props.listings, props.bookings, curYear, curMonth]);

  const headerOcc = glance.length
    ? Math.round(glance.reduce((a, g) => a + g.occ, 0) / glance.length)
    : 0;
  const headerNights = glance.reduce((a, g) => a + g.booked, 0);

  function priceForDay(listingId: string, dayKey: string): number {
    const l = props.listings.find((x) => x.id === listingId);
    if (!l) return 0;
    const ovr = props.seasonal.find(
      (s) => s.listingId === listingId && dayKey >= s.start && dayKey <= s.end,
    );
    return ovr ? ovr.price : l.basePrice;
  }

  function shiftMonth(n: number) {
    let m = curMonth + n;
    let y = curYear;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setCurMonth(m);
    setCurYear(y);
  }
  function goToday() {
    setCurYear(props.refYear);
    setCurMonth(props.refMonth);
    setSelDay(props.today);
  }

  return (
    <div className="w-full">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-brand-ink">
            Calendar
          </h1>
          <p className="mt-1 text-[13.5px] text-brand-mute">
            <span className="font-semibold text-brand-ink">{headerOcc}%</span>{" "}
            occupancy this month ·{" "}
            <span className="font-semibold text-status-confirmed">
              {headerNights}
            </span>{" "}
            nights booked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/calendar-sync"
            className="hidden h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light sm:inline-flex"
          >
            <SlidersHorizontal className="h-4 w-4 text-brand-mute" /> Sync &
            rates
          </Link>
          <button
            onClick={() => setBlockOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <Lock className="h-4 w-4 text-brand-mute" /> Block dates
          </button>
          <Link
            href="/dashboard/bookings/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-5 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" /> New booking
          </Link>
        </div>
      </div>

      {/* toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-card border border-brand-line bg-[#FBFDFC] px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light"
            title="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-[150px] text-center font-display text-[16px] font-bold text-brand-ink">
            {MONTH_NAMES[curMonth]} {curYear}
          </h2>
          <button
            onClick={() => shiftMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light"
            title="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="ml-1 inline-flex h-9 items-center rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light"
        >
          Today
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill
              active={filter === "all"}
              onClick={() => setFilter("all")}
              icon
              label="All listings"
            />
            {props.listings.map((l) => (
              <FilterPill
                key={l.id}
                active={filter === l.id}
                onClick={() => setFilter(l.id)}
                tone={l.tone}
                label={l.name.replace(/^The /, "")}
              />
            ))}
          </div>
          <div className="inline-flex items-center rounded-pill border border-brand-line bg-[#F4F8F5] p-[3px]">
            <SegBtn
              active={view === "month"}
              onClick={() => setView("month")}
              icon={<CalendarDays className="h-4 w-4" />}
              label="Month"
            />
            <SegBtn
              active={view === "timeline"}
              onClick={() => setView("timeline")}
              icon={<GanttChartSquare className="h-4 w-4" />}
              label="Timeline"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        {/* calendar */}
        <div className="min-w-0">
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            {view === "month" ? (
              <MonthView
                year={curYear}
                month={curMonth}
                today={props.today}
                selDay={selDay}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                bookings={bookings}
                ranges={ranges}
                filter={filter}
                priceForDay={priceForDay}
                listings={props.listings}
                onSelectDay={pickDay}
                onOpenBooking={(id) => router.push(`/dashboard/bookings/${id}`)}
              />
            ) : (
              <TimelineView
                year={curYear}
                month={curMonth}
                today={props.today}
                listings={
                  filter === "all"
                    ? props.listings
                    : props.listings.filter((l) => l.id === filter)
                }
                bookings={bookings}
                ranges={ranges}
                onOpenBooking={(id) => router.push(`/dashboard/bookings/${id}`)}
              />
            )}
          </section>

          {/* legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[12px] text-brand-mute">
            <span className="font-semibold text-brand-ink">Status</span>
            {(
              ["confirmed", "pending", "inhouse", "completed"] as CalStatus[]
            ).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: STATUS_META[s].color }}
                />
                {STATUS_META[s].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background:
                    "repeating-linear-gradient(45deg,#9CA3AF,#9CA3AF 3px,#cbd0d6 3px,#cbd0d6 6px)",
                }}
              />
              Blocked
            </span>
            <span className="hidden items-center gap-1.5 sm:ml-auto sm:inline-flex">
              <CalendarPlus className="h-3.5 w-3.5 text-brand-primary" />
              Tap two days to block or book a range
            </span>
          </div>
        </div>

        {/* right rail */}
        <div className="space-y-6">
          {hasRange ? (
            <RangeActionCard
              checkIn={rangeStart!}
              checkOut={rangeEnd!}
              listings={props.listings}
              defaultListingId={filter === "all" ? undefined : filter}
              bookings={props.bookings}
              blocks={props.blocks}
              priceForDay={priceForDay}
              onChanged={refresh}
              onClear={clearRange}
            />
          ) : null}
          <DayRail
            selDay={selDay}
            bookings={bookings}
            listings={props.listings}
            onOpenBooking={(id) => router.push(`/dashboard/bookings/${id}`)}
          />
          {hasRange ? null : (
            <DayAvailability
              selDay={selDay}
              today={props.today}
              listings={railListings}
              bookings={bookings}
              blocks={props.blocks}
              onChanged={refresh}
              onOpenBooking={(id) => router.push(`/dashboard/bookings/${id}`)}
            />
          )}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              This month at a glance
            </div>
            <div className="divide-y divide-brand-line">
              {glance.map((g) => (
                <div key={g.l.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-brand-ink">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: g.l.tone }}
                      />
                      <span className="truncate">{g.l.name}</span>
                    </span>
                    <span className="shrink-0 text-[12.5px] font-semibold text-brand-mute">
                      {g.occ}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-brand-light">
                    <div
                      className="h-full rounded-pill"
                      style={{ width: `${g.occ}%`, background: g.l.tone }}
                    />
                  </div>
                  <div className="mt-1.5 text-[11.5px] text-brand-mute">
                    {g.booked} nights · {vmoney(g.rev)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <BlockRangeModal
        open={blockOpen}
        onOpenChange={setBlockOpen}
        listings={props.listings}
        defaultListingId={filter === "all" ? props.listings[0]?.id : filter}
        today={props.today}
        onChanged={refresh}
      />
    </div>
  );
}

// ── Month view ──────────────────────────────────────────────────────────
function MonthView({
  year,
  month,
  today,
  selDay,
  rangeStart,
  rangeEnd,
  bookings,
  ranges,
  filter,
  priceForDay,
  listings,
  onSelectDay,
  onOpenBooking,
}: {
  year: number;
  month: number;
  today: string;
  selDay: string;
  rangeStart: string | null;
  rangeEnd: string | null;
  bookings: CalBooking[];
  ranges: BlockRange[];
  filter: string;
  priceForDay: (listingId: string, dayKey: string) => number;
  listings: CalListing[];
  onSelectDay: (k: string) => void;
  onOpenBooking: (id: string) => void;
}) {
  const matrix = monthMatrix(year, month);
  const singleBase =
    filter !== "all"
      ? (listings.find((l) => l.id === filter)?.basePrice ?? 0)
      : 0;

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-brand-line">
        {DOW_MON.map((d) => (
          <div
            key={d}
            className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#7C9A8C]"
          >
            {d}
          </div>
        ))}
      </div>
      {matrix.map((week, wi) => {
        const wKeys = week.map((d) => d.key);
        const wStart = wKeys[0];
        const wEnd = wKeys[6];
        const evs: WeekEvent[] = [];
        for (const b of bookings)
          if (b.co > wStart && b.ci <= wEnd)
            evs.push({
              type: "bk",
              ci: b.ci,
              co: b.co,
              booking: b,
              s: 0,
              e: 0,
              startsHere: false,
              endsHere: false,
              lane: 0,
            });
        for (const r of ranges)
          if (r.co > wStart && r.ci <= wEnd)
            evs.push({
              type: "blk",
              ci: r.ci,
              co: r.co,
              label: r.label,
              s: 0,
              e: 0,
              startsHere: false,
              endsHere: false,
              lane: 0,
            });
        for (const e of evs) {
          const lastNight = addDays(e.co, -1);
          let s = wKeys.indexOf(e.ci);
          let en = wKeys.indexOf(lastNight);
          e.startsHere = s >= 0;
          e.endsHere = en >= 0;
          if (s < 0) s = 0;
          if (en < 0) en = 6;
          e.s = s;
          e.e = en;
        }
        evs.sort((a, b) => a.s - b.s || b.e - b.s - (a.e - a.s));
        const lanes: { s: number; e: number }[][] = [];
        for (const e of evs) {
          let placed = false;
          for (let li = 0; li < lanes.length; li++) {
            if (lanes[li].every((r) => e.s > r.e || e.e < r.s)) {
              lanes[li].push({ s: e.s, e: e.e });
              e.lane = li;
              placed = true;
              break;
            }
          }
          if (!placed) {
            lanes.push([{ s: e.s, e: e.e }]);
            e.lane = lanes.length - 1;
          }
        }
        const usedLanes = Math.min(lanes.length, MAXLANE);
        const overflow = new Array(7).fill(0) as number[];
        for (const e of evs)
          if (e.lane >= MAXLANE) for (let c = e.s; c <= e.e; c++) overflow[c]++;
        const minH =
          34 + (usedLanes + (lanes.length > MAXLANE ? 1 : 0)) * 24 + 8;

        return (
          <div
            key={wi}
            className="relative border-b border-[#EDF3EF] last:border-b-0"
          >
            <div className="grid grid-cols-7">
              {week.map((d) => {
                const isToday = d.key === today;
                const isSel = d.key === selDay && !isToday;
                const inRange =
                  !!rangeStart &&
                  !!rangeEnd &&
                  d.key >= rangeStart &&
                  d.key <= rangeEnd;
                const showPrice = filter !== "all" && d.inMonth;
                const price = showPrice ? priceForDay(filter, d.key) : 0;
                const over = showPrice && price > singleBase;
                return (
                  <div
                    key={d.key}
                    className={`border-r border-[#EDF3EF] px-2 pb-1 pt-2 last:border-r-0 ${
                      inRange
                        ? "bg-brand-primary/[0.08]"
                        : !d.inMonth
                          ? "bg-[#FBFCFB]"
                          : d.isWeekend
                            ? "bg-[#FAFCFA]"
                            : ""
                    }`}
                    style={{ minHeight: Math.max(118, minH) }}
                  >
                    {showPrice ? (
                      <span
                        className={`float-right mt-1 text-[10px] font-semibold tabular-nums ${over ? "text-amber-700" : "text-[#9DB6AA]"}`}
                      >
                        {vmoney(price)}
                      </span>
                    ) : null}
                    <button
                      onClick={() => onSelectDay(d.key)}
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-semibold tabular-nums ${
                        isToday
                          ? "bg-brand-primary text-white"
                          : isSel
                            ? "text-brand-secondary shadow-[0_0_0_2px_#10B981_inset]"
                            : d.inMonth
                              ? "text-[#3A5A4E] hover:bg-brand-light"
                              : "text-[#A9C2B5] hover:bg-brand-light"
                      }`}
                    >
                      {d.day}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* lanes overlay */}
            <div
              className="pointer-events-none absolute inset-x-0 flex flex-col gap-[3px]"
              style={{ top: 34 }}
            >
              {Array.from({ length: usedLanes }).map((_, li) => (
                <div key={li} className="grid grid-cols-7">
                  {evs
                    .filter((e) => e.lane === li)
                    .map((e, idx) => (
                      <div
                        key={idx}
                        style={{ gridColumn: `${e.s + 1} / ${e.e + 2}` }}
                      >
                        {e.type === "blk" ? (
                          <div
                            className={`pointer-events-auto mx-0.5 flex h-[21px] items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold text-white ${e.startsHere ? "" : "rounded-l-none"} ${e.endsHere ? "" : "rounded-r-none"}`}
                            style={{
                              background:
                                "repeating-linear-gradient(45deg,#9CA3AF,#9CA3AF 5px,#aeb5bd 5px,#aeb5bd 10px)",
                            }}
                            title={e.label}
                          >
                            <Lock className="h-3 w-3 shrink-0" />
                            <span className="truncate">{e.label}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => onOpenBooking(e.booking!.id)}
                            className={`pointer-events-auto mx-0.5 flex h-[21px] w-[calc(100%-4px)] items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(6,78,59,.18)] hover:brightness-110 ${e.startsHere ? "" : "rounded-l-none"} ${e.endsHere ? "" : "rounded-r-none"}`}
                            style={{
                              background: STATUS_META[e.booking!.status].color,
                            }}
                            title={`${e.booking!.guest} · ${fmtShort(e.booking!.ci)}–${fmtShort(e.booking!.co)} · ${STATUS_META[e.booking!.status].label}`}
                          >
                            {e.startsHere && e.booking!.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={e.booking!.avatar}
                                alt=""
                                className="h-3.5 w-3.5 shrink-0 rounded-full object-cover ring-1 ring-white/50"
                              />
                            ) : null}
                            <span className="truncate">{e.booking!.guest}</span>
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              ))}
              {lanes.length > MAXLANE ? (
                <div className="grid grid-cols-7">
                  {week.map((d, ci) =>
                    overflow[ci] > 0 ? (
                      <div
                        key={ci}
                        style={{ gridColumn: `${ci + 1} / ${ci + 2}` }}
                      >
                        <button
                          onClick={() => onSelectDay(d.key)}
                          className="pointer-events-auto mx-0.5 px-1.5 text-[10.5px] font-bold text-brand-mute hover:text-brand-secondary"
                        >
                          +{overflow[ci]}
                        </button>
                      </div>
                    ) : null,
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline view ───────────────────────────────────────────────────────
function TimelineView({
  year,
  month,
  today,
  listings,
  bookings,
  ranges,
  onOpenBooking,
}: {
  year: number;
  month: number;
  today: string;
  listings: CalListing[];
  bookings: CalBooking[];
  ranges: BlockRange[];
  onOpenBooking: (id: string) => void;
}) {
  const days = monthDays(year, month);
  const n = days.length;
  const monthStart = dateFromKey(days[0].key).getTime();

  const barStyle = (ci: string, co: string) => {
    const startIdx = Math.max(
      0,
      Math.round((dateFromKey(ci).getTime() - monthStart) / 86_400_000),
    );
    const endIdx = Math.min(
      n,
      Math.round((dateFromKey(co).getTime() - monthStart) / 86_400_000),
    );
    if (endIdx <= 0 || startIdx >= n) return null;
    return {
      left: `${(startIdx / n) * 100}%`,
      width: `calc(${((endIdx - startIdx) / n) * 100}% - 4px)`,
      marginLeft: "2px",
    };
  };

  return (
    <div className="thin-scroll overflow-x-auto">
      <div style={{ minWidth: 200 + n * 36 }}>
        {/* header row */}
        <div className="grid grid-cols-[200px_1fr] border-b border-brand-line">
          <div />
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${n},minmax(34px,1fr))` }}
          >
            {days.map((d) => {
              const tdy = d.key === today;
              const we = d.dow >= 5;
              return (
                <div
                  key={d.key}
                  className={`py-2.5 text-center text-[10.5px] font-bold tabular-nums ${
                    tdy
                      ? "rounded-t-lg bg-brand-primary text-white"
                      : we
                        ? "bg-[#FAFCFA] text-[#7C9A8C]"
                        : "text-[#7C9A8C]"
                  }`}
                >
                  {d.day}
                </div>
              );
            })}
          </div>
        </div>

        {/* listing rows */}
        {listings.map((l) => {
          const bks = bookings.filter((b) => b.listingId === l.id);
          const blk = ranges.filter((b) => b.listingId === l.id);
          return (
            <div key={l.id} className="grid grid-cols-[200px_1fr]">
              <div className="flex items-center gap-2.5 border-t border-[#EDF3EF] p-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: l.tone }}
                />
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                    {l.name}
                  </div>
                  <div className="truncate text-[11.5px] text-brand-mute">
                    {l.location}
                  </div>
                </div>
              </div>
              <div className="relative h-16 border-t border-[#EDF3EF]">
                <div
                  className="absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${n},minmax(34px,1fr))`,
                  }}
                >
                  {days.map((d) => (
                    <div
                      key={d.key}
                      className={`border-l border-[#F1F6F3] ${d.dow >= 5 ? "bg-[#FAFCFA]" : ""}`}
                    />
                  ))}
                </div>
                {bks.map((b) => {
                  const st = barStyle(b.ci, b.co);
                  if (!st) return null;
                  return (
                    <button
                      key={b.id}
                      onClick={() => onOpenBooking(b.id)}
                      className="absolute top-[11px] flex h-[42px] items-center gap-1.5 overflow-hidden rounded-[9px] px-2 text-[11.5px] font-semibold text-white shadow-[0_2px_6px_rgba(6,78,59,.18)] hover:brightness-110"
                      style={{ ...st, background: STATUS_META[b.status].color }}
                      title={`${b.guest} · ${fmtShort(b.ci)}–${fmtShort(b.co)}`}
                    >
                      {b.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.avatar}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded-full object-cover ring-2 ring-white/45"
                        />
                      ) : null}
                      <span className="truncate">{b.guest}</span>
                    </button>
                  );
                })}
                {blk.map((r, i) => {
                  const st = barStyle(r.ci, r.co);
                  if (!st) return null;
                  return (
                    <div
                      key={i}
                      className="absolute top-[11px] flex h-[42px] items-center gap-1.5 overflow-hidden rounded-[9px] px-2 text-[11.5px] font-semibold text-white"
                      style={{
                        ...st,
                        background:
                          "repeating-linear-gradient(45deg,#9CA3AF,#9CA3AF 6px,#aeb5bd 6px,#aeb5bd 12px)",
                      }}
                      title={r.label}
                    >
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Right rail (selected day) ───────────────────────────────────────────
function DayRail({
  selDay,
  bookings,
  listings,
  onOpenBooking,
}: {
  selDay: string;
  bookings: CalBooking[];
  listings: CalListing[];
  onOpenBooking: (id: string) => void;
}) {
  const dt = dateFromKey(selDay);
  const arrivals = bookings.filter((b) => b.ci === selDay);
  const departures = bookings.filter((b) => b.co === selDay);
  const inhouse = bookings.filter((b) => b.ci < selDay && b.co > selDay);
  const total = arrivals.length + departures.length + inhouse.length;

  const Row = ({
    b,
    kind,
  }: {
    b: CalBooking;
    kind: "arr" | "dep" | "stay";
  }) => {
    const lst = listings.find((l) => l.id === b.listingId);
    const Ico = kind === "arr" ? LogIn : kind === "dep" ? LogOut : BedDouble;
    const icoCls =
      kind === "arr"
        ? "text-status-confirmed"
        : kind === "dep"
          ? "text-status-pending"
          : "text-status-inhouse";
    return (
      <button
        onClick={() => onOpenBooking(b.id)}
        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition hover:bg-[#FAFCFB]"
      >
        {b.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.avatar}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[11px] font-bold text-white">
            {b.guest
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-brand-ink">
            {b.guest}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-brand-mute">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: lst?.tone ?? "#94A3B8" }}
            />
            <span className="truncate">
              {lst?.name ?? "Listing"} · {b.guests} guests
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Ico className={`h-4 w-4 ${icoCls}`} />
          <span
            className="rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold"
            style={{
              borderColor: STATUS_META[b.status].soft,
              background: STATUS_META[b.status].soft,
              color: STATUS_META[b.status].ink,
            }}
          >
            {STATUS_META[b.status].label}
          </span>
        </div>
      </button>
    );
  };

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="border-b border-brand-line px-5 py-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          Selected day
        </div>
        <div className="mt-1 font-display text-[18px] font-bold text-brand-ink">
          {DOW_MON[(dt.getDay() + 6) % 7]}, {dt.getDate()}{" "}
          {MONTH_NAMES[dt.getMonth()]}
        </div>
        <div className="mt-1 text-[12.5px] text-brand-mute">
          {arrivals.length} arrivals · {departures.length} departures ·{" "}
          {inhouse.length} in-house
        </div>
      </div>
      <div className="p-2.5">
        {total === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-brand-mute">
            <Moon className="mx-auto mb-2 h-6 w-6 text-brand-mute/60" />
            No movements — open night.
            <div className="mt-3">
              <Link
                href="/dashboard/bookings/new"
                className="text-[12.5px] font-semibold text-brand-primary hover:underline"
              >
                Add a booking →
              </Link>
            </div>
          </div>
        ) : (
          <>
            {arrivals.length ? (
              <RailSection title="Arriving">
                {arrivals.map((b) => (
                  <Row key={b.id} b={b} kind="arr" />
                ))}
              </RailSection>
            ) : null}
            {departures.length ? (
              <RailSection title="Departing">
                {departures.map((b) => (
                  <Row key={b.id} b={b} kind="dep" />
                ))}
              </RailSection>
            ) : null}
            {inhouse.length ? (
              <RailSection title="Staying over">
                {inhouse.map((b) => (
                  <Row key={b.id} b={b} kind="stay" />
                ))}
              </RailSection>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function RailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {title}
      </div>
      {children}
    </>
  );
}

// ── Selected-day availability (block · unblock · quick-book) ────────────
function DayAvailability({
  selDay,
  today,
  listings,
  bookings,
  blocks,
  onChanged,
  onOpenBooking,
}: {
  selDay: string;
  today: string;
  listings: CalListing[];
  bookings: CalBooking[];
  blocks: CalBlock[];
  onChanged: () => void;
  onOpenBooking: (id: string) => void;
}) {
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const dt = dateFromKey(selDay);
  const isPast = selDay < today;

  function toggle(listingId: string) {
    setBusyId(listingId);
    start(async () => {
      const res = await toggleBlockedDateAction(listingId, selDay, null);
      setBusyId(null);
      if (res.ok) {
        toast.success(res.data.nowBlocked ? "Date blocked." : "Date opened.");
        onChanged();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-brand-line px-5 py-3.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          Availability · {dt.getDate()} {MONTH_NAMES[dt.getMonth()].slice(0, 3)}
        </span>
        {isPast ? (
          <span className="text-[10.5px] font-semibold text-brand-mute">
            Past date
          </span>
        ) : null}
      </div>
      <div className="divide-y divide-brand-line">
        {listings.map((l) => {
          const booking = bookings.find(
            (b) =>
              b.listingId === l.id &&
              b.status !== "cancelled" &&
              b.ci <= selDay &&
              selDay < b.co,
          );
          const dayBlocks = blocks.filter(
            (b) => b.listingId === l.id && b.date === selDay,
          );
          // Prefer a listing-wide block; fall back to any room-scoped one.
          const block =
            dayBlocks.find((b) => b.roomId === null) ?? dayBlocks[0] ?? null;
          const busy = pending && busyId === l.id;
          const firstName = booking ? booking.guest.split(/\s+/)[0] : "";

          // Right-hand cell. Past dates are read-only (no point blocking or
          // booking a night that has already gone).
          let right: React.ReactNode;
          if (booking) {
            const pill = (
              <>
                {firstName} · {STATUS_META[booking.status].label}
              </>
            );
            right = isPast ? (
              <span
                className="shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: STATUS_META[booking.status].soft,
                  color: STATUS_META[booking.status].ink,
                }}
              >
                {pill}
              </span>
            ) : (
              <button
                onClick={() => onOpenBooking(booking.id)}
                className="shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold transition hover:brightness-95"
                style={{
                  background: STATUS_META[booking.status].soft,
                  color: STATUS_META[booking.status].ink,
                }}
                title="Open booking"
              >
                {pill}
              </button>
            );
          } else if (block && block.kind !== "manual") {
            right = (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-brand-light px-2.5 py-1 text-[11px] font-semibold text-brand-mute">
                <Lock className="h-3 w-3" />
                {block.kind === "quote"
                  ? "On hold"
                  : (block.source ?? "Blocked")}
              </span>
            );
          } else if (block) {
            // Manual block — host can open it back up (also for past dates).
            right = (
              <button
                onClick={() => toggle(l.id)}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LockOpen className="h-3.5 w-3.5 text-brand-mute" />
                )}
                Open up
              </button>
            );
          } else if (isPast) {
            right = (
              <span className="shrink-0 text-[11.5px] font-medium text-brand-mute">
                Open
              </span>
            );
          } else {
            right = (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => toggle(l.id)}
                  disabled={busy}
                  title="Block this night"
                  className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-brand-mute" />
                  )}
                  Block
                </button>
                <Link
                  href={`/dashboard/bookings/new?listing=${l.id}&checkIn=${selDay}`}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-brand-secondary"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Book
                </Link>
              </div>
            );
          }

          return (
            <div
              key={l.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold text-brand-ink">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: l.tone }}
                />
                <span className="truncate">{l.name}</span>
              </span>
              {right}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Block a date range (listing-wide manual blocks) ─────────────────────
function datesInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let d = from;
  let guard = 0;
  while (d <= to && guard < 367) {
    out.push(d);
    d = addDays(d, 1);
    guard++;
  }
  return out;
}

function BlockRangeModal({
  open,
  onOpenChange,
  listings,
  defaultListingId,
  today,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listings: CalListing[];
  defaultListingId?: string;
  today: string;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [listingId, setListingId] = useState(defaultListingId ?? "");
  const [mode, setMode] = useState<"block" | "open">("block");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  // Reset to a clean slate each time the dialog opens.
  useEffect(() => {
    if (open) {
      setListingId(defaultListingId ?? listings[0]?.id ?? "");
      setMode("block");
      setFrom(today);
      setTo(today);
    }
  }, [open, defaultListingId, today, listings]);

  const count = to >= from ? datesInclusive(from, to).length : 0;

  function submit() {
    if (!listingId) {
      toast.error("Pick a listing.");
      return;
    }
    if (to < from) {
      toast.error("The end date is before the start date.");
      return;
    }
    const list = datesInclusive(from, to);
    start(async () => {
      const res = await setManualBlocksAction(
        listingId,
        list,
        mode === "block",
      );
      if (res.ok) {
        toast.success(
          mode === "block"
            ? `Blocked ${list.length} night${list.length === 1 ? "" : "s"}.`
            : "Those nights are open again.",
        );
        onChanged();
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Block dates"
      description="Hold nights off the calendar for maintenance, owner stays or any reason. Booked and quote-held nights are left untouched."
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
            Listing
          </label>
          <select
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
          >
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex w-full rounded-pill border border-brand-line bg-[#F4F8F5] p-[3px]">
          {(["block", "open"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-pill px-3 py-1.5 text-[12.5px] font-semibold transition ${
                mode === m
                  ? "bg-white text-brand-secondary shadow-[0_1px_2px_rgba(6,78,59,.12)]"
                  : "text-brand-mute"
              }`}
            >
              {m === "block" ? "Block nights" : "Open nights"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              From
            </label>
            <input
              type="date"
              value={from}
              min={today}
              onChange={(e) => {
                setFrom(e.target.value);
                if (to < e.target.value) setTo(e.target.value);
              }}
              className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              To
            </label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
            />
          </div>
        </div>

        <p className="text-[12.5px] text-brand-mute">
          {count > 0
            ? `${mode === "block" ? "Blocking" : "Opening"} ${count} night${count === 1 ? "" : "s"}${from === to ? "" : ` · ${fmtShort(from)} – ${fmtShort(to)}`}.`
            : "Pick a start and end date."}
        </p>
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <button
          type="button"
          onClick={submit}
          disabled={pending || count === 0}
          className="inline-flex items-center gap-2 rounded-pill bg-brand-primary px-5 py-2 text-[13.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "block" ? "Block dates" : "Open dates"}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}

// ── Range selection action card (block · quick-book, no page change) ─────
function RangeActionCard({
  checkIn,
  checkOut,
  listings,
  defaultListingId,
  bookings,
  blocks,
  priceForDay,
  onChanged,
  onClear,
}: {
  checkIn: string;
  checkOut: string;
  listings: CalListing[];
  defaultListingId?: string;
  bookings: CalBooking[];
  blocks: CalBlock[];
  priceForDay: (listingId: string, dayKey: string) => number;
  onChanged: () => void;
  onClear: () => void;
}) {
  const [pending, start] = useTransition();
  const [listingId, setListingId] = useState(
    defaultListingId ?? listings[0]?.id ?? "",
  );
  const [bookOpen, setBookOpen] = useState(false);

  const listing = listings.find((l) => l.id === listingId) ?? null;
  const nights = nightsBetween(checkIn, checkOut);
  // The nights the stay occupies: [check-in, check-out).
  const nightCells = datesInclusive(checkIn, addDays(checkOut, -1));
  const rate = listing ? priceForDay(listing.id, checkIn) : 0;
  const estTotal = rate * nights + (listing?.cleaningFee ?? 0);

  const bookedNights = nightCells.filter((d) =>
    bookings.some(
      (b) =>
        b.listingId === listingId &&
        b.status !== "cancelled" &&
        b.ci <= d &&
        d < b.co,
    ),
  ).length;
  const blockedNights = nightCells.filter((d) =>
    blocks.some((b) => b.listingId === listingId && b.date === d),
  ).length;
  const hasConflict = bookedNights > 0 || blockedNights > 0;

  function blockRange() {
    if (!listingId) return;
    start(async () => {
      const res = await setManualBlocksAction(listingId, nightCells, true);
      if (res.ok) {
        toast.success(
          `Blocked ${nights} night${nights === 1 ? "" : "s"} at ${listing?.name ?? "this listing"}.`,
        );
        onChanged();
        onClear();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-card border border-brand-primary/40 bg-white shadow-card">
      <div className="flex items-start justify-between gap-2 border-b border-brand-line bg-brand-light/50 px-5 py-3.5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-secondary">
            Selected range
          </div>
          <div className="mt-1 font-display text-[16px] font-bold text-brand-ink">
            {fmtShort(checkIn)} → {fmtShort(checkOut)}
          </div>
          <div className="mt-0.5 text-[12px] text-brand-mute">
            {nights} night{nights === 1 ? "" : "s"}
          </div>
        </div>
        <button
          onClick={onClear}
          title="Clear selection"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-brand-mute transition hover:bg-brand-light"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 p-5">
        {listings.length > 1 ? (
          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold text-brand-ink">
              Listing
            </label>
            <select
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              className="w-full rounded-[11px] border border-brand-line bg-white px-3 py-2.5 text-[13.5px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-brand-ink">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: listing?.tone }}
            />
            {listing?.name}
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl bg-brand-light/60 px-3.5 py-2.5 text-[12.5px]">
          <span className="text-brand-mute">
            {vmoney(rate)} × {nights} + cleaning
          </span>
          <span className="font-bold text-brand-ink">~{vmoney(estTotal)}</span>
        </div>

        {hasConflict ? (
          <div className="rounded-xl bg-status-pending/10 px-3.5 py-2.5 text-[12px] font-medium text-status-pending">
            {bookedNights > 0
              ? `${bookedNights} of these nights ${bookedNights === 1 ? "is" : "are"} already booked.`
              : `${blockedNights} of these nights ${blockedNights === 1 ? "is" : "are"} already blocked.`}{" "}
            Pick a free range to create a booking.
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={blockRange}
            disabled={pending || !listingId}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-2.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4 text-brand-mute" />
            )}
            Block
          </button>
          <button
            onClick={() => setBookOpen(true)}
            disabled={!listingId || hasConflict}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-50"
          >
            <CalendarPlus className="h-4 w-4" /> Create booking
          </button>
        </div>

        <Link
          href={`/dashboard/bookings/new?listing=${listingId}&checkIn=${checkIn}&checkOut=${checkOut}`}
          className="block text-center text-[12px] font-semibold text-brand-primary hover:underline"
        >
          More options (rooms, add-ons…) →
        </Link>
      </div>

      {listing ? (
        <QuickBookModal
          open={bookOpen}
          onOpenChange={setBookOpen}
          listing={listing}
          checkIn={checkIn}
          checkOut={checkOut}
          defaultRate={rate}
          onCreated={() => {
            setBookOpen(false);
            onChanged();
            onClear();
          }}
        />
      ) : null}
    </section>
  );
}

// ── Inline quick-book — stays on the calendar, posts to the SSOT action ──
function QuickBookModal({
  open,
  onOpenChange,
  listing,
  checkIn,
  checkOut,
  defaultRate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listing: CalListing;
  checkIn: string;
  checkOut: string;
  defaultRate: number;
  onCreated: () => void;
}) {
  const [pending, start] = useTransition();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guests, setGuests] = useState(2);
  const [rate, setRate] = useState(String(defaultRate));
  const [cleaning, setCleaning] = useState(String(listing.cleaningFee));
  const [payState, setPayState] =
    useState<ManualBookingInput["payment_state"]>("paid");

  useEffect(() => {
    if (open) {
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setGuests(2);
      setRate(String(defaultRate));
      setCleaning(String(listing.cleaningFee));
      setPayState("paid");
    }
  }, [open, defaultRate, listing.cleaningFee]);

  const nights = nightsBetween(checkIn, checkOut);
  const base = (parseFloat(rate) || 0) * nights;
  const total = base + (parseFloat(cleaning) || 0);

  function submit() {
    if (!guestName.trim()) {
      toast.error("Add the guest's name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(guestEmail.trim())) {
      toast.error("Add a valid guest email.");
      return;
    }
    if (base <= 0) {
      toast.error("Set a nightly rate.");
      return;
    }
    const input: ManualBookingInput = {
      listing_id: listing.id,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim(),
      guest_phone: guestPhone.trim(),
      check_in: checkIn,
      check_out: checkOut,
      headcount: guests,
      scope: "whole_listing",
      base_amount: base,
      cleaning_fee: parseFloat(cleaning) || 0,
      currency: "ZAR",
      rooms: [],
      addons: [],
      notes: "",
      payment_state: payState,
      payment_note: "",
      internal_note: "",
    };
    start(async () => {
      const res = await createManualBookingAction(input);
      if (res.ok) {
        toast.success(
          payState === "send_paystack_link"
            ? "Booking created — send the payment link from the booking."
            : "Booking created.",
        );
        onCreated();
      } else {
        toast.error(res.error);
      }
    });
  }

  const PAY_OPTS: {
    value: ManualBookingInput["payment_state"];
    label: string;
  }[] = [
    { value: "paid", label: "Already paid" },
    { value: "unpaid", label: "Collect later" },
    { value: "send_paystack_link", label: "Send payment link" },
  ];

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="New booking"
      description={`${listing.name} · ${fmtShort(checkIn)} → ${fmtShort(checkOut)} · ${nights} night${nights === 1 ? "" : "s"}`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              Guest name
            </label>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              Email
            </label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="guest@email.com"
              className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              Phone{" "}
              <span className="font-normal text-brand-mute">(optional)</span>
            </label>
            <input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+27…"
              className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              Guests
            </label>
            <input
              type="number"
              min={1}
              value={guests}
              onChange={(e) =>
                setGuests(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              Rate / night
            </label>
            <input
              type="number"
              min={0}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              Cleaning
            </label>
            <input
              type="number"
              min={0}
              value={cleaning}
              onChange={(e) => setCleaning(e.target.value)}
              className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
            Payment
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PAY_OPTS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setPayState(o.value)}
                className={`rounded-[11px] border px-2 py-2.5 text-[12px] font-semibold transition ${
                  payState === o.value
                    ? "border-brand-primary bg-brand-light text-brand-secondary"
                    : "border-brand-line bg-white text-brand-ink hover:bg-brand-light/60"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-brand-light/60 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
            <Wallet className="h-4 w-4 text-brand-mute" /> Total
          </span>
          <span className="font-display text-[18px] font-bold text-brand-ink">
            {vmoney(total)}
          </span>
        </div>

        <Link
          href={`/dashboard/bookings/new?listing=${listing.id}&checkIn=${checkIn}&checkOut=${checkOut}`}
          className="block text-center text-[12px] font-semibold text-brand-primary hover:underline"
        >
          Need rooms, add-ons or discounts? Open the full editor →
        </Link>
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-pill bg-brand-primary px-5 py-2 text-[13.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create booking
        </button>
      </FormModalFooter>
    </FormModal>
  );
}

// ── small bits ──────────────────────────────────────────────────────────
function FilterPill({
  active,
  onClick,
  label,
  tone,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: string;
  icon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-[34px] items-center gap-2 rounded-[9px] border px-3 text-[12.5px] font-medium transition ${
        active
          ? "border-brand-primary bg-brand-light font-semibold text-brand-secondary"
          : "border-brand-line bg-white text-[#3A5A4E] hover:bg-[#F7FBF8]"
      }`}
    >
      {tone ? (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: tone }}
        />
      ) : icon ? (
        <HomeIcon className="h-3.5 w-3.5" />
      ) : null}
      <span className="max-w-[140px] truncate">{label}</span>
    </button>
  );
}

function SegBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-[30px] items-center gap-1.5 rounded-pill px-3.5 text-[12.5px] font-semibold transition ${
        active
          ? "bg-white text-brand-secondary shadow-[0_1px_2px_rgba(6,78,59,.12)]"
          : "text-brand-mute"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
