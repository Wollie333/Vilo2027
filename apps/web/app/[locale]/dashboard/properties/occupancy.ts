/**
 * Pure occupancy maths for the Listings dashboard KPIs + cards.
 *
 * Occupancy is "booked nights ÷ available nights" over a calendar month.
 * A booking occupies nights from check_in (inclusive) to check_out
 * (exclusive); available nights for one listing in a month = days in that
 * month. No I/O here — the page fetches the rows and feeds them in, which
 * keeps this testable and free of Supabase types.
 */

// Stays that actually hold inventory. Mirrors the revenue set used elsewhere
// (confirmed/checked_in/completed) plus checked_out — all are real occupied
// nights. Pending/cancelled/declined don't hold a night.
export const OCCUPIED_STATUSES = [
  "confirmed",
  "checked_in",
  "checked_out",
  "completed",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export type MonthWindow = {
  /** UTC ms at 00:00 on the 1st of the month. */
  startMs: number;
  /** UTC ms at 00:00 on the 1st of the NEXT month (exclusive end). */
  endMs: number;
  /** Whole days in the month. */
  days: number;
  /** Short month label, e.g. "Jun". */
  label: string;
  /** First day as an ISO date string (YYYY-MM-DD). */
  startISO: string;
  /** Exclusive end as an ISO date string (YYYY-MM-DD). */
  endISO: string;
};

/** Build the calendar-month window for a given year + 0-based month index. */
export function monthWindow(year: number, monthIdx: number): MonthWindow {
  const startMs = Date.UTC(year, monthIdx, 1);
  const endMs = Date.UTC(year, monthIdx + 1, 1);
  return {
    startMs,
    endMs,
    days: Math.round((endMs - startMs) / 86_400_000),
    label: MONTHS[((monthIdx % 12) + 12) % 12],
    startISO: new Date(startMs).toISOString().slice(0, 10),
    endISO: new Date(endMs).toISOString().slice(0, 10),
  };
}

/** Parse a 'YYYY-MM-DD' date as UTC midnight ms. */
export function dateToMs(d: string): number {
  return Date.parse(`${d}T00:00:00Z`);
}

/**
 * Nights a [checkIn, checkOut) stay contributes to a month window.
 * Both bounds are ISO date strings; returns 0 when there's no overlap.
 */
export function overlapNights(
  checkIn: string,
  checkOut: string,
  w: MonthWindow,
): number {
  const start = Math.max(dateToMs(checkIn), w.startMs);
  const end = Math.min(dateToMs(checkOut), w.endMs);
  return end > start ? Math.round((end - start) / 86_400_000) : 0;
}

/** Occupancy as a 0–100 integer, capped. Null when there are no available nights. */
export function occupancyPct(
  bookedNights: number,
  availableNights: number,
): number | null {
  if (availableNights <= 0) return null;
  return Math.min(100, Math.round((bookedNights / availableNights) * 100));
}

/** Format an upcoming check-in as "Today" or "14 Jun". */
export function formatNextDate(dateStr: string, todayStr: string): string {
  if (dateStr <= todayStr) return "Today";
  const d = new Date(dateToMs(dateStr));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
