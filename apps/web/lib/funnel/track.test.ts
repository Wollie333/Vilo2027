import { describe, expect, it } from "vitest";

import {
  countryFromHeaders,
  deviceFromUa,
  funnelSessionId,
  referrerHost,
} from "./track";

// WS-7 — the funnel session hash is what joins a browser-reported step to a
// server-recorded publish. If the two ever compute it differently the whole
// conversion read-out silently reads zero, so pin the behaviour.

function h(init: Record<string, string>): Headers {
  return new Headers(init);
}

const UA = "Mozilla/5.0 (Macintosh) Safari/605";

describe("funnelSessionId", () => {
  it("is stable for the same visitor, funnel and day", () => {
    const headers = h({ "x-forwarded-for": "41.13.7.22", "user-agent": UA });
    expect(funnelSessionId(headers, "looking_for", "2026-07-21")).toBe(
      funnelSessionId(
        h({ "x-forwarded-for": "41.13.7.22", "user-agent": UA }),
        "looking_for",
        "2026-07-21",
      ),
    );
  });

  it("rotates daily, so it can never track a visitor across days", () => {
    const headers = h({ "x-forwarded-for": "41.13.7.22", "user-agent": UA });
    expect(funnelSessionId(headers, "looking_for", "2026-07-21")).not.toBe(
      funnelSessionId(headers, "looking_for", "2026-07-22"),
    );
  });

  it("differs per visitor and per funnel", () => {
    const a = h({ "x-forwarded-for": "41.13.7.22", "user-agent": UA });
    const b = h({ "x-forwarded-for": "41.13.7.23", "user-agent": UA });
    expect(funnelSessionId(a, "looking_for", "2026-07-21")).not.toBe(
      funnelSessionId(b, "looking_for", "2026-07-21"),
    );
    expect(funnelSessionId(a, "looking_for", "2026-07-21")).not.toBe(
      funnelSessionId(a, "host_signup", "2026-07-21"),
    );
  });

  it("takes the FIRST hop of x-forwarded-for and falls back to x-real-ip", () => {
    const proxied = h({
      "x-forwarded-for": "41.13.7.22, 10.0.0.1, 10.0.0.2",
      "user-agent": UA,
    });
    const direct = h({ "x-forwarded-for": "41.13.7.22", "user-agent": UA });
    expect(funnelSessionId(proxied, "looking_for", "2026-07-21")).toBe(
      funnelSessionId(direct, "looking_for", "2026-07-21"),
    );
    expect(
      funnelSessionId(
        h({ "x-real-ip": "41.13.7.22", "user-agent": UA }),
        "looking_for",
        "2026-07-21",
      ),
    ).toBe(funnelSessionId(direct, "looking_for", "2026-07-21"));
  });

  it("is a 32-char hash, never the raw IP", () => {
    const id = funnelSessionId(
      h({ "x-forwarded-for": "41.13.7.22", "user-agent": UA }),
      "looking_for",
      "2026-07-21",
    );
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain("41.13");
  });
});

describe("deviceFromUa", () => {
  it("classifies mobile and desktop", () => {
    expect(deviceFromUa("iPhone; CPU iPhone OS 17_0")).toBe("mobile");
    expect(deviceFromUa("Android 14; Pixel 8")).toBe("mobile");
    expect(deviceFromUa(UA)).toBe("desktop");
    expect(deviceFromUa("")).toBe("desktop");
  });
});

describe("referrerHost", () => {
  it("keeps the host only, without www, and never the path or query", () => {
    expect(referrerHost("https://www.Google.com/search?q=secret")).toBe(
      "google.com",
    );
    expect(referrerHost("https://facebook.com/ads/x")).toBe("facebook.com");
  });

  it("returns null for junk or empty referrers", () => {
    expect(referrerHost("not a url")).toBeNull();
    expect(referrerHost("")).toBeNull();
    expect(referrerHost(null)).toBeNull();
  });
});

describe("countryFromHeaders", () => {
  it("reads the edge header and normalises to 2 upper-case letters", () => {
    expect(countryFromHeaders(h({ "x-vercel-ip-country": "za" }))).toBe("ZA");
    expect(countryFromHeaders(h({ "cf-ipcountry": "GB" }))).toBe("GB");
    expect(countryFromHeaders(h({}))).toBeNull();
  });
});
