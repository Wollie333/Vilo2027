/**
 * Tiny RFC 5545 parser for the import side of calendar sync.
 *
 * Handles the subset of iCal that matters for Airbnb / Booking.com /
 * any sane OTA: VEVENT with DTSTART + DTEND as VALUE=DATE (all-day).
 * Returns an array of {start, end} ranges where `end` is *exclusive*
 * (per RFC 5545 for VALUE=DATE).
 *
 * Notable shortcuts:
 *  - RRULE / EXDATE / VTIMEZONE all ignored (Airbnb doesn't emit them).
 *  - DTSTART with a time part (DTSTART:20260615T120000Z) is rounded to
 *    the date portion.
 *  - Folded lines (CRLF + space continuation) are unfolded.
 *  - DTEND-less events default to a one-day span (DTSTART .. DTSTART+1).
 */

export type ParsedRange = {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exclusive)
  summary?: string;
};

function unfold(input: string): string[] {
  // Per RFC 5545: lines folded with CRLF + whitespace.
  return input
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .split(/\r?\n/);
}

function isoFromIcal(value: string): string {
  // Accepts both "20260615" and "20260615T120000Z" forms.
  const compact = value.slice(0, 8);
  if (!/^\d{8}$/.test(compact)) return "";
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseIcal(text: string): ParsedRange[] {
  const lines = unfold(text);
  const ranges: ParsedRange[] = [];

  let inEvent = false;
  let start: string | null = null;
  let end: string | null = null;
  let summary = "";
  let cancelled = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      start = null;
      end = null;
      summary = "";
      cancelled = false;
      continue;
    }
    if (line === "END:VEVENT") {
      // Skip cancelled reservations — some feeds keep a STATUS:CANCELLED
      // tombstone for freed dates; blocking those would falsely mark a now-open
      // night as unavailable (lost bookings).
      if (inEvent && start && !cancelled) {
        // Default to one-day if DTEND missing.
        const effectiveEnd = end ?? addDays(start, 1);
        ranges.push({ start, end: effectiveEnd, summary });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    // Properties may have parameters (DTSTART;VALUE=DATE:20260615).
    // We only care about the value past the first colon.
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);

    if (key.startsWith("DTSTART")) {
      start = isoFromIcal(value);
    } else if (key.startsWith("DTEND")) {
      end = isoFromIcal(value);
    } else if (key === "SUMMARY") {
      summary = value.replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
    } else if (key === "STATUS") {
      cancelled = value.trim().toUpperCase() === "CANCELLED";
    }
  }

  return ranges.filter((r) => r.start && r.end && r.start < r.end);
}

/**
 * Expand half-open date ranges into the set of date strings they block.
 * Skips dates outside [today, today + maxDays].
 */
export function rangesToDates(
  ranges: ParsedRange[],
  maxDays: number = 365 * 2,
): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = addDays(today, maxDays);

  const dates = new Set<string>();
  for (const r of ranges) {
    let cur = r.start < today ? today : r.start;
    const stop = r.end > cutoff ? cutoff : r.end;
    while (cur < stop) {
      dates.add(cur);
      cur = addDays(cur, 1);
    }
  }
  return Array.from(dates).sort();
}
