"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

// Inline single-month availability calendar for the quote builder. Picks a
// check-in → check-out range; cells that are already booked/blocked for the
// selected listing render hatched and can't be picked (or spanned).
function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function todayISO(): string {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}

export function QuoteCalendar({
  checkIn,
  checkOut,
  blocked,
  onChange,
}: {
  checkIn: string;
  checkOut: string;
  /** YYYY-MM-DD nights that are unavailable for the selected listing. */
  blocked: Set<string>;
  onChange: (checkIn: string, checkOut: string) => void;
}) {
  const initial = checkIn ? new Date(`${checkIn}T00:00:00`) : new Date();
  const [view, setView] = useState({
    y: initial.getFullYear(),
    m: initial.getMonth(),
  });

  const today = todayISO();

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    // Monday-first offset.
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(toISO(view.y, view.m, d));
    return out;
  }, [view]);

  // Would the range [a, b) cross a blocked night?
  function rangeClear(a: string, b: string): boolean {
    const start = new Date(`${a}T00:00:00`);
    const end = new Date(`${b}T00:00:00`);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      if (blocked.has(toISO(d.getFullYear(), d.getMonth(), d.getDate())))
        return false;
    }
    return true;
  }

  function pick(iso: string) {
    if (blocked.has(iso) || iso < today) return;
    // No start yet, or a full range already chosen → start fresh.
    if (!checkIn || (checkIn && checkOut)) {
      onChange(iso, "");
      return;
    }
    // Second click: set the end (must be after start + not span a block).
    if (iso <= checkIn) {
      onChange(iso, "");
      return;
    }
    if (!rangeClear(checkIn, iso)) {
      onChange(iso, "");
      return;
    }
    onChange(checkIn, iso);
  }

  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });

  function cellClass(iso: string | null): string {
    if (!iso) return "cal-empty";
    const isBlocked = blocked.has(iso) || iso < today;
    if (isBlocked) return "cal-blocked";
    if (checkIn && iso === checkIn) return "cal-start";
    if (checkOut && iso === checkOut) return "cal-end";
    if (checkIn && checkOut && iso > checkIn && iso < checkOut)
      return "cal-mid";
    return "cal-day";
  }

  return (
    <div className="rounded-[12px] border border-brand-line bg-brand-light/30 p-4">
      <style>{`
        .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
        .cal-day,.cal-blocked,.cal-start,.cal-end,.cal-mid,.cal-empty{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:12.5px;font-variant-numeric:tabular-nums;}
        .cal-day{cursor:pointer;color:#052E1F;}
        .cal-day:hover{background:#DCEAE0;}
        .cal-empty{color:transparent;}
        .cal-blocked{background:repeating-linear-gradient(45deg,#F0FDF4,#F0FDF4 4px,#DCEAE0 4px,#DCEAE0 5px);color:#94A3B8;text-decoration:line-through;cursor:not-allowed;}
        .cal-start,.cal-end{background:#10B981;color:#fff;font-weight:700;cursor:pointer;}
        .cal-mid{background:#D1FAE5;color:#064E3B;cursor:pointer;border-radius:0;}
        .cal-start{border-radius:8px 0 0 8px;}
        .cal-end{border-radius:0 8px 8px 0;}
      `}</style>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setView((v) =>
              v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 },
            )
          }
          className="flex h-7 w-7 items-center justify-center rounded-md text-brand-mute hover:bg-brand-accent/40"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="font-display text-[14px] font-bold text-brand-ink">
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={() =>
            setView((v) =>
              v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 },
            )
          }
          className="flex h-7 w-7 items-center justify-center rounded-md text-brand-mute hover:bg-brand-accent/40"
          aria-label="Next month"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="cal-grid mt-2">
        {cells.map((iso, i) =>
          iso ? (
            <div
              key={i}
              className={cellClass(iso)}
              onClick={() => pick(iso)}
              role="button"
              tabIndex={-1}
            >
              {Number(iso.slice(8))}
            </div>
          ) : (
            <div key={i} className="cal-empty" />
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10.5px] text-brand-mute">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-brand-primary" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-brand-accent" />
          Range
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded"
            style={{
              background:
                "repeating-linear-gradient(45deg,#F0FDF4,#F0FDF4 2px,#DCEAE0 2px,#DCEAE0 3px)",
            }}
          />
          Unavailable
        </span>
      </div>
    </div>
  );
}
