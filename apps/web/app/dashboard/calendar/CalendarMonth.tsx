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
}: {
  year: number;
  month: number;
  blocks: Map<string, CalendarBlock>;
}) {
  const today = new Date();

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

          const cls = block
            ? block.booking_id
              ? "bg-brand-primary text-white font-semibold"
              : "bg-brand-line text-brand-mute"
            : "text-brand-dark";

          return (
            <div
              key={iso}
              className={`flex h-7 items-center justify-center rounded text-[11px] ${cls} ${
                isToday ? "ring-2 ring-brand-dark" : ""
              }`}
              title={
                block?.booking_id
                  ? "Booked"
                  : block
                    ? block.reason || "Blocked"
                    : ""
              }
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
