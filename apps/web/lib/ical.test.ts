import { beforeAll, describe, expect, it } from "vitest";

import {
  buildIcalFeed,
  collapseConsecutiveDates,
  signListingToken,
  verifyListingToken,
} from "./ical";

beforeAll(() => {
  process.env.ICAL_TOKEN_SECRET = "test-secret-for-ical-tokens";
});

describe("listing feed tokens", () => {
  const id = "11111111-1111-1111-1111-111111111111";

  it("is deterministic and 22 url-safe chars", () => {
    const t = signListingToken(id);
    expect(t).toHaveLength(22);
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(signListingToken(id)).toBe(t);
  });

  it("differs per listing", () => {
    expect(signListingToken(id)).not.toBe(
      signListingToken("22222222-2222-2222-2222-222222222222"),
    );
  });

  it("verifies the right token and rejects wrong/empty/tampered", () => {
    const t = signListingToken(id);
    expect(verifyListingToken(id, t)).toBe(true);
    expect(verifyListingToken(id, "")).toBe(false);
    expect(verifyListingToken(id, t.slice(0, 21))).toBe(false); // wrong length
    expect(verifyListingToken(id, "x" + t.slice(1))).toBe(false); // tampered
    expect(verifyListingToken("33333333-3333-3333-3333-333333333333", t)).toBe(
      false,
    );
  });

  it("throws when the secret is unset", () => {
    const prev = process.env.ICAL_TOKEN_SECRET;
    delete process.env.ICAL_TOKEN_SECRET;
    expect(() => signListingToken(id)).toThrow();
    process.env.ICAL_TOKEN_SECRET = prev;
  });
});

describe("buildIcalFeed (RFC 5545 export)", () => {
  const feed = buildIcalFeed({
    calendarName: "Wielo — Olive Grove",
    events: [
      {
        startDate: "2099-06-12",
        endDate: "2099-06-15",
        summary: "Booked",
        uid: "abc-123",
      },
    ],
  });

  it("wraps a valid VCALENDAR with CRLF line endings", () => {
    expect(feed.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(feed.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(feed).toContain("VERSION:2.0");
    expect(feed).toContain("PRODID:-//Vilo Platform//Wielo//EN");
    expect(feed.includes("\r\n")).toBe(true);
  });

  it("emits compact all-day DTSTART/DTEND (end exclusive)", () => {
    expect(feed).toContain("DTSTART;VALUE=DATE:20990612");
    expect(feed).toContain("DTEND;VALUE=DATE:20990615");
    expect(feed).toContain("UID:abc-123@wieloplatform.com");
    expect(feed).toContain("SUMMARY:Booked");
  });

  it("never leaks guest PII — summary is exactly what we pass", () => {
    // Generic summaries only; the export builder has no access to guest data.
    expect(feed).not.toMatch(/@(?!wieloplatform)/); // no guest emails
    expect(feed.match(/SUMMARY:/g)).toHaveLength(1);
  });

  it("escapes special chars in the calendar name", () => {
    const f = buildIcalFeed({
      calendarName: "A, B; C\\D",
      events: [],
    });
    expect(f).toContain("X-WR-CALNAME:A\\, B\\; C\\\\D");
  });
});

describe("collapseConsecutiveDates", () => {
  it("merges consecutive same-kind days into one exclusive-end span", () => {
    const out = collapseConsecutiveDates([
      { date: "2099-06-12", booking_id: "b1", reason: null },
      { date: "2099-06-13", booking_id: "b1", reason: null },
      { date: "2099-06-14", booking_id: "b1", reason: null },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      startDate: "2099-06-12",
      endDate: "2099-06-15", // last night + 1 (exclusive)
      summary: "Booked",
    });
  });

  it("splits a non-consecutive gap into separate spans", () => {
    const out = collapseConsecutiveDates([
      { date: "2099-06-12", booking_id: null, reason: "Maintenance" },
      { date: "2099-06-14", booking_id: null, reason: "Maintenance" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].summary).toBe("Maintenance");
  });

  it("splits when the kind changes (booking vs manual)", () => {
    const out = collapseConsecutiveDates([
      { date: "2099-06-12", booking_id: "b1", reason: null },
      { date: "2099-06-13", booking_id: null, reason: "Blocked" },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.summary).sort()).toEqual(["Blocked", "Booked"]);
  });

  it("groups by room and never collapses across rooms", () => {
    const out = collapseConsecutiveDates([
      {
        date: "2099-06-12",
        booking_id: "b1",
        reason: null,
        room_name: "Suite",
      },
      { date: "2099-06-12", booking_id: "b2", reason: null, room_name: "Loft" },
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((s) => /Booked: (Suite|Loft)/.test(s.summary))).toBe(true);
  });

  it("returns nothing for an empty list", () => {
    expect(collapseConsecutiveDates([])).toEqual([]);
  });
});
