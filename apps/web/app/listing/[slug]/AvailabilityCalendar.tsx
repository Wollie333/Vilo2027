"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoFor = (y: number, m: number, d: number) =>
  `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

type Cell = { day: number; iso: string } | null;

function monthCells(year: number, month: number): Cell[] {
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Cell[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, iso: isoFor(year, month, d) });
  return cells;
}

/**
 * Two-month availability calendar. Unavailable days (host blocks / bookings)
 * are struck through and not selectable. When `onSelect` is provided the user
 * can pick a check-in → check-out range; otherwise it's a read-only viewer.
 */
export function AvailabilityCalendar({
  unavailable,
  from,
  to,
  onSelect,
}: {
  unavailable: string[];
  from: string;
  to: string;
  onSelect?: (from: string, to: string) => void;
}) {
  const today = todayIso();
  const blocked = useMemo(() => new Set(unavailable), [unavailable]);
  const [offset, setOffset] = useState(0);

  const baseYear = new Date().getUTCFullYear();
  const baseMonth = new Date().getUTCMonth();
  const monthFor = (add: number) => {
    const total = baseMonth + offset + add;
    return {
      year: baseYear + Math.floor(total / 12),
      month: ((total % 12) + 12) % 12,
    };
  };

  function pick(dateIso: string) {
    if (!onSelect) return;
    if (dateIso < today || blocked.has(dateIso)) return;
    if (!from || (from && to)) {
      onSelect(dateIso, "");
    } else if (dateIso > from) {
      onSelect(from, dateIso);
    } else {
      onSelect(dateIso, "");
    }
  }

  const renderMonth = (add: number) => {
    const { year, month } = monthFor(add);
    const cells = monthCells(year, month);
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          {add === 0 ? (
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - 1))}
              disabled={offset === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-line hover:bg-brand-light disabled:opacity-40"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <span className="h-8 w-8" />
          )}
          <div className="font-display font-semibold text-brand-ink">
            {MONTHS[month]} {year}
          </div>
          {add === 1 ? (
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-line hover:bg-brand-light"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <span className="h-8 w-8" />
          )}
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const isPast = c.iso < today;
            const isBlocked = blocked.has(c.iso);
            const isStart = from && c.iso === from;
            const isEnd = to && c.iso === to;
            const inRange = from && to && c.iso > from && c.iso < to;
            const disabled = isPast || isBlocked;
            return (
              <button
                key={c.iso}
                type="button"
                disabled={disabled || !onSelect}
                onClick={() => pick(c.iso)}
                className={[
                  "flex aspect-square items-center justify-center rounded-sm text-[11.5px]",
                  isStart || isEnd
                    ? "bg-brand-primary font-semibold text-white"
                    : inRange
                      ? "bg-brand-accent text-brand-secondary"
                      : isBlocked
                        ? "text-brand-mute line-through"
                        : isPast
                          ? "text-brand-line"
                          : "text-brand-ink hover:bg-brand-light",
                  onSelect && !disabled ? "cursor-pointer" : "",
                ].join(" ")}
              >
                {c.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="grid gap-8 sm:grid-cols-2">
        {renderMonth(0)}
        {renderMonth(1)}
      </div>
      <div className="mt-4 flex items-center gap-3 text-[11px] text-brand-mute">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-primary" />{" "}
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-accent" />{" "}
          Range
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-line" />{" "}
          Unavailable
        </span>
        {onSelect && (from || to) ? (
          <button
            type="button"
            onClick={() => onSelect("", "")}
            className="ml-auto font-medium text-brand-ink underline underline-offset-4 hover:text-brand-primary"
          >
            Clear dates
          </button>
        ) : null}
      </div>
    </div>
  );
}
