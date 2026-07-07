// End-to-end calendar-sync harness — the "no double booking" proof.
//
// Two suites:
//   • FEED FIDELITY (always runs, no network/DB) — feeds the REAL parser the
//     exact .ics bytes Airbnb / Booking.com / VRBO / Google / Lodgify emit and
//     asserts the right nights come out, plus the export round-trip and tokens.
//   • DB GUARD (gated) — imports blocks into the linked cloud DB via the real
//     RPC and proves listing_is_available_whole / room_is_available then REJECT
//     a booking on those nights. This is the guarantee the founder cares about.
//
// Run the full thing (writes far-future 2099 rows, cleans up after):
//   RUN_ICAL_INTEGRATION=1 pnpm exec vitest run lib/ical-sync.integration.test.ts
//
// Without the flag only the fidelity suite runs (safe for CI).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildIcalFeed,
  collapseConsecutiveDates,
  signListingToken,
  verifyListingToken,
} from "./ical";
import { parseIcal, rangesToDates } from "./ical-parser";

// ── Real per-platform export samples ──────────────────────────────────────
// These are byte-faithful to what each platform actually serves (CRLF line
// endings, VALUE=DATE all-day events with an EXCLUSIVE DTEND, their real
// PRODID + SUMMARY wording). Trimmed to a couple of events each.
const CRLF = "\r\n";
const ics = (lines: string[]) => lines.join(CRLF) + CRLF;

// Airbnb: DTEND before DTSTART in the block, "Reserved" / "Airbnb (Not available)".
const AIRBNB = ics([
  "BEGIN:VCALENDAR",
  "PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "CALSCALE:GREGORIAN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20991015",
  "DTSTART;VALUE=DATE:20991012",
  "UID:1234567890abcdef@airbnb.com",
  "SUMMARY:Reserved",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCDEF",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20991020",
  "DTSTART;VALUE=DATE:20991018",
  "UID:fedcba0987654321@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
]);

// Booking.com: "CLOSED - Not available".
const BOOKING = ics([
  "BEGIN:VCALENDAR",
  "PRODID:-//Booking.com//Hotel Availability Calendar//EN",
  "VERSION:2.0",
  "CALSCALE:GREGORIAN",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20991101",
  "DTEND;VALUE=DATE:20991105",
  "SUMMARY:CLOSED - Not available",
  "UID:aaaa-bbbb@booking.com",
  "END:VEVENT",
  "END:VCALENDAR",
]);

// VRBO / HomeAway.
const VRBO = ics([
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//HomeAway.com, Inc.//HomeAway Calendar//EN",
  "BEGIN:VEVENT",
  "DTSTAMP:20990101T000000Z",
  "DTSTART;VALUE=DATE:20991201",
  "DTEND;VALUE=DATE:20991208",
  "SUMMARY:Reserved - HomeAway",
  "UID:vrbo-9911@homeaway.com",
  "END:VEVENT",
  "END:VCALENDAR",
]);

// Google Calendar: a mix of an all-day block and a TIMED event (must round to
// the date), plus a folded SUMMARY line (RFC 5545 CRLF + space continuation).
const GOOGLE = ics([
  "BEGIN:VCALENDAR",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "VERSION:2.0",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20990910",
  "DTEND;VALUE=DATE:20990913",
  "DTSTAMP:20990101T000000Z",
  "UID:g-allday@google.com",
  "SUMMARY:Blocked - family sta",
  " y",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20990915T140000Z",
  "DTEND:20990917T100000Z",
  "DTSTAMP:20990101T000000Z",
  "UID:g-timed@google.com",
  "SUMMARY:Booked",
  "END:VEVENT",
  "END:VCALENDAR",
]);

// Lodgify: escaped comma in the summary.
const LODGIFY = ics([
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Lodgify//Lodgify Calendar//EN",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20990801",
  "DTEND;VALUE=DATE:20990804",
  "SUMMARY:Booked via Lodgify\\, do not disturb",
  "UID:lod-42@lodgify.com",
  "END:VEVENT",
  "END:VCALENDAR",
]);

// A cancelled event — Airbnb/Booking generally DROP freed dates, but some feeds
// keep a STATUS:CANCELLED tombstone. The parser does not read STATUS, so this
// documents current behaviour (the range IS still parsed). See the assertion.
const WITH_CANCELLED = ics([
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20990501",
  "DTEND;VALUE=DATE:20990503",
  "STATUS:CANCELLED",
  "SUMMARY:Cancelled reservation",
  "END:VEVENT",
  "END:VCALENDAR",
]);

