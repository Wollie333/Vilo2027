import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cookieless website-analytics beacon (Phase 0A). The public micro-site fires a
// `navigator.sendBeacon` here on each pageview (and on booking-click). We derive
// device / country / a daily-rotating session hash server-side and append one row
// to `website_analytics_events` via the service role. No cookies, no PII stored —
// the session hash rotates every UTC day and is never returned to the client.

const EVENTS = new Set(["pageview", "booking_click", "outbound"]);

type Body = {
  websiteId?: unknown;
  event?: unknown;
  path?: unknown;
  referrer?: unknown;
};

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

function deviceFromUa(ua: string): "desktop" | "mobile" {
  return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua)
    ? "mobile"
    : "desktop";
}

/** Host only (never the full URL), lowercased; null for same-site / empty. */
function referrerHost(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Path only, capped — strip query/hash so the table never holds PII. */
function cleanPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "/";
  const p = raw.split(/[?#]/)[0] || "/";
  return ("/" + p.replace(/^\/+/, "")).slice(0, 512);
}

export async function POST(req: Request) {
  // Honour Do Not Track — silently accept but record nothing.
  if (req.headers.get("dnt") === "1") {
    return new NextResponse(null, { status: 204 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  const event = typeof body.event === "string" ? body.event : "pageview";
  if (!websiteId || !EVENTS.has(event)) {
    return new NextResponse(null, { status: 204 });
  }

  const ua = req.headers.get("user-agent") ?? "";
  // Daily-rotating, cookieless session id: a hash of ip+ua+website+UTC-day.
  // Never stored client-side, never reversible to the visitor.
  const day = new Date().toISOString().slice(0, 10);
  const sessionId = createHash("sha256")
    .update(`${clientIp(req)}|${ua}|${websiteId}|${day}`)
    .digest("hex")
    .slice(0, 32);

  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;

  try {
    const admin = createAdminClient();
    await admin.from("website_analytics_events").insert({
      website_id: websiteId,
      event,
      path: cleanPath(body.path),
      session_id: sessionId,
      referrer_host: referrerHost(body.referrer),
      device: deviceFromUa(ua),
      country: country ? country.slice(0, 2).toUpperCase() : null,
    });
  } catch {
    // Analytics must never break a page load — swallow and 204.
  }

  return new NextResponse(null, { status: 204 });
}
