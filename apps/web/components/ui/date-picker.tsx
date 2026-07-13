"use client";

import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Wielo-branded date pickers — the ONE date-selection control for every
 * Wielo-branded surface (dashboard, admin, guest portal, marketplace booking,
 * finance). Replaces native `<input type="date">` so date entry looks modern
 * and on-brand instead of the OS default.
 *
 * Two exports share one calendar engine:
 *   • <DatePicker>       — a single date.
 *   • <DateRangePicker>  — a check-in / check-out (or from / to) range.
 *
 * NOT for host white-label websites — those stay theme-scoped via
 * `components/site/ThemedDateRange` (Principle #6, two colour worlds).
 *
 * The calendar renders in a PORTAL (document.body) with fixed positioning so it
 * can never be clipped by an ancestor's `overflow:hidden` (cards, dialogs) or
 * trapped under a later stacking context. Hydration-safe: the popover (the only
 * part that reads `new Date()`) mounts only after the user opens it on the
 * client, so nothing time-dependent is server-rendered.
 */

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
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

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function fromISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const p = s.split("-").map(Number);
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return null;
  return new Date(p[0], p[1] - 1, p[2]);
}

/** "10 Sep 2026" from an ISO date; "" when empty/invalid. */
function pretty(s: string | null | undefined): string {
  const d = fromISO(s);
  return d
    ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
    : "";
}

/** Shared trigger chrome — matches the app <Input> so it drops into forms. */
const TRIGGER_BASE =
  "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left transition-colors hover:border-brand-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

// ────────────────────────────────────────────────────────────────────────────
// Shared calendar-popover hook (positioning + open/close + outside dismiss)
// ────────────────────────────────────────────────────────────────────────────

function usePopover(align: "left" | "right") {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const reposition = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 8;
    const vw = window.innerWidth;
    const width = Math.min(320, vw - gap * 2);
    const top = r.bottom + gap;
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(gap, Math.min(left, vw - width - gap));
    setPos({ top, left, width });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onMove = () => reposition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    function onDoc(e: Event) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, reposition]);

  return { open, setOpen, wrapRef, popRef, pos };
}

// ────────────────────────────────────────────────────────────────────────────
// Calendar grid (shared by both pickers)
// ────────────────────────────────────────────────────────────────────────────

function CalendarGrid({
  view,
  shiftMonth,
  onPick,
  isSelected,
  isInRange,
  isDisabled,
}: {
  view: { y: number; m: number };
  shiftMonth: (delta: number) => void;
  onPick: (iso: string) => void;
  isSelected: (iso: string) => boolean;
  isInRange: (iso: string) => boolean;
  isDisabled: (iso: string) => boolean;
}) {
  const first = new Date(view.y, view.m, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const todayISO = toISO(new Date());
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(toISO(new Date(view.y, view.m, d)));

  return (
    <>
      <div className="mb-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-brand-line text-brand-ink transition-colors hover:bg-brand-accent/50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="font-display text-sm font-semibold text-brand-ink">
          {MONTHS[view.m]} {view.y}
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-brand-line text-brand-ink transition-colors hover:bg-brand-accent/50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DOW.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-wide text-brand-mute"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`b${i}`} />;
          const disabled = isDisabled(iso);
          const sel = isSelected(iso);
          const range = isInRange(iso);
          const isToday = iso === todayISO;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-[13px] transition-colors",
                sel
                  ? "bg-brand-primary font-bold text-white"
                  : range
                    ? "bg-brand-accent/60 text-brand-ink"
                    : "text-brand-ink hover:bg-brand-accent/50",
                isToday && !sel && "ring-1 ring-inset ring-brand-primary/40",
                disabled &&
                  "cursor-default text-brand-mute/40 hover:bg-transparent",
              )}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
    </>
  );
}

