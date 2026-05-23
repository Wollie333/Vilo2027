import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Per-listing iCal feed tokens. Derived from `ICAL_TOKEN_SECRET` + the
 * listing id via HMAC SHA-256, then truncated and base64url-encoded.
 *
 * Per AGENT_RULES.md §2.6 the token is a per-listing secret. We don't
 * persist it (no `ical_feeds` table yet); rotating it globally just means
 * rotating `ICAL_TOKEN_SECRET`. Per-listing rotation lands with the
 * `ical_feeds` migration in Phase 3.
 *
 * Falls back to `SUPABASE_SERVICE_ROLE_KEY` if `ICAL_TOKEN_SECRET` is
 * missing — both are server-side-only so the URL is still unguessable
 * without leaked env vars.
 */
function secret(): string {
  return (
    process.env.ICAL_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export function signListingToken(listingId: string): string {
  const s = secret();
  if (!s) throw new Error("iCal token secret is not configured.");
  const mac = createHmac("sha256", s).update(listingId).digest();
  // Base64url, take first 22 chars — ~128 bits of entropy.
  return mac
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
    .slice(0, 22);
}

export function verifyListingToken(
  listingId: string,
  candidate: string,
): boolean {
  if (!candidate || candidate.length === 0) return false;
  const expected = signListingToken(listingId);
  if (expected.length !== candidate.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
}

// ── RFC 5545 generation ───────────────────────────────────────

export type IcalEvent = {
  // YYYY-MM-DD — start date (inclusive)
  startDate: string;
  // YYYY-MM-DD — end date (exclusive, per RFC 5545 DTEND for all-day)
  endDate: string;
  summary: string;
  // Stable per-event id used for UID. We salt with the listing id so the
  // feed for two different listings can never produce the same UID.
  uid: string;
};

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function isoDateToCompact(iso: string): string {
  // "2026-11-14" → "20261114"
  return iso.replace(/-/g, "");
}

export function buildIcalFeed({
  calendarName,
  events,
}: {
  calendarName: string;
  events: IcalEvent[];
}): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vilo Platform//Vilo//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `NAME:${escapeText(calendarName)}`,
  ];

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}@viloplatform.com`,
      `DTSTAMP:${now}`,
      `SUMMARY:${escapeText(ev.summary)}`,
      `DTSTART;VALUE=DATE:${isoDateToCompact(ev.startDate)}`,
      `DTEND;VALUE=DATE:${isoDateToCompact(ev.endDate)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  // RFC 5545 requires CRLF.
  return lines.join("\r\n") + "\r\n";
}

/**
 * Collapse consecutive single-day blocked-date rows into multi-day spans.
 * Vilo writes one row per day in `blocked_dates`; most calendar consumers
 * (Airbnb, Booking.com, Apple Calendar) read multi-day VEVENTs better than
 * one VEVENT per night.
 */
export function collapseConsecutiveDates(
  rows: Array<{
    date: string;
    booking_id: string | null;
    reason: string | null;
  }>,
): Array<{
  startDate: string;
  endDate: string;
  summary: string;
  uidSuffix: string;
}> {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));

  const out: Array<{
    startDate: string;
    endDate: string;
    summary: string;
    uidSuffix: string;
  }> = [];

  let runStart = sorted[0];
  let runEnd = sorted[0];

  function flush() {
    // DTEND is exclusive for all-day → add one day.
    const end = new Date(`${runEnd.date}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const endIso = end.toISOString().slice(0, 10);
    out.push({
      startDate: runStart.date,
      endDate: endIso,
      summary: runStart.booking_id ? "Booked" : runStart.reason || "Blocked",
      // UID derived from start + end so re-syncs collapse to the same event.
      uidSuffix: `${runStart.date}-${endIso}`,
    });
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${runEnd.date}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() + 1);
    const expectNext = prev.toISOString().slice(0, 10);
    const reasonChanged =
      Boolean(sorted[i].booking_id) !== Boolean(runEnd.booking_id);
    if (sorted[i].date === expectNext && !reasonChanged) {
      runEnd = sorted[i];
    } else {
      flush();
      runStart = sorted[i];
      runEnd = sorted[i];
    }
  }
  flush();

  return out;
}
