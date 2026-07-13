"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

function fmtShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function nightsBetween(a: string, b: string): number {
  const f = new Date(`${a}T00:00:00Z`).getTime();
  const t = new Date(`${b}T00:00:00Z`).getTime();
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (1000 * 60 * 60 * 24));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** First-of-month Date for the month containing `iso` (local). */
function monthStartOf(iso: string): Date {
  const base = iso ? new Date(`${iso}T00:00:00`) : new Date();
  const d = Number.isNaN(base.getTime()) ? new Date() : base;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** ISO yyyy-mm-dd from a local Date (no UTC shift). */
function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-first weekday index (Mon=0 … Sun=6). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Always-visible check-in / check-out calendar for the checkout page. It's a
 * controlled component: every pick reports the new range up via `onChange` so
 * the summary side card updates immediately. Pricing is recomputed by the
 * parent (client estimate) and authoritatively validated server-side when the
 * booking is created — nothing about the total is trusted from the client.
 */
export function CheckoutDateEditor({
  from,
  to,
  minNights,
  onChange,
  minDate,
  maxDate,
  maxNights,
}: {
  from: string;
  to: string;
  minNights: number;
  onChange: (from: string, to: string) => void;
  /** Earliest selectable check-in (e.g. a deal's window start). Clamped to
   *  today so the past is never bookable. Undefined → today. */
  minDate?: string | null;
  /** Latest selectable check-out (e.g. a deal's window end). Undefined → no cap
   *  (open-ended / evergreen). */
  maxDate?: string | null;
  /** Longest permitted stay (e.g. a deal's max_nights). Undefined → no cap. */
  maxNights?: number | null;
}) {
  const today = todayIso();
  // The effective floor: never before today, and never before an explicit
  // minDate. The effective ceiling: an explicit maxDate (or none).
  const floor = minDate && minDate > today ? minDate : today;
  const ceiling = maxDate ?? null;
  const thisMonthStart = useMemo(() => monthStartOf(floor), [floor]);
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    monthStartOf(from || floor),
  );

  const minStay = Math.max(1, minNights);
  const draftNights = from && to ? nightsBetween(from, to) : 0;
  const valid = Boolean(from && to) && draftNights >= minStay;

  const monthLabel = viewMonth.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
  const canGoPrev = viewMonth > thisMonthStart;

  // Day cells for the visible month, with leading blanks for the Monday offset.
  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const lead = mondayIndex(first);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i += 1) out.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      out.push(isoOf(new Date(year, month, d)));
    }
    return out;
  }, [viewMonth]);

  function pickDay(iso: string) {
    if (iso < floor) return;
    if (ceiling && iso > ceiling) return;
    // No anchor yet, or a full range already chosen, or click before start:
    // (re)start the range from this day.
    if (!from || (from && to) || iso <= from) {
      onChange(iso, "");
      return;
    }
    // Second click after the anchor closes the range — but never longer than the
    // permitted maximum stay (deals cap max_nights).
    if (maxNights && nightsBetween(from, iso) > maxNights) return;
    onChange(from, iso);
  }

  function inRange(iso: string): boolean {
    if (!from || !to) return false;
    return iso > from && iso < to;
  }

  return (
    <div className="p-5">
      <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-ink">
          <CalendarDays className="h-4 w-4 text-brand-primary" />
          Your dates
        </div>

        <div className="mx-auto w-full max-w-[320px]">
          {/* Month header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                )
              }
              disabled={!canGoPrev}
              aria-label="Previous month"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:text-brand-line disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-display text-sm font-semibold text-brand-ink">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                )
              }
              aria-label="Next month"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-brand-ink transition-colors hover:bg-brand-light"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday letters */}
          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="flex h-7 items-center justify-center text-[11px] font-medium text-brand-mute"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((iso, i) => {
              if (!iso) {
                // Leading blank before the first of the month.
                // eslint-disable-next-line react/no-array-index-key
                return <div key={`blank-${i}`} className="h-9 w-full" />;
              }
              const dayNum = Number(iso.slice(8, 10));
              const disabled = iso < floor || (!!ceiling && iso > ceiling);
              const isStart = iso === from;
              const isEnd = iso === to;
              const isEdge = isStart || isEnd;
              const between = inRange(iso);
              const isToday = iso === today;

              let cls =
                "h-9 w-full text-sm transition-colors disabled:cursor-not-allowed";
              if (disabled) {
                cls += " text-brand-line";
              } else if (isEdge) {
                cls += " rounded bg-brand-primary font-semibold text-white";
              } else if (between) {
                cls += " bg-brand-accent text-brand-secondary";
              } else {
                cls += " rounded text-brand-ink hover:bg-brand-light";
                if (isToday) cls += " font-semibold ring-1 ring-brand-primary";
              }

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(iso)}
                  aria-pressed={isEdge}
                  className={cls}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chosen range + validity */}
        <div className="mt-3 text-xs">
          {from && to ? (
            <span className="text-brand-ink">
              <span className="font-semibold">
                {fmtShort(from)} – {fmtShort(to)}
              </span>{" "}
              <span className="text-brand-mute">
                · {draftNights} {draftNights === 1 ? "night" : "nights"}
              </span>
            </span>
          ) : from ? (
            <span className="text-brand-mute">Pick your check-out date.</span>
          ) : (
            <span className="text-brand-mute">Pick your check-in date.</span>
          )}
          {from && to && !valid ? (
            <span className="ml-2 text-status-cancelled">
              Minimum stay is {minStay} {minStay === 1 ? "night" : "nights"}.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