function PopoverShell({
  popRef,
  pos,
  children,
}: {
  popRef: React.RefObject<HTMLDivElement>;
  pos: { top: number; left: number; width: number };
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      ref={popRef}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      // `pointer-events-auto` is essential: when this portals to <body> from
      // inside a Radix dialog (FormModal), Radix sets `pointer-events:none` on
      // <body>, which the popover would otherwise inherit — making the day
      // buttons unclickable even though the calendar is visible.
      className="pointer-events-auto fixed z-[2147483000] rounded-xl border border-brand-line bg-white p-3.5 shadow-lift"
    >
      {children}
    </div>,
    document.body,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// <DatePicker> — single date
// ────────────────────────────────────────────────────────────────────────────

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select a date",
  disabled = false,
  clearable = false,
  align = "left",
  id,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** ISO yyyy-mm-dd lower bound (inclusive). */
  min?: string;
  /** ISO yyyy-mm-dd upper bound (inclusive). */
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  align?: "left" | "right";
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const { open, setOpen, wrapRef, popRef, pos } = usePopover(align);
  const autoId = useId();
  const [view, setView] = useState(() => {
    const b = fromISO(value) ?? fromISO(min) ?? new Date();
    return { y: b.getFullYear(), m: b.getMonth() };
  });

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        id={id ?? autoId}
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder}
        onClick={() => {
          const opening = !open;
          setOpen(opening);
          if (opening) {
            const d = fromISO(value) ?? fromISO(min);
            if (d) setView({ y: d.getFullYear(), m: d.getMonth() });
          }
        }}
        className={cn(TRIGGER_BASE, className)}
      >
        <Calendar className="h-4 w-4 shrink-0 text-brand-mute" />
        <span className={cn("flex-1 truncate", !value && "text-brand-mute")}>
          {value ? pretty(value) : placeholder}
        </span>
        {clearable && value && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="shrink-0 rounded p-0.5 text-brand-mute hover:text-brand-ink"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>
      {open && pos ? (
        <PopoverShell popRef={popRef} pos={pos}>
          <CalendarGrid
            view={view}
            shiftMonth={shiftMonth}
            onPick={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
            isSelected={(iso) => iso === value}
            isInRange={() => false}
            isDisabled={(iso) =>
              Boolean((min && iso < min) || (max && iso > max))
            }
          />
        </PopoverShell>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// <DateRangePicker> — from / to
// ────────────────────────────────────────────────────────────────────────────

export function DateRangePicker({
  from,
  to,
  onChange,
  min,
  max,
  labelFrom = "Check-in",
  labelTo = "Check-out",
  disabled = false,
  align = "left",
  className,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  min?: string;
  max?: string;
  labelFrom?: string;
  labelTo?: string;
  disabled?: boolean;
  align?: "left" | "right";
  className?: string;
}) {
  const { open, setOpen, wrapRef, popRef, pos } = usePopover(align);
  const [view, setView] = useState(() => {
    const b = fromISO(from) ?? fromISO(min) ?? new Date();
    return { y: b.getFullYear(), m: b.getMonth() };
  });

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  function pick(iso: string) {
    // No start yet, a complete range, or a click before the start → begin anew.
    if (!from || (from && to) || iso < from) onChange(iso, "");
    else {
      onChange(from, iso);
      setOpen(false);
    }
  }

  const fieldBox = (label: string, val: string) => (
    <div className="min-w-0 flex-1">
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
        {label}
      </div>
      <div
        className={cn(
          "truncate text-sm",
          val ? "text-brand-ink" : "text-brand-mute",
        )}
      >
        {val ? pretty(val) : "Add date"}
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const opening = !open;
          setOpen(opening);
          if (opening && from) {
            const d = fromISO(from);
            if (d) setView({ y: d.getFullYear(), m: d.getMonth() });
          }
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-left transition-colors hover:border-brand-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-brand-mute" />
        {fieldBox(labelFrom, from)}
        <div className="h-8 w-px shrink-0 self-center bg-brand-line" />
        {fieldBox(labelTo, to)}
      </button>
      {open && pos ? (
        <PopoverShell popRef={popRef} pos={pos}>
          <CalendarGrid
            view={view}
            shiftMonth={shiftMonth}
            onPick={pick}
            isSelected={(iso) => iso === from || iso === to}
            isInRange={(iso) => Boolean(from && to && iso > from && iso < to)}
            isDisabled={(iso) =>
              Boolean((min && iso < min) || (max && iso > max))
            }
          />
        </PopoverShell>
      ) : null}
    </div>
  );
}