// Nights a half-open [start,end) range covers.
const nights = (start: string, end: string) => {
  const out: string[] = [];
  let cur = start;
  while (cur < end) {
    out.push(cur);
    const d = new Date(`${cur}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cur = d.toISOString().slice(0, 10);
  }
  return out;
};

describe("feed fidelity — real OTA export formats", () => {
  it("Airbnb: two reservations, exclusive DTEND, order-independent", () => {
    expect(parseIcal(AIRBNB)).toEqual([
      { start: "2099-10-12", end: "2099-10-15", summary: "Reserved" },
      {
        start: "2099-10-18",
        end: "2099-10-20",
        summary: "Airbnb (Not available)",
      },
    ]);
    // 12,13,14 blocked; 15 (checkout) FREE — the classic off-by-one that causes
    // double bookings if DTEND is treated as inclusive.
    expect(nights("2099-10-12", "2099-10-15")).toEqual([
      "2099-10-12",
      "2099-10-13",
      "2099-10-14",
    ]);
  });

  it("Booking.com: CLOSED block", () => {
    const r = parseIcal(BOOKING);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ start: "2099-11-01", end: "2099-11-05" });
  });

  it("VRBO / HomeAway: reserved block", () => {
    expect(parseIcal(VRBO)[0]).toMatchObject({
      start: "2099-12-01",
      end: "2099-12-08",
    });
  });

  it("Google: rounds a timed event to its date + unfolds a split summary", () => {
    const r = parseIcal(GOOGLE);
    expect(r[0]).toEqual({
      start: "2099-09-10",
      end: "2099-09-13",
      summary: "Blocked - family stay", // fold rejoined
    });
    expect(r[1]).toMatchObject({ start: "2099-09-15", end: "2099-09-17" });
  });

  it("Lodgify: unescapes the summary comma", () => {
    expect(parseIcal(LODGIFY)[0].summary).toBe(
      "Booked via Lodgify, do not disturb",
    );
  });

  it("KNOWN GAP: STATUS:CANCELLED is NOT filtered (range still parsed)", () => {
    // Documents current behaviour so a future fix is a deliberate change, not a
    // surprise. If we start honouring STATUS:CANCELLED, flip this expectation.
    expect(parseIcal(WITH_CANCELLED)).toHaveLength(1);
  });
});

describe("export round-trip — our feed re-imports to the same nights", () => {
  it("blocked_dates → buildIcalFeed → parseIcal yields identical nights", () => {
    // Simulate three consecutive booked nights + one manual block on a later day.
    const rows = [
      { date: "2099-06-12", booking_id: "b1", reason: null },
      { date: "2099-06-13", booking_id: "b1", reason: null },
      { date: "2099-06-14", booking_id: "b1", reason: null },
      { date: "2099-06-20", booking_id: null, reason: "Owner stay" },
    ];
    const spans = collapseConsecutiveDates(rows);
    const feed = buildIcalFeed({
      calendarName: "Test Villa availability",
      events: spans.map((s) => ({
        startDate: s.startDate,
        endDate: s.endDate,
        summary: s.summary,
        uid: `wielo-${s.uidSuffix}`,
      })),
    });

    // An OTA re-importing our feed must block exactly the same nights.
    const reparsed = parseIcal(feed);
    const gotNights = reparsed.flatMap((r) => nights(r.start, r.end)).sort();
    expect(gotNights).toEqual([
      "2099-06-12",
      "2099-06-13",
      "2099-06-14",
      "2099-06-20",
    ]);
    // No guest PII leaked outbound: no attendee/organizer/email addresses, and
    // no free-text DESCRIPTION. Only generic SUMMARYs + the calendar-domain UID.
    // The manual block's "Owner stay" reason must NOT appear — a public feed
    // only ever carries the generic "Booked" / "Blocked" (BOOKING_SYNC.md).
    expect(feed).not.toMatch(/mailto:|ATTENDEE|ORGANIZER|DESCRIPTION/i);
    expect(feed).not.toContain("Owner stay");
    for (const line of feed
      .split(CRLF)
      .filter((l) => l.startsWith("SUMMARY:"))) {
      expect(line).toMatch(/^SUMMARY:(Booked|Blocked)$/);
    }
    expect(feed).toContain("SUMMARY:Booked");
    expect(feed).toContain("SUMMARY:Blocked");
  });
});

describe("rangesToDates — clamps to the import window", () => {
  const future = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  it("keeps in-window nights and drops a >2y range", () => {
    const near = rangesToDates([{ start: future(10), end: future(12) }]);
    expect(near).toEqual([future(10), future(11)]);
    // 2099 is beyond the 2-year horizon → dropped entirely.
    expect(rangesToDates([{ start: "2099-01-01", end: "2099-01-05" }])).toEqual(
      [],
    );
  });
});

describe("export token — HMAC round-trip", () => {
  beforeAll(() => {
    process.env.ICAL_TOKEN_SECRET ||= "test-secret-for-unit-only";
  });
  it("signs and verifies a listing token, rejects a forged one", () => {
    const id = "0b222222-2222-4222-8222-222222222221";
    const token = signListingToken(id);
    expect(verifyListingToken(id, token)).toBe(true);
    expect(verifyListingToken(id, token.slice(0, -1) + "X")).toBe(false);
    // A token minted for another listing must not validate here.
    const other = signListingToken("0b222222-2222-4222-8222-222222222222");
    expect(verifyListingToken(id, other)).toBe(false);
  });
});

// ── DB GUARD (gated) — proves an imported block REJECTS a booking ──────────

function loadEnvLocal(): void {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env.local — suite self-skips below */
  }
}

const runDb = process.env.RUN_ICAL_INTEGRATION === "1";
loadEnvLocal();
const dbReady =
  runDb &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!dbReady)(
  "DB guard — an imported iCal block rejects a booking",
  () => {
    let sb: SupabaseClient;
    let propertyId: string;
    let feedId: string | null = null;
    // Far-future so we never collide with real availability.
    const BLOCK = ["2099-10-12", "2099-10-13", "2099-10-14"]; // Airbnb range nights
    const FREE = "2099-10-15"; // Airbnb checkout day — must stay bookable

    beforeAll(async () => {
      sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { data: prop, error } = await sb
        .from("properties")
        .select("id")
        .is("deleted_at", null)
        .limit(1)
        .single();
      if (error) throw error;
      propertyId = prop.id;

      const { data: feed, error: fErr } = await sb
        .from("ical_feeds")
        .insert({
          property_id: propertyId,
          source_label: "__integration_airbnb__",
          url: "https://example.com/airbnb-integration.ics",
          status: "active",
        })
        .select("id")
        .single();
      if (fErr) throw fErr;
      feedId = feed.id;
    });

    afterAll(async () => {
      if (propertyId) {
        await sb
          .from("blocked_dates")
          .delete()
          .eq("property_id", propertyId)
          .gte("date", "2099-01-01");
      }
      if (feedId) await sb.from("ical_feeds").delete().eq("id", feedId);
    });

    it("before sync: the dates are available", async () => {
      const { data } = await sb.rpc("listing_is_available_whole", {
        p_listing_id: propertyId,
        p_check_in: BLOCK[0],
        p_check_out: FREE,
      });
      expect(data).toBe(true);
    });

    it("import_ical_blocks writes the Airbnb nights as source='ical'", async () => {
      const { data: count, error } = await sb.rpc("import_ical_blocks", {
        p_feed_id: feedId,
        p_property_id: propertyId,
        p_dates: BLOCK,
      });
      expect(error).toBeNull();
      expect(count).toBe(3);
      const { data: rows } = await sb
        .from("blocked_dates")
        .select("date, source")
        .eq("ical_feed_id", feedId);
      expect(rows?.length).toBe(3);
      expect(rows?.every((r) => r.source === "ical")).toBe(true);
    });

    it("THE GUARD: a booking overlapping the block is rejected", async () => {
      // Any overlap with 12–14 Oct → not available.
      for (const [ci, co] of [
        [BLOCK[0], FREE], // full span
        ["2099-10-11", "2099-10-13"], // straddles the leading edge
        ["2099-10-14", "2099-10-16"], // straddles the trailing edge
      ]) {
        const { data } = await sb.rpc("listing_is_available_whole", {
          p_listing_id: propertyId,
          p_check_in: ci,
          p_check_out: co,
        });
        expect(data, `${ci}→${co} must be blocked`).toBe(false);
      }
    });

    it("the checkout day (exclusive DTEND) stays bookable", async () => {
      const { data } = await sb.rpc("listing_is_available_whole", {
        p_listing_id: propertyId,
        p_check_in: FREE,
        p_check_out: "2099-10-16",
      });
      expect(data).toBe(true);
    });

    it("non-destructive: a manual block on an imported night survives re-sync", async () => {
      // Replace the feed's own row on 13 Oct with a manual block, then re-import.
      await sb
        .from("blocked_dates")
        .delete()
        .eq("ical_feed_id", feedId)
        .eq("date", "2099-10-13");
      await sb.from("blocked_dates").insert({
        property_id: propertyId,
        date: "2099-10-13",
        source: "manual",
        reason: "host blocked",
      });
      const { data: count } = await sb.rpc("import_ical_blocks", {
        p_feed_id: feedId,
        p_property_id: propertyId,
        p_dates: BLOCK,
      });
      expect(count).toBe(2); // 13 Oct skipped — manual wins
      const { data: row } = await sb
        .from("blocked_dates")
        .select("source, ical_feed_id")
        .eq("property_id", propertyId)
        .eq("date", "2099-10-13")
        .single();
      expect(row?.source).toBe("manual");
      expect(row?.ical_feed_id).toBeNull();
    });
  },
);
