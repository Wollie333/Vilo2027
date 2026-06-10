// Shared types, date helpers and status/origin maps for the calendar
// workspace. Pure (no React) so both the server page and client components
// import from here. Ported from the design mock's date logic; mock data
// removed — everything is driven by real DB rows.

export type CalStatus =
  | "confirmed"
  | "pending"
  | "inhouse"
  | "completed"
  | "cancelled";

// Vilo is direct-booking: "channel" = booking origin (not an OTA).
export type CalOrigin = "direct" | "manual" | "quote";

export type CalListing = {
  id: string;
  name: string;
  location: string;
  rooms: number;
  basePrice: number;
  cleaningFee: number;
  photo: string | null;
  tone: string;
};

export type CalBooking = {
  id: string;
  listingId: string;
  guest: string;
  avatar: string | null;
  ci: string; // check-in date key (inclusive)
  co: string; // check-out date key (exclusive)
  status: CalStatus;
  origin: CalOrigin;
  guests: number;
  rate: number; // per-night
  total: number;
  ciTime: string | null;
  coTime: string | null;
};

export type CalBlockKind = "manual" | "quote" | "booking" | "external";
export type CalBlock = {
  listingId: string;
  date: string;
  roomId: string | null;
  kind: CalBlockKind;
  source: string | null; // e.g. "Airbnb" for external iCal blocks
};

export type SeasonalRange = {
  listingId: string;
  start: string;
  end: string;
  price: number;
};

export const STATUS_META: Record<
  CalStatus,
  { label: string; color: string; soft: string; ink: string }
> = {
  confirmed: {
    label: "Confirmed",
    color: "#10B981",
    soft: "#D1FAE5",
    ink: "#047857",
  },
  pending: {
    label: "Pending",
    color: "#F59E0B",
    soft: "#FEF3C7",
    ink: "#B45309",
  },
  inhouse: {
    label: "In-house",
    color: "#0EA5E9",
    soft: "#E0F2FE",
    ink: "#0369A1",
  },
  completed: {
    label: "Completed",
    color: "#6366F1",
    soft: "#E0E7FF",
    ink: "#4338CA",
  },
  cancelled: {
    label: "Cancelled",
    color: "#EF4444",
    soft: "#FEE2E2",
    ink: "#B91C1C",
  },
};

export const ORIGIN_META: Record<
  CalOrigin,
  { label: string; color: string; mark: string }
> = {
  direct: { label: "Direct", color: "#10B981", mark: "V" },
  manual: { label: "Manual", color: "#064E3B", mark: "M" },
  quote: { label: "From quote", color: "#6366F1", mark: "Q" },
};

// Listing accent tones, assigned by index when we build CalListing rows.
export const LISTING_TONES = [
  "#10B981",
  "#0EA5E9",
  "#6366F1",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
];

export const MONTH_NAMES = [
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
export const DOW_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── DB → calendar mappers (used server-side) ───────────────────────
export function mapStatus(dbStatus: string): CalStatus {
  switch (dbStatus) {
    case "confirmed":
      return "confirmed";
    case "checked_in":
      return "inhouse";
    case "completed":
      return "completed";
    case "pending":
    case "pending_eft":
    case "pending_eft_review":
      return "pending";
    default:
      return "cancelled"; // cancelled_by_*, declined, expired, no_show
  }
}

export function mapOrigin(dbOrigin: string | null): CalOrigin {
  if (dbOrigin === "host_manual") return "manual";
  if (dbOrigin === "quote_converted") return "quote";
  return "direct";
}

// blocked_dates.reason → block kind. iCal import (when shipped) writes
// reason like "ical:airbnb"; until then there are simply no external rows.
export function blockKind(
  reason: string | null,
  bookingId: string | null,
): CalBlockKind {
  if (bookingId) return "booking";
  if (reason === "quote_pending") return "quote";
  if (reason && reason.startsWith("ical")) return "external";
  return "manual";
}
export function blockSource(reason: string | null): string | null {
  if (reason && reason.startsWith("ical:")) {
    const s = reason.slice(5);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return null;
}

// ── Date helpers (key = "YYYY-MM-DD", local) ───────────────────────
export const key = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function parseKey(k: string): { y: number; m: number; d: number } {
  const [y, m, d] = k.split("-").map(Number);
  return { y, m: m - 1, d };
}
export function dateFromKey(k: string): Date {
  const { y, m, d } = parseKey(k);
  return new Date(y, m, d);
}
export function keyFromDate(dt: Date): string {
  return key(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
export function addDays(k: string, n: number): string {
  const dt = dateFromKey(k);
  dt.setDate(dt.getDate() + n);
  return keyFromDate(dt);
}
export function nightsBetween(ciK: string, coK: string): number {
  return Math.round(
    (dateFromKey(coK).getTime() - dateFromKey(ciK).getTime()) / 86_400_000,
  );
}
export function fmtShort(k: string): string {
  const { m, d } = parseKey(k);
  return `${d} ${MONTH_NAMES[m].slice(0, 3)}`;
}
export function todayKey(): string {
  // Host wall-clock (Africa/Johannesburg) so "today" lines up for SA hosts.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
  }).format(new Date());
}

export type MatrixCell = {
  key: string;
  day: number;
  inMonth: boolean;
  dow: number;
  isWeekend: boolean;
};
export function monthMatrix(year: number, month: number): MatrixCell[][] {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const numWeeks = Math.ceil((startDow + daysInMonth) / 7);
  const start = new Date(year, month, 1 - startDow);
  const weeks: MatrixCell[][] = [];
  for (let w = 0; w < numWeeks; w++) {
    const days: MatrixCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      days.push({
        key: keyFromDate(dt),
        day: dt.getDate(),
        inMonth: dt.getMonth() === month,
        dow: d,
        isWeekend: d >= 5,
      });
    }
    weeks.push(days);
  }
  return weeks;
}

export type TimelineDay = { key: string; day: number; dow: number };
export function monthDays(year: number, month: number): TimelineDay[] {
  const n = new Date(year, month + 1, 0).getDate();
  const out: TimelineDay[] = [];
  for (let i = 1; i <= n; i++)
    out.push({
      key: key(year, month, i),
      day: i,
      dow: (new Date(year, month, i).getDay() + 6) % 7,
    });
  return out;
}

export const vmoney = (n: number) =>
  "R" + Math.round(n).toLocaleString("en-ZA");
