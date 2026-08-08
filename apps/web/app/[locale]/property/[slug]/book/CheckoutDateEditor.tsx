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
  unavailable,
  bare = false,
}: {
  from: string;
  to: string;
  minNights: number;
  onChange: (from: string, to: string) => void;
  /** Strip the card chrome (outer padding, inner bordered card, "Your dates"
   *  label and the 320px width cap) so the calendar fills its container. Used by
   *  the mobile checkout wizard, where the step already frames the calendar and
   *  the container supplies the horizontal padding. Desktop keeps the card. */
  bare?: boolean;
  /** Whole-listing unavailable nights (manual blocks + imported iCal/OTA holds):
   *  greyed out, unselectable, and a range may not span any of them. */
  unavailable?: string[];
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
  const blocked = useMemo(() => new Set(unavailable ?? []), [unavailable]);
  // Does the half-open range [start, end) cover any blocked night? (a stay of
  // check-in→check-out occupies the nights start … end-1).
  const rangeHitsBlocked = (start: string, end: string): boolean => {
    if (blocked.size === 0) return false;
    let d = start;
    let guard = 0;
    while (d < end && guard < 400) {
      if (blocked.has(d)) return true;
      const nx = new Date(`${d}T00:00:00`);
      nx.setDate(nx.getDate() + 1);
      d = isoOf(nx);
      guard += 1;
    }
    return false;
  };
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
    // A blocked night can be neither a check-in nor a check-out anchor.
    if (blocked.has(iso)) return;
    // No anchor yet, or a full range already chosen, or click before start:
    // (re)start the range from this day.
    if (!from || (from && to) || iso <= from) {
      onChange(iso, "");
      return;
    }
    // Second click after the anchor closes the range — but never longer than the
    // permitted maximum stay (deals cap max_nights), and never ACROSS a blocked
    // night (that would double-book the taken date). Restart from the new day.
    if (maxNights && nightsBetween(from, iso) > maxNights) return;
    if (rangeHitsBlocked(from, iso)) {
      onChange(iso, "");
      return;
    }
    onChange(from, iso);
  }

  function inRange(iso: string): boolean {
    if (!from || !to) return false;
    return iso > from && iso < to;
  }

  return (
    // Trim horizontal padding on mobile so the 7-column calendar cells get as
    // close to the 44px tap target as a phone allows (a full 44px WIDTH is
    // physically impossible for 7 columns inside the page margins on a 375px
    // screen — the 44px HEIGHT carries the tap target, as on native pickers).
    <div className={bare ? "" : "px-3 py-5 sm:p-5"}>
      <div
        className={
          bare
            ? ""
            : "rounded-card border border-brand-line bg-brand-light/40 px-2.5 py-4 sm:p-4"
        }
      >
        {bare ? null : (
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-ink">
            <CalendarDays className="h-4 w-4 text-brand-primary" />
            Your dates
          </div>
        )}

        <div className={`mx-auto w-full ${bare ? "" : "max-w-[320px]"}`}>
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
              className="inline-flex h-11 w-11 items-center justify-center rounded text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:text-brand-line disabled:hover:bg-transparent"
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
              className="inline-flex h-11 w-11 items-center justify-center rounded text-brand-ink transition-colors hover:bg-brand-light"
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
                return <div key={`blank-${i}`} className="h-11 w-full" />;
              }
              const dayNum = Number(iso.slice(8, 10));
              const isBlocked = blocked.has(iso);
              const disabled =
                iso < floor || (!!ceiling && iso > ceiling) || isBlocked;
              const isStart = iso === from;
              const isEnd = iso === to;
              const isEdge = isStart || isEnd;
              const between = inRange(iso);
              const isToday = iso === today;

              let cls =
                "h-11 w-full text-sm transition-colors disabled:cursor-not-allowed";
              if (isBlocked) {
                // Taken (manual block or imported iCal/OTA): a light-yellow cell,
                // struck through + unselectable, distinct from faint past days.
                cls +=
                  " rounded bg-amber-100 text-amber-700 line-through decoration-amber-500 decoration-2";
              } else if (disabled) {
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
                  aria-label={isBlocked ? `${dayNum} — unavailable` : undefined}
                  title={isBlocked ? "Unavailable" : undefined}
                  className={cls}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend — explain the light-yellow blocked cells. */}
        {blocked.size > 0 ? (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-brand-mute">
            <span className="inline-block h-3.5 w-3.5 shrink-0 rounded bg-amber-100 ring-1 ring-amber-300" />
            Light-yellow dates are already booked and can&apos;t be selected.
          </div>
        ) : null}

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
