"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function fmtLong(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
 * Editable check-in / check-out for the checkout page. Changing the dates
 * navigates to the same URL with new ?from/?to (preserving every other param),
 * so the SERVER re-renders with fresh pricing + availability — nothing about
 * the trip total is computed or trusted on the client.
 */
export function CheckoutDateEditor({
  checkIn,
  checkOut,
  minNights,
}: {
  checkIn: string;
  checkOut: string;
  minNights: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(checkIn);
  const [to, setTo] = useState(checkOut);
  const [applying, setApplying] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => monthStartOf(checkIn));

  const today = todayIso();
  const thisMonthStart = useMemo(() => monthStartOf(today), [today]);

  const minStay = Math.max(1, minNights);
  const draftNights = from && to ? nightsBetween(from, to) : 0;
  const valid = Boolean(from && to) && draftNights >= minStay;
  const changed = from !== checkIn || to !== checkOut;

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
    if (iso < today) return;
    // No anchor yet, or a full range already chosen, or click before start:
    // (re)start the range from this day.
    if (!from || (from && to) || iso <= from) {
      setFrom(iso);
      setTo("");
      return;
    }
    // Second click after the anchor closes the range.
    setTo(iso);
  }

  function inRange(iso: string): boolean {
    if (!from || !to) return false;
    return iso > from && iso < to;
  }

  function resetDraft() {
    setFrom(checkIn);
    setTo(checkOut);
    setViewMonth(monthStartOf(checkIn));
  }

  function apply() {
    if (!valid || !changed) {
      setOpen(false);
      return;
    }
    setApplying(true);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("from", from);
    params.set("to", to);
    // Dropping per-room guest counts is fine — the server re-derives them; but
    // keep room_ids/guests so the same rooms stay selected after the reload.
    router.push(`${pathname}?${params.toString()}`);
  }

  const tile =
    "flex items-center justify-between gap-3 rounded-card border p-4 text-left transition";

  return (
    <div className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${tile} ${open ? "border-brand-primary bg-brand-accent/20" : "border-brand-line hover:border-brand-primary/50"}`}
          aria-expanded={open}
        >
          <span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              Check-in
            </span>
            <span className="mt-1 block font-display text-lg font-semibold text-brand-ink">
              {fmtLong(checkIn)}
            </span>
          </span>
          <Pencil className="h-4 w-4 shrink-0 text-brand-mute" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${tile} ${open ? "border-brand-primary bg-brand-accent/20" : "border-brand-line hover:border-brand-primary/50"}`}
          aria-expanded={open}
        >
          <span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              Check-out
            </span>
            <span className="mt-1 block font-display text-lg font-semibold text-brand-ink">
              {fmtLong(checkOut)}
            </span>
          </span>
          <Pencil className="h-4 w-4 shrink-0 text-brand-mute" />
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-card border border-brand-line bg-brand-light/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-ink">
            <CalendarDays className="h-4 w-4 text-brand-primary" />
            Change your dates
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
                disabled={!canGoPrev || applying}
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
                disabled={applying}
                aria-label="Next month"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:text-brand-line"
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
                const disabled = iso < today || applying;
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
                  if (isToday)
                    cls += " font-semibold ring-1 ring-brand-primary";
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

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetDraft();
                setOpen(false);
              }}
              disabled={applying}
              className="rounded px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!valid || !changed || applying}
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying ? "Updating…" : "Update dates"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-brand-mute">
            Updating re-checks availability and recalculates your total.
          </p>
        </div>
      ) : null}
    </div>
  );
}
