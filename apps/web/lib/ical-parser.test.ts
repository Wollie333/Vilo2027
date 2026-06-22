import { describe, expect, it } from "vitest";

import { parseIcal, rangesToDates } from "./ical-parser";

const wrap = (events: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", events, "END:VCALENDAR"].join("\r\n");

describe("parseIcal", () => {
  it("parses an all-day VEVENT with an exclusive DTEND", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "DTSTART;VALUE=DATE:20990612",
        "DTEND;VALUE=DATE:20990615",
        "SUMMARY:Reserved",
        "END:VEVENT",
      ].join("\r\n"),
    );
    expect(parseIcal(ics)).toEqual([
      { start: "2099-06-12", end: "2099-06-15", summary: "Reserved" },
    ]);
  });

  it("defaults a DTEND-less event to a single day", () => {
    const ics = wrap(
      ["BEGIN:VEVENT", "DTSTART;VALUE=DATE:20990612", "END:VEVENT"].join(
        "\r\n",
      ),
    );
    expect(parseIcal(ics)).toEqual([
      { start: "2099-06-12", end: "2099-06-13", summary: "" },
    ]);
  });

  it("rounds a DTSTART with a time component to the date", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "DTSTART:20990612T140000Z",
        "DTEND:20990613T100000Z",
        "END:VEVENT",
      ].join("\r\n"),
    );
    expect(parseIcal(ics)[0]).toMatchObject({
      start: "2099-06-12",
      end: "2099-06-13",
    });
  });

  it("unfolds folded (continuation) lines", () => {
    // RFC 5545 folds with CRLF + a single space; unfolding rejoins (here the
    // word "available" was split mid-word at the fold).
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "DTSTART;VALUE=DATE:20990612",
        "DTEND;VALUE=DATE:20990613",
        "SUMMARY:Airbnb (Not avail\r\n able)",
        "END:VEVENT",
      ].join("\r\n"),
    );
    expect(parseIcal(ics)[0].summary).toBe("Airbnb (Not available)");
  });

  it("parses multiple events and drops invalid (end <= start) ones", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "DTSTART;VALUE=DATE:20990601",
        "DTEND;VALUE=DATE:20990603",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "DTSTART;VALUE=DATE:20990610",
        "DTEND;VALUE=DATE:20990610",
        "END:VEVENT",
      ].join("\r\n"),
    );
    const out = parseIcal(ics);
    expect(out).toHaveLength(1);
    expect(out[0].start).toBe("2099-06-01");
  });

  it("returns nothing for a calendar with no events", () => {
    expect(parseIcal(wrap(""))).toEqual([]);
    expect(parseIcal("not even ical")).toEqual([]);
  });
});

describe("rangesToDates", () => {
  // Dates are clamped to [today, today + maxDays], so use offsets from today.
  const future = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  it("expands a half-open range to its blocked nights (end exclusive)", () => {
    expect(rangesToDates([{ start: future(10), end: future(13) }])).toEqual([
      future(10),
      future(11),
      future(12),
    ]);
  });

  it("dedupes overlapping ranges and sorts", () => {
    const out = rangesToDates([
      { start: future(12), end: future(14) },
      { start: future(11), end: future(13) },
    ]);
    expect(out).toEqual([future(11), future(12), future(13)]);
  });

  it("drops dates entirely in the past", () => {
    expect(rangesToDates([{ start: "2000-01-01", end: "2000-01-05" }])).toEqual(
      [],
    );
  });

  it("clamps ranges beyond the max window", () => {
    // 10-day window: a range starting 30 days out is entirely past the cutoff.
    expect(rangesToDates([{ start: future(30), end: future(40) }], 10)).toEqual(
      [],
    );
  });
});
