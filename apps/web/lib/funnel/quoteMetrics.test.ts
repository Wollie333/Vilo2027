import { describe, expect, it } from "vitest";

import { median, summariseQuoteLatency } from "./quoteMetrics";

// WS-7 — the ">70% of posted requests get 2 quotes within 24h" launch gate. The
// platform has no quote history yet, so the live page can only show zeros; these
// pin the maths that decides whether guest ad spend is allowed to scale.

const PUBLISHED = "2026-07-01T08:00:00.000Z";
const at = (hoursAfter: number) =>
  new Date(Date.parse(PUBLISHED) + hoursAfter * 3_600_000).toISOString();

describe("summariseQuoteLatency", () => {
  it("counts a request with 2 quotes inside 24h", () => {
    const m = summariseQuoteLatency(
      [{ id: "p1", created_at: PUBLISHED }],
      [
        { post_id: "p1", sent_at: at(2) },
        { post_id: "p1", sent_at: at(20) },
      ],
    );
    expect(m).toEqual({
      postsCreated: 1,
      postsWithAnyQuote: 1,
      postsWithTwoQuotesIn24h: 1,
      medianHoursToFirstQuote: 2,
    });
  });

  it("does NOT count 2 quotes when the second lands after 24h", () => {
    const m = summariseQuoteLatency(
      [{ id: "p1", created_at: PUBLISHED }],
      [
        { post_id: "p1", sent_at: at(3) },
        { post_id: "p1", sent_at: at(30) },
      ],
    );
    expect(m.postsWithAnyQuote).toBe(1);
    expect(m.postsWithTwoQuotesIn24h).toBe(0);
  });

  it("treats exactly 24h as inside the window, 24h+1ms as outside", () => {
    const inside = summariseQuoteLatency(
      [{ id: "p", created_at: PUBLISHED }],
      [
        { post_id: "p", sent_at: at(1) },
        { post_id: "p", sent_at: at(24) },
      ],
    );
    const outside = summariseQuoteLatency(
      [{ id: "p", created_at: PUBLISHED }],
      [
        { post_id: "p", sent_at: at(1) },
        {
          post_id: "p",
          sent_at: new Date(Date.parse(PUBLISHED) + 86_400_001).toISOString(),
        },
      ],
    );
    expect(inside.postsWithTwoQuotesIn24h).toBe(1);
    expect(outside.postsWithTwoQuotesIn24h).toBe(0);
  });

  it("ignores a quote timestamped before the request existed", () => {
    const m = summariseQuoteLatency(
      [{ id: "p", created_at: PUBLISHED }],
      [
        { post_id: "p", sent_at: at(-5) },
        { post_id: "p", sent_at: at(4) },
      ],
    );
    expect(m.postsWithTwoQuotesIn24h).toBe(0);
  });

  it("never credits one request's quotes to another", () => {
    const m = summariseQuoteLatency(
      [
        { id: "p1", created_at: PUBLISHED },
        { id: "p2", created_at: PUBLISHED },
      ],
      [
        { post_id: "p1", sent_at: at(1) },
        { post_id: "p1", sent_at: at(2) },
      ],
    );
    expect(m.postsCreated).toBe(2);
    expect(m.postsWithAnyQuote).toBe(1);
    expect(m.postsWithTwoQuotesIn24h).toBe(1);
  });

  it("reports zeros — not NaN — when nothing has been quoted", () => {
    const m = summariseQuoteLatency([{ id: "p", created_at: PUBLISHED }], []);
    expect(m).toEqual({
      postsCreated: 1,
      postsWithAnyQuote: 0,
      postsWithTwoQuotesIn24h: 0,
      medianHoursToFirstQuote: null,
    });
  });

  it("medians the time to FIRST quote across requests", () => {
    const m = summariseQuoteLatency(
      [
        { id: "a", created_at: PUBLISHED },
        { id: "b", created_at: PUBLISHED },
        { id: "c", created_at: PUBLISHED },
      ],
      [
        { post_id: "a", sent_at: at(1) },
        { post_id: "b", sent_at: at(4) },
        { post_id: "b", sent_at: at(2) }, // out of order — min must win
        { post_id: "c", sent_at: at(9) },
      ],
    );
    expect(m.medianHoursToFirstQuote).toBe(2);
  });
});

describe("median", () => {
  it("averages the middle pair for an even count", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("is null for an empty set", () => {
    expect(median([])).toBeNull();
  });
});
