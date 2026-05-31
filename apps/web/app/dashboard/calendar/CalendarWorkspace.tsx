"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setManualBlocksAction } from "./actions";
import {
  addDays,
  type CalBlock,
  type CalBooking,
  type CalListing,
  type CalOrigin,
  type CalStatus,
  dateFromKey,
  MONTH_NAMES,
  nightsBetween,
  type SeasonalRange,
  vmoney,
} from "./calendar-data";
import { MonthGrid, TimelineView } from "./calendar-views";
import {
  FieldMenu,
  FilterMenu,
  Icon,
  KpiTile,
  LayoutToggle,
  LegendBar,
  ListingSwitcher,
  MonthNav,
  OccupancyRing,
  OriginMix,
  Stat,
  TodayBoard,
  UpcomingList,
  ViewToggle,
} from "./calendar-widgets";

const ALL_STATUSES: CalStatus[] = [
  "confirmed",
  "pending",
  "inhouse",
  "completed",
  "cancelled",
];
const ALL_ORIGINS: CalOrigin[] = ["direct", "manual", "quote"];
const LAYOUT_KEY = "vilo:calendar:layout";

export function CalendarWorkspace({
  listings,
  bookings,
  blocks: initialBlocks,
  seasonal,
  today,
  refYear,
  refMonth,
}: {
  listings: CalListing[];
  bookings: CalBooking[];
  blocks: CalBlock[];
  seasonal: SeasonalRange[];
  today: string;
  refYear: number;
  refMonth: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [view, setView] = useState<"month" | "timeline">("month");
  const [layout, setLayout] = useState<"A" | "B">("A");
  const [listingId, setListingId] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [blocks, setBlocks] = useState<CalBlock[]>(initialBlocks);
  // Cancelled bookings don't hold the calendar — off by default, still filterable.
  const [statusSet, setStatusSet] = useState<Set<string>>(
    () => new Set(ALL_STATUSES.filter((s) => s !== "cancelled")),
  );
  const [originSet, setOriginSet] = useState<Set<string>>(
    () => new Set(ALL_ORIGINS),
  );
  const [fields, setFields] = useState<Set<string>>(
    () => new Set(["avatar", "name", "status", "channel", "price"]),
  );

  // Restore the saved layout once on mount.
  useEffect(() => {
    const saved = window.localStorage.getItem(LAYOUT_KEY);
    if (saved === "A" || saved === "B") setLayout(saved);
  }, []);
  const chooseLayout = (l: "A" | "B") => {
    setLayout(l);
    window.localStorage.setItem(LAYOUT_KEY, l);
  };

  useEffect(() => setBlocks(initialBlocks), [initialBlocks]);

  const year = refYear + Math.floor((refMonth + offset) / 12);
  const month = (((refMonth + offset) % 12) + 12) % 12;

  const toggle =
    (setFn: React.Dispatch<React.SetStateAction<Set<string>>>) => (k: string) =>
      setFn((s) => {
        const n = new Set(s);
        if (n.has(k)) n.delete(k);
        else n.add(k);
        return n;
      });

  const baseBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (listingId === "all" || b.listingId === listingId) &&
          statusSet.has(b.status) &&
          originSet.has(b.origin),
      ),
    [bookings, listingId, statusSet, originSet],
  );

  const monthBookings = useMemo(() => {
    const mStart = dateFromKey(
      `${year}-${String(month + 1).padStart(2, "0")}-01`,
    );
    const last = new Date(year, month + 1, 0).getDate();
    const mEnd = dateFromKey(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
    );
    return baseBookings.filter((b) => {
      const ci = dateFromKey(b.ci);
      const ln = dateFromKey(addDays(b.co, -1));
      return ci <= mEnd && ln >= mStart;
    });
  }, [baseBookings, year, month]);

  // Seasonal price lookup.
  const priceFor = useCallback(
    (lid: string, dateKey: string) => {
      for (const r of seasonal) {
        if (r.listingId === lid && dateKey >= r.start && dateKey <= r.end)
          return r.price;
      }
      return listings.find((l) => l.id === lid)?.basePrice ?? 0;
    },
    [seasonal, listings],
  );

  const metrics = useMemo(() => {
    const rooms =
      listingId === "all"
        ? listings.reduce((a, l) => a + (l.rooms || 1), 0)
        : listings.find((l) => l.id === listingId)?.rooms || 1;
    const daysIn = new Date(year, month + 1, 0).getDate();
    let bookedNights = 0;
    let revenue = 0;
    monthBookings.forEach((b) => {
      const n = nightsBetween(b.ci, b.co);
      bookedNights += n;
      if (b.status !== "pending" && b.status !== "cancelled")
        revenue += b.total || n * b.rate;
    });
    const occ = Math.min(
      100,
      Math.round((bookedNights / (rooms * daysIn || 1)) * 100),
    );
    const arrivals = monthBookings.filter((b) => b.ci === today);
    const departures = monthBookings.filter((b) => b.co === today);
    const upcoming = baseBookings
      .filter((b) => {
        const d = nightsBetween(today, b.ci);
        return d > 0 && d <= 10;
      })
      .sort(
        (a, b) => dateFromKey(a.ci).getTime() - dateFromKey(b.ci).getTime(),
      );
    const pending = monthBookings.filter((b) => b.status === "pending").length;
    const adr = bookedNights ? revenue / bookedNights : 0;
    const oCount: Record<string, number> = {};
    monthBookings.forEach(
      (b) =>
        (oCount[b.origin] =
          (oCount[b.origin] || 0) + nightsBetween(b.ci, b.co)),
    );
    const originMix = ALL_ORIGINS.filter((k) => oCount[k]).map((k) => ({
      k,
      value: oCount[k],
    }));
    return {
      rooms,
      daysIn,
      bookedNights,
      revenue,
      occ,
      arrivals,
      departures,
      upcoming,
      pending,
      adr,
      originMix,
    };
  }, [monthBookings, baseBookings, listingId, year, month, today, listings]);

  const canBlock = listingId !== "all";

  const onBlockCommit = useCallback(
    (keys: string[]) => {
      if (!canBlock) return;
      const scoped = blocks.filter((b) => b.listingId === listingId);
      const manual = new Set(
        scoped.filter((b) => b.kind === "manual").map((b) => b.date),
      );
      const lockedOrAny = new Set(scoped.map((b) => b.date));
      const allManual = keys.every((k) => manual.has(k));
      const block = !allManual;

      // Optimistic update.
      setBlocks((prev) => {
        if (block) {
          const add: CalBlock[] = keys
            .filter((k) => !lockedOrAny.has(k))
            .map((k) => ({
              listingId,
              date: k,
              roomId: null,
              kind: "manual" as const,
              source: null,
            }));
          return [...prev, ...add];
        }
        const kill = new Set(keys);
        return prev.filter(
          (b) =>
            !(
              b.listingId === listingId &&
              b.kind === "manual" &&
              kill.has(b.date)
            ),
        );
      });

      startTransition(async () => {
        const res = await setManualBlocksAction(listingId, keys, block);
        if (!res.ok) {
          toast.error(res.error);
          router.refresh(); // resync from the server on failure
        }
      });
    },
    [blocks, listingId, canBlock, router],
  );

  const renderCalendar = () =>
    view === "month" ? (
      <MonthGrid
        year={year}
        month={month}
        bookings={baseBookings}
        blocks={blocks}
        fields={fields}
        listingId={listingId}
        priceFor={priceFor}
        canBlock={canBlock}
        today={today}
        listings={listings}
        onBlockCommit={onBlockCommit}
      />
    ) : (
      <TimelineView
        year={year}
        month={month}
        bookings={monthBookings}
        blocks={blocks}
        fields={fields}
        listingId={listingId}
        listings={listings}
        today={today}
      />
    );

  const newHref =
    listingId === "all"
      ? "/dashboard/bookings/new"
      : `/dashboard/bookings/new?listing=${listingId}`;

  const monthNav = (
    <MonthNav
      year={year}
      month={month}
      onPrev={() => setOffset(offset - 1)}
      onNext={() => setOffset(offset + 1)}
      onToday={() => setOffset(0)}
    />
  );
  const filterControls = (
    <>
      <LayoutToggle value={layout} onChange={chooseLayout} />
      <FilterMenu
        statusSet={statusSet}
        originSet={originSet}
        onToggleStatus={toggle(setStatusSet)}
        onToggleOrigin={toggle(setOriginSet)}
        onClear={() => {
          setStatusSet(new Set(ALL_STATUSES.filter((s) => s !== "cancelled")));
          setOriginSet(new Set(ALL_ORIGINS));
        }}
      />
      <FieldMenu fields={fields} onToggle={toggle(setFields)} />
    </>
  );

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="mr-auto">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Calendar
        </div>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-brand-ink">
          Availability &amp; stays
        </h1>
      </div>
      <ListingSwitcher
        listings={listings}
        value={listingId}
        onChange={setListingId}
      />
      {layout === "B" ? (
        <a
          href={newHref}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 py-2 text-[13px] font-semibold text-white shadow-glow hover:bg-brand-secondary"
        >
          <Icon k="plus" size={15} sw={2.2} />
          New booking
        </a>
      ) : null}
    </div>
  );

  // ── Layout A — console: calendar hero + right rail ──
  if (layout === "A") {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex flex-wrap items-center gap-2">
          {monthNav}
          <ViewToggle value={view} onChange={setView} />
          <div className="ml-auto flex items-center gap-2">
            {filterControls}
            <a
              href={newHref}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 py-2 text-[13px] font-semibold text-white shadow-glow hover:bg-brand-secondary"
            >
              <Icon k="plus" size={15} sw={2.2} />
              New booking
            </a>
          </div>
        </div>

        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1 overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            {renderCalendar()}
            <div className="flex items-center justify-between gap-3 border-t border-brand-line px-4 py-2.5">
              <LegendBar />
              <span className="hidden items-center gap-1.5 text-[11px] text-brand-mute xl:inline-flex">
                <Icon k="sliders" size={13} />
                {canBlock
                  ? "Drag across days to block · click a day to add"
                  : "Pick a listing to block dates"}
              </span>
            </div>
          </div>

          <aside className="hidden w-[296px] shrink-0 space-y-4 lg:block">
            <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
              <div className="mb-3 font-display text-[13.5px] font-bold text-brand-ink">
                {MONTH_NAMES[month]} occupancy
              </div>
              <div className="flex items-center gap-4">
                <OccupancyRing pct={metrics.occ} size={120} />
                <div className="flex-1 space-y-2">
                  <Stat label="Revenue" value={vmoney(metrics.revenue)} />
                  <Stat
                    label="Avg / night"
                    value={vmoney(metrics.adr)}
                    sub={`${metrics.bookedNights} nights booked`}
                  />
                </div>
              </div>
              <div className="mt-3 border-t border-brand-line pt-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-mute">
                  Origin mix
                </div>
                <OriginMix data={metrics.originMix} />
              </div>
            </div>
            <TodayBoard
              today={today}
              arrivals={metrics.arrivals}
              departures={metrics.departures}
            />
            <UpcomingList
              upcoming={metrics.upcoming}
              listings={listings}
              today={today}
            />
          </aside>
        </div>
      </div>
    );
  }

  // ── Layout B — KPI-first: stat strip + full-width grid ──
  return (
    <div className="space-y-4">
      {header}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile
          dark
          label={`${MONTH_NAMES[month].slice(0, 3)} occupancy`}
          value={`${metrics.occ}%`}
          sub={`${metrics.bookedNights} of ${metrics.rooms * metrics.daysIn} room-nights`}
        />
        <KpiTile
          label="Booked revenue"
          value={vmoney(metrics.revenue)}
          sub={`avg ${vmoney(metrics.adr)} / night`}
          icon="cash"
        />
        <KpiTile
          label="Arrivals today"
          value={metrics.arrivals.length}
          sub={`${metrics.departures.length} departures`}
          icon="arrowR"
        />
        <KpiTile
          label="Pending requests"
          value={metrics.pending}
          sub="awaiting your reply"
          icon="clock"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-card border border-brand-line bg-white px-3 py-2.5 shadow-card">
        {monthNav}
        <ViewToggle value={view} onChange={setView} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="hidden md:block">
            <LegendBar />
          </div>
          <span className="mx-1 hidden h-5 w-px bg-brand-line md:block" />
          {filterControls}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {renderCalendar()}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-[14px] font-bold text-brand-ink">
            Upcoming check-ins
          </span>
          <a
            href="/dashboard/bookings"
            className="text-[12px] font-semibold text-brand-primary hover:underline"
          >
            View all bookings
          </a>
        </div>
        <div className="peek-scroll flex gap-3 overflow-x-auto pb-1">
          {metrics.upcoming.slice(0, 6).map((b) => {
            const l = listings.find((x) => x.id === b.listingId);
            return (
              <a
                key={b.id}
                href={`/dashboard/bookings/${b.id}`}
                className="hover-lift flex w-[222px] shrink-0 items-center gap-3 rounded-card border border-brand-line bg-white p-3 shadow-card"
              >
                <span className="h-[42px] w-[42px] shrink-0 overflow-hidden rounded-full bg-brand-accent">
                  {b.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[13px] font-bold text-brand-ink">
                    {b.guest}
                  </div>
                  <div className="flex items-center gap-1.5 truncate text-[11px] text-brand-mute">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: l?.tone ?? "#94A3B8" }}
                    />
                    {l?.name ?? "Listing"}
                  </div>
                  <div className="num mt-1 text-[10.5px] font-semibold text-brand-mute">
                    in {nightsBetween(today, b.ci)}d
                  </div>
                </div>
              </a>
            );
          })}
          {metrics.upcoming.length === 0 ? (
            <div className="py-6 text-[12px] text-brand-mute">
              Nothing in the next 10 days.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
