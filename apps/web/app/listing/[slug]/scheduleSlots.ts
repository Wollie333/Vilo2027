// Helpers to expand a listing's schedule jsonb into upcoming bookable slots.
//
// Schedule shape is one of:
//   { kind: "recurring", days: [{ day_of_week: 0-6, times: ["HH:MM", ...] }] }
//   { kind: "specific",  dates: [{ date: "YYYY-MM-DD", time: "HH:MM" }] }
//
// We deliberately don't filter by availability (booked slots) here — that's
// post-MVP. The host can still decline a clash from /dashboard/bookings.

export type ScheduleRecurringDay = {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  times: string[];
};
export type ScheduleSpecificEntry = { date: string; time: string };
export type ListingSchedule =
  | { kind: "recurring"; days: ScheduleRecurringDay[] }
  | { kind: "specific"; dates: ScheduleSpecificEntry[] };

export type UpcomingSlot = {
  // ISO-8601 in LOCAL host time (no timezone info — guest's browser renders it).
  // Format: YYYY-MM-DDTHH:MM
  iso: string;
  date: string;
  time: string;
};

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Expand a schedule into the next `count` upcoming slots starting from now.
 * Returns a stable sorted list (earliest first). For recurring schedules,
 * walks forward day by day across the chosen days of week.
 */
export function nextSlots(
  schedule: ListingSchedule | null,
  count = 12,
  fromDate: Date = new Date(),
): UpcomingSlot[] {
  if (!schedule) return [];

  if (schedule.kind === "specific") {
    return schedule.dates
      .filter(
        (d) =>
          DATE_RE.test(d.date) &&
          TIME_RE.test(d.time) &&
          // Drop entries that are already in the past.
          new Date(`${d.date}T${d.time}:00`) > fromDate,
      )
      .sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      )
      .slice(0, count)
      .map((d) => ({ iso: `${d.date}T${d.time}`, date: d.date, time: d.time }));
  }

  // Recurring — walk forward day by day for up to 60 days, collecting matches.
  const byDay = new Map<number, string[]>();
  for (const d of schedule.days) {
    if (d.times.length === 0) continue;
    byDay.set(d.day_of_week, d.times.filter((t) => TIME_RE.test(t)).sort());
  }
  if (byDay.size === 0) return [];

  const slots: UpcomingSlot[] = [];
  const cursor = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
  );
  const maxDays = 60;
  for (let i = 0; i < maxDays && slots.length < count; i++) {
    const dow = cursor.getDay();
    const times = byDay.get(dow);
    if (times) {
      const isoDate = cursor.toISOString().slice(0, 10);
      for (const time of times) {
        const slotDate = new Date(`${isoDate}T${time}:00`);
        if (slotDate > fromDate) {
          slots.push({ iso: `${isoDate}T${time}`, date: isoDate, time });
          if (slots.length >= count) break;
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

export function formatSlotLabel(slot: UpcomingSlot): string {
  const d = new Date(`${slot.iso}:00`);
  const date = d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${date} · ${slot.time}`;
}
