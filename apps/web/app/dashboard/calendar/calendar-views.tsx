"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addDays,
  type CalBlock,
  type CalBlockKind,
  type CalBooking,
  type CalListing,
  dateFromKey,
  DOW_MON,
  fmtShort,
  monthDays,
  monthMatrix,
  nightsBetween,
  ORIGIN_META,
  parseKey,
  STATUS_META,
} from "./calendar-data";
import {
  Avatar,
  Icon,
  OriginMark,
  StatusDot,
  vmoney,
} from "./calendar-widgets";

type PriceFn = (listingId: string, dateKey: string) => number;

const HATCH: Record<CalBlockKind, string> = {
  manual: "rgba(148,163,148,0.30)",
  external: "rgba(244,63,94,0.28)",
  quote: "rgba(245,158,11,0.30)",
  booking: "rgba(16,185,129,0.20)",
};
function hatch(kind: CalBlockKind): string {
  return `repeating-linear-gradient(45deg,${HATCH[kind]} 0 4px,transparent 4px 9px)`;
}

// Map of date-key → block kind for a given listing scope.
function blockMapFor(
  blocks: CalBlock[],
  listingId: string,
): Map<string, CalBlockKind> {
  const order: Record<CalBlockKind, number> = {
    booking: 3,
    quote: 2,
    external: 1,
    manual: 0,
  };
  const m = new Map<string, CalBlockKind>();
  for (const b of blocks) {
    if (listingId !== "all" && b.listingId !== listingId) continue;
    const prev = m.get(b.date);
    if (!prev || order[b.kind] > order[prev]) m.set(b.date, b.kind);
  }
  return m;
}

