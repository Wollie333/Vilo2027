"use client";

const MONTH_NAMES = [
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
] as const;

const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isSameDay(y: number, m: number, d: number, ref: Date): boolean {
  return ref.getFullYear() === y && ref.getMonth() === m && ref.getDate() === d;
}

export type CalendarBlock = {
  date: string;
  reason: string | null;
  booking_id: string | null;
};

export function CalendarMonth({
  year,
  month,
  blocks,
  onToggle,
  pendingIso,
}: {
  year: number;
  month: number;
  blocks: Map<string, CalendarBlock>;
  onToggle?: (iso: string) => void;
  pendingIso?: string | null;
}) {
  const today = new Date();
  // Midnight today, used to gate past-date clicks (you can't manually block
  // yesterday — the booking system has already settled it).
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  // First day of month in JS is 0=Sun … shift to Mo-first.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="mb-3 font-display text-sm font-semibold text-brand-ink">
        {MONTH_NAMES[month]} {year}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DAY_HEADERS.map((h) => (
          <div
            key={h}
            className="px-1 py-1 text-center text-[10px] font-semibold uppercase text-brand-mute"
          >
            {h}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} className="h-7" />;
          const iso = isoDate(year, month, day);
          const block = blocks.get(iso);
          const isToday = isSameDay(year, month, day, today);
          const cellDate = new Date(year, month, day);
          const isPast = cellDate < todayMidnight;
          const isPending = pendingIso === iso;

          const isBooked = block != null && block.booking_id != null;
          const isQuoteHold =
            block != null &&
            block.booking_id == null &&
            block.reason === "quote_pending";
          const isManual = block != null && !isBooked && !isQuoteHold;

          // Hosts can only toggle manual blocks (block empty days, unblock
          // their own manual blocks). Booked + quote-held days are locked.
          const canClick =
            onToggle != null && !isPast && !isBooked && !isQuoteHold;

          const cls = isBooked
            ? "bg-brand-primary text-white font-semibold"
            : isQuoteHold
              ? "bg-status-pending/20 text-status-pending font-medium border border-dashed border-status-pending"
              : isManual
                ? "bg-brand-line text-brand-mute font-medium"
                : isPast
                  ? "text-brand-mute/50"
                  : "text-brand-dark hover:bg-brand-accent hover:text-brand-secondary";

          const titleText = isBooked
            ? "Booked — cancel the booking to free this date."
            : isQuoteHold
              ? "Quote pending — decline the quote to free this date."
              : isManual
                ? "Click to unblock"
                : isPast
                  ? "Past date"
                  : "Click to block this date";

          const baseClasses = `flex h-7 items-center justify-center rounded text-[11px] transition-colors ${cls} ${
            isToday ? "ring-2 ring-brand-dark" : ""
          } ${isPending ? "opacity-60" : ""}`;

          if (canClick) {
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onToggle?.(iso)}
                disabled={isPending}
                title={titleText}
                aria-label={`${MONTH_NAMES[month]} ${day}, ${year} — ${isManual ? "blocked" : "available"}`}
                className={`${baseClasses} cursor-pointer`}
              >
                {day}
              </button>
            );
          }

          return (
            <div
              key={iso}
              className={baseClasses}
              title={titleText}
              aria-label={`${MONTH_NAMES[month]} ${day}, ${year} — ${isBooked ? "booked" : isQuoteHold ? "quote pending" : isPast ? "past" : "available"}`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