// ── Booking popover ────────────────────────────────────────────────
export function BookingPopover({
  b,
  listings,
  onClose,
  style,
}: {
  b: CalBooking;
  listings: CalListing[];
  onClose: () => void;
  style: React.CSSProperties;
}) {
  const l = listings.find((x) => x.id === b.listingId);
  const st = STATUS_META[b.status];
  const o = ORIGIN_META[b.origin];
  const nights = nightsBetween(b.ci, b.co);
  return (
    <div
      className="absolute z-40 w-[286px] overflow-hidden rounded-card border border-brand-line bg-white shadow-peek"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="relative px-3.5 pb-3 pt-3.5"
        style={{ background: st.soft }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-brand-mute hover:bg-white/70"
        >
          <Icon k="x" size={13} sw={2} />
        </button>
        <div className="flex items-center gap-2.5">
          <Avatar src={b.avatar} name={b.guest} size={40} ring="#fff" />
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-bold text-brand-ink">
              {b.guest}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-pill bg-white px-1.5 py-0.5 text-[10px] font-bold"
                style={{ color: st.ink }}
              >
                <StatusDot status={b.status} size={6} />
                {st.label}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-pill bg-white px-1.5 py-0.5 text-[10px] font-bold"
                style={{ color: o.color }}
              >
                <OriginMark origin={b.origin} size={11} />
                {o.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 px-3.5 py-3">
        <div className="flex items-center gap-2 text-[12px] text-brand-mute">
          <Icon k="pin" size={14} cls="shrink-0 text-brand-mute" />
          <span className="font-semibold text-brand-ink">
            {l?.name ?? "Listing"}
          </span>
          {l?.location ? <span>· {l.location}</span> : null}
        </div>

        <div className="flex items-stretch rounded-[10px] border border-brand-line">
          <div className="flex-1 px-3 py-2">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-brand-mute">
              Check-in
            </div>
            <div className="num mt-0.5 text-[13px] font-bold text-brand-ink">
              {fmtShort(b.ci)}
            </div>
            {b.ciTime ? (
              <div className="num mt-0.5 flex items-center gap-1 text-[10.5px] text-brand-mute">
                <Icon k="clock" size={11} />
                {b.ciTime}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-center justify-center border-x border-brand-line bg-brand-light px-2.5">
            <Icon k="moon" size={13} cls="text-brand-mute" />
            <span className="num mt-0.5 text-[11px] font-bold text-brand-ink">
              {nights}
            </span>
          </div>
          <div className="flex-1 px-3 py-2 text-right">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-brand-mute">
              Check-out
            </div>
            <div className="num mt-0.5 text-[13px] font-bold text-brand-ink">
              {fmtShort(b.co)}
            </div>
            {b.coTime ? (
              <div className="num mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-brand-mute">
                <Icon k="clock" size={11} />
                {b.coTime}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between text-[12px]">
          <span className="inline-flex items-center gap-1.5 text-brand-mute">
            <Icon k="user" size={14} />
            {b.guests} guest{b.guests > 1 ? "s" : ""}
          </span>
          {b.rate > 0 ? (
            <span className="num text-brand-mute">
              {vmoney(b.rate)} <span className="text-[10.5px]">/ night</span>
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-brand-line pt-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Total
          </span>
          <span className="num font-display text-[17px] font-bold text-brand-ink">
            {vmoney(b.total)}
          </span>
        </div>

        <a
          href={`/dashboard/bookings/${b.id}`}
          className="mt-0.5 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary py-2 text-[12px] font-semibold text-white hover:bg-brand-secondary"
        >
          View booking
          <Icon k="arrowR" size={13} sw={2} />
        </a>
      </div>
    </div>
  );
}

// ── Add / block popover ────────────────────────────────────────────
function AddPop({
  dateKey,
  listingId,
  canBlock,
  isBlocked,
  onBlock,
  onClose,
  style,
}: {
  dateKey: string;
  listingId: string;
  canBlock: boolean;
  isBlocked: boolean;
  onBlock: () => void;
  onClose: () => void;
  style: React.CSSProperties;
}) {
  const newHref =
    listingId === "all"
      ? "/dashboard/bookings/new"
      : `/dashboard/bookings/new?listing=${listingId}`;
  return (
    <div
      className="absolute z-40 w-[212px] overflow-hidden rounded-card border border-brand-line bg-white p-1.5 shadow-peek"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
        <span className="num text-[12px] font-bold text-brand-ink">
          {fmtShort(dateKey)}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light"
        >
          <Icon k="x" size={12} sw={2} />
        </button>
      </div>
      <a
        href={newHref}
        className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left hover:bg-brand-light"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand-accent text-brand-secondary">
          <Icon k="plus" size={15} />
        </span>
        <span className="text-[12.5px] font-semibold text-brand-ink">
          New booking
        </span>
      </a>
      <button
        type="button"
        disabled={!canBlock}
        onClick={() => {
          onBlock();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
        title={canBlock ? undefined : "Pick a single listing to block dates"}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-slate-100 text-slate-500">
          <Icon k="ban" size={15} />
        </span>
        <span className="text-[12.5px] font-semibold text-brand-ink">
          {isBlocked ? "Unblock date" : "Block date"}
        </span>
      </button>
      {listingId !== "all" ? (
        <a
          href={`/dashboard/seasonal-pricing?listing=${listingId}`}
          className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left hover:bg-brand-light"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand-accent text-brand-secondary">
            <Icon k="pencil" size={14} />
          </span>
          <span className="text-[12.5px] font-semibold text-brand-ink">
            Edit price
          </span>
        </a>
      ) : null}
    </div>
  );
}

// ── Month grid ─────────────────────────────────────────────────────
const HEAD_H = 30;
const LANE_H = 23;
const MAX_LANES = 3;

type Seg = {
  b: CalBooking;
  startCol: number;
  endCol: number;
  span: number;
  isStart: boolean;
  isEnd: boolean;
  lane: number;
};
function segmentsForWeek(weekKeys: string[], bookings: CalBooking[]): Seg[] {
  const wStart = weekKeys[0];
  const wEnd = weekKeys[6];
  const segs: Omit<Seg, "lane">[] = [];
  bookings.forEach((b) => {
    const lastNight = addDays(b.co, -1);
    const segStart = b.ci > wStart ? b.ci : wStart;
    const segEnd = lastNight < wEnd ? lastNight : wEnd;
    if (dateFromKey(segStart) > dateFromKey(segEnd)) return;
    const startCol = nightsBetween(wStart, segStart);
    const endCol = nightsBetween(wStart, segEnd);
    segs.push({
      b,
      startCol,
      endCol,
      span: endCol - startCol + 1,
      isStart: segStart === b.ci,
      isEnd: segEnd === lastNight,
    });
  });
  segs.sort((a, z) => a.startCol - z.startCol || z.span - a.span);
  const laneEnds: number[] = [];
  const out: Seg[] = [];
  segs.forEach((s) => {
    let lane = laneEnds.findIndex((e) => e < s.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.endCol);
    } else laneEnds[lane] = s.endCol;
    out.push({ ...s, lane });
  });
  return out;
}

export function MonthGrid({
  year,
  month,
  bookings,
  blocks,
  fields,
  listingId,
  priceFor,
  canBlock,
  today,
  listings,
  onBlockCommit,
}: {
  year: number;
  month: number;
  bookings: CalBooking[];
  blocks: CalBlock[];
  fields: Set<string>;
  listingId: string;
  priceFor: PriceFn;
  canBlock: boolean;
  today: string;
  listings: CalListing[];
  onBlockCommit: (keys: string[]) => void;
}) {
  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const blockMap = useMemo(
    () => blockMapFor(blocks, listingId),
    [blocks, listingId],
  );
  const [sel, setSel] = useState<{
    b: CalBooking;
    weekIdx: number;
    fromRight: boolean;
    sideCol: number;
    top: number;
  } | null>(null);
  const [addAt, setAddAt] = useState<{
    key: string;
    weekIdx: number;
    col: number;
  } | null>(null);
  const [drag, setDrag] = useState<{ anchor: string; hover: string } | null>(
    null,
  );
  const dragging = useRef(false);

  const showPrice = fields.has("price");
  const priceListing = listingId === "all" ? listings[0]?.id : listingId;
  const cellMinH = HEAD_H + MAX_LANES * LANE_H + 8;

  const selRange = useMemo(() => {
    if (!drag) return new Set<string>();
    const a = dateFromKey(drag.anchor);
    const b = dateFromKey(drag.hover);
    const lo = a < b ? drag.anchor : drag.hover;
    const hi = a < b ? drag.hover : drag.anchor;
    const out = new Set<string>();
    let k = lo;
    while (dateFromKey(k) <= dateFromKey(hi)) {
      out.add(k);
      k = addDays(k, 1);
    }
    return out;
  }, [drag]);

  const commit = useCallback(
    (keys: string[]) => {
      if (canBlock && keys.length) onBlockCommit(keys);
    },
    [canBlock, onBlockCommit],
  );

  useEffect(() => {
    if (!drag) return;
    const up = () => {
      dragging.current = false;
      if (selRange.size > 1) commit(Array.from(selRange));
      setDrag(null);
    };
    document.addEventListener("pointerup", up, { once: true });
    return () => document.removeEventListener("pointerup", up);
  }, [drag, selRange, commit]);

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 border-b border-brand-line">
        {DOW_MON.map((d, i) => (
          <div
            key={d}
            className={
              "px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider " +
              (i >= 5 ? "text-brand-mute/60" : "text-brand-mute")
            }
          >
            {d}
          </div>
        ))}
      </div>

      <div className="divide-y divide-brand-line">
        {weeks.map((week, wi) => {
          const segs = segmentsForWeek(
            week.map((c) => c.key),
            bookings,
          );
          const visible = segs.filter((s) => s.lane < MAX_LANES);
          const hiddenByCol: Record<number, number> = {};
          segs
            .filter((s) => s.lane >= MAX_LANES)
            .forEach((s) => {
              for (let c = s.startCol; c <= s.endCol; c++)
                hiddenByCol[c] = (hiddenByCol[c] || 0) + 1;
            });
          return (
            <div
              key={wi}
              className="relative grid grid-cols-7"
              style={{ minHeight: cellMinH }}
            >
              {week.map((cell) => {
                const blk = blockMap.get(cell.key);
                const inSel = selRange.has(cell.key);
                const isToday = cell.key === today;
                const price = priceListing
                  ? priceFor(priceListing, cell.key)
                  : 0;
                return (
                  <div
                    key={cell.key}
                    className={
                      "relative border-r border-brand-line/70 last:border-r-0 " +
                      (cell.isWeekend ? "bg-brand-light/40 " : "") +
                      (!cell.inMonth ? "bg-brand-light/60" : "")
                    }
                    onPointerDown={(e) => {
                      if (e.button !== 0 || !canBlock) return;
                      dragging.current = true;
                      setSel(null);
                      setDrag({ anchor: cell.key, hover: cell.key });
                    }}
                    onPointerEnter={() => {
                      if (dragging.current)
                        setDrag((d) => (d ? { ...d, hover: cell.key } : d));
                    }}
                    onClick={() => {
                      if (selRange.size > 1) return; // was a drag
                      setSel(null);
                      setAddAt({ key: cell.key, weekIdx: wi, col: cell.dow });
                    }}
                  >
                    {blk ? (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{ backgroundImage: hatch(blk) }}
                      />
                    ) : null}
                    {inSel ? (
                      <div className="pointer-events-none absolute inset-0 bg-brand-primary/15 ring-1 ring-inset ring-brand-primary/50" />
                    ) : null}
                    <div className="flex items-start justify-between px-2 pt-1.5">
                      <span
                        className={
                          "num inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12.5px] font-semibold " +
                          (isToday
                            ? "bg-brand-primary text-white"
                            : cell.inMonth
                              ? "text-brand-ink"
                              : "text-brand-mute/50")
                        }
                      >
                        {cell.day}
                      </span>
                      {showPrice && cell.inMonth && price > 0 ? (
                        <span className="num text-[10px] font-semibold text-brand-mute/80">
                          {vmoney(price)}
                        </span>
                      ) : null}
                    </div>
                    {blk && blk !== "booking" ? (
                      <span className="pointer-events-none absolute bottom-1 left-2 inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-brand-mute">
                        <Icon k="ban" size={10} />
                        {blk === "external"
                          ? "iCal"
                          : blk === "quote"
                            ? "Quote"
                            : "Blocked"}
                      </span>
                    ) : null}
                  </div>
                );
              })}

              <div className="pointer-events-none absolute inset-0">
                {visible.map((s) => {
                  const b = s.b;
                  const st = STATUS_META[b.status];
                  const useColor = fields.has("status");
                  const show = s.isStart || s.startCol === 0;
                  return (
                    <button
                      type="button"
                      key={b.id + "-" + wi}
                      className="pointer-events-auto absolute flex items-center gap-1.5 overflow-hidden px-1.5 text-left transition-shadow hover:z-20 hover:shadow-lift"
                      style={{
                        left: `calc(${(s.startCol / 7) * 100}% + 3px)`,
                        width: `calc(${(s.span / 7) * 100}% - 6px)`,
                        top: HEAD_H + s.lane * LANE_H,
                        height: LANE_H - 4,
                        background: useColor ? st.soft : "#F1F5F4",
                        borderRadius:
                          (s.isStart ? "7px" : "2px") +
                          " " +
                          (s.isEnd ? "7px" : "2px") +
                          " " +
                          (s.isEnd ? "7px" : "2px") +
                          " " +
                          (s.isStart ? "7px" : "2px"),
                        boxShadow: `inset 3px 0 0 ${useColor ? st.color : "#94A3B8"}`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddAt(null);
                        setSel({
                          b,
                          weekIdx: wi,
                          fromRight: s.startCol > 3,
                          sideCol: s.startCol > 3 ? s.endCol : s.startCol,
                          top: HEAD_H + (s.lane + 1) * LANE_H + 2,
                        });
                      }}
                    >
                      {show && fields.has("avatar") ? (
                        <Avatar src={b.avatar} name={b.guest} size={16} />
                      ) : null}
                      {show && fields.has("channel") ? (
                        <OriginMark origin={b.origin} size={11} />
                      ) : null}
                      {show && fields.has("name") ? (
                        <span
                          className="truncate text-[11px] font-semibold"
                          style={{ color: st.ink }}
                        >
                          {b.guest}
                        </span>
                      ) : null}
                      {show && fields.has("times") && b.ciTime ? (
                        <span
                          className="num shrink-0 text-[10px] font-medium"
                          style={{ color: st.ink, opacity: 0.75 }}
                        >
                          {b.ciTime}
                        </span>
                      ) : null}
                      {show && fields.has("rate") && b.rate > 0 ? (
                        <span
                          className="num ml-auto shrink-0 text-[10px] font-bold"
                          style={{ color: st.ink }}
                        >
                          {vmoney(b.rate)}
                        </span>
                      ) : null}
                      {show && fields.has("guests") && !fields.has("rate") ? (
                        <span
                          className="num ml-auto shrink-0 text-[10px] font-medium"
                          style={{ color: st.ink, opacity: 0.75 }}
                        >
                          {b.guests}p
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {Object.entries(hiddenByCol).map(([col, n]) => (
                  <span
                    key={col}
                    className="pointer-events-none absolute text-[10px] font-bold text-brand-mute"
                    style={{
                      left: `calc(${(Number(col) / 7) * 100}% + 6px)`,
                      top: HEAD_H + MAX_LANES * LANE_H - 2,
                    }}
                  >
                    +{n}
                  </span>
                ))}
              </div>

              {sel && sel.weekIdx === wi ? (
                <BookingPopover
                  b={sel.b}
                  listings={listings}
                  onClose={() => setSel(null)}
                  style={
                    sel.fromRight
                      ? {
                          right: `calc(${((6 - sel.sideCol) / 7) * 100}% - 6px)`,
                          top: sel.top,
                        }
                      : {
                          left: `calc(${(sel.sideCol / 7) * 100}% + 0px)`,
                          top: sel.top,
                        }
                  }
                />
              ) : null}

              {addAt && addAt.weekIdx === wi ? (
                <AddPop
                  dateKey={addAt.key}
                  listingId={listingId}
                  canBlock={canBlock}
                  isBlocked={blockMap.get(addAt.key) === "manual"}
                  onBlock={() => commit([addAt.key])}
                  onClose={() => setAddAt(null)}
                  style={
                    addAt.col > 3
                      ? {
                          right: `calc(${((6 - addAt.col) / 7) * 100}%)`,
                          top: HEAD_H + 4,
                        }
                      : {
                          left: `calc(${(addAt.col / 7) * 100}%)`,
                          top: HEAD_H + 4,
                        }
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────────
export function TimelineView({
  year,
  month,
  bookings,
  blocks,
  fields,
  listingId,
  listings,
  today,
}: {
  year: number;
  month: number;
  bookings: CalBooking[];
  blocks: CalBlock[];
  fields: Set<string>;
  listingId: string;
  listings: CalListing[];
  today: string;
}) {
  const days = useMemo(() => monthDays(year, month), [year, month]);
  const rows =
    listingId === "all" ? listings : listings.filter((l) => l.id === listingId);
  const [sel, setSel] = useState<{ b: CalBooking; left: number } | null>(null);
  const COLW = 30;
  const LABELW = 184;
  const ROWH = 56;

  return (
    <div className="select-none overflow-hidden">
      <div className="peek-scroll overflow-x-auto">
        <div style={{ minWidth: LABELW + days.length * COLW }}>
          <div className="flex border-b border-brand-line">
            <div
              className="shrink-0 px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-brand-mute"
              style={{ width: LABELW }}
            >
              Listing
            </div>
            <div className="flex">
              {days.map((d) => {
                const isToday = d.key === today;
                return (
                  <div
                    key={d.key}
                    className={
                      "flex flex-col items-center justify-center border-l border-brand-line/60 py-1 " +
                      (d.dow >= 5 ? "bg-brand-light/50" : "")
                    }
                    style={{ width: COLW }}
                  >
                    <span className="text-[9px] font-semibold uppercase text-brand-mute/70">
                      {DOW_MON[d.dow][0]}
                    </span>
                    <span
                      className={
                        "num mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold " +
                        (isToday
                          ? "bg-brand-primary text-white"
                          : "text-brand-ink")
                      }
                    >
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {rows.map((l) => {
            const lb = bookings.filter((b) => b.listingId === l.id);
            const lblocks = blockMapFor(blocks, l.id);
            return (
              <div
                key={l.id}
                className="relative flex border-b border-brand-line last:border-b-0"
                style={{ height: ROWH }}
              >
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-2.5 border-r border-brand-line bg-white px-3"
                  style={{ width: LABELW }}
                >
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded-[9px] bg-brand-accent">
                    {l.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.photo}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[12.5px] font-bold text-brand-ink">
                      {l.name}
                    </span>
                    <span className="block truncate text-[10.5px] text-brand-mute">
                      {l.location}
                    </span>
                  </span>
                </div>
                <div className="relative flex-1">
                  <div className="absolute inset-0 flex">
                    {days.map((d) => {
                      const blk = lblocks.get(d.key);
                      return (
                        <div
                          key={d.key}
                          className={
                            "h-full border-l border-brand-line/50 " +
                            (d.dow >= 5 ? "bg-brand-light/40" : "")
                          }
                          style={{ width: COLW }}
                        >
                          {blk && blk !== "booking" ? (
                            <div
                              className="h-full w-full"
                              style={{ backgroundImage: hatch(blk) }}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {lb.map((b) => {
                    const ciP = parseKey(b.ci);
                    const lastNight = addDays(b.co, -1);
                    const coP = parseKey(lastNight);
                    const ciInMonth = ciP.m === month && ciP.y === year;
                    const coInMonth = coP.m === month && coP.y === year;
                    const startIdx = ciInMonth ? ciP.d - 1 : 0;
                    const endIdx = coInMonth ? coP.d - 1 : days.length - 1;
                    const left = startIdx * COLW;
                    const width = (endIdx - startIdx + 1) * COLW;
                    const st = STATUS_META[b.status];
                    const useColor = fields.has("status");
                    return (
                      <button
                        type="button"
                        key={b.id}
                        className="absolute flex items-center gap-1.5 overflow-hidden px-2 text-left transition-shadow hover:z-20 hover:shadow-lift"
                        style={{
                          left: left + 2,
                          width: width - 4,
                          top: (ROWH - 34) / 2,
                          height: 34,
                          background: useColor ? st.soft : "#F1F5F4",
                          borderRadius: 9,
                          boxShadow: `inset 3px 0 0 ${useColor ? st.color : "#94A3B8"}`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSel({ b, left });
                        }}
                      >
                        {fields.has("avatar") ? (
                          <Avatar src={b.avatar} name={b.guest} size={22} />
                        ) : null}
                        {fields.has("name") ? (
                          <span
                            className="truncate text-[11.5px] font-semibold leading-tight"
                            style={{ color: st.ink }}
                          >
                            {b.guest.split(" ")[0]}
                          </span>
                        ) : null}
                        {fields.has("channel") ? (
                          <OriginMark origin={b.origin} size={11} />
                        ) : null}
                        {fields.has("rate") && width > 110 && b.rate > 0 ? (
                          <span
                            className="num ml-auto shrink-0 text-[10.5px] font-bold"
                            style={{ color: st.ink }}
                          >
                            {vmoney(b.rate)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {sel && lb.some((x) => x.id === sel.b.id) ? (
                  <div
                    className="absolute z-40"
                    style={{
                      left: Math.min(
                        LABELW + sel.left,
                        LABELW + days.length * COLW - 290,
                      ),
                      top: ROWH - 6,
                    }}
                  >
                    <BookingPopover
                      b={sel.b}
                      listings={listings}
                      onClose={() => setSel(null)}
                      style={{ position: "relative" }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
          {rows.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-brand-mute">
              No listings to show.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
