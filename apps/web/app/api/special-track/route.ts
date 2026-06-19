import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cookieless conversion beacon for the public platform special-detail page
// (S6b). `/special/[slug]` fires a `navigator.sendBeacon` here on view and on
// Book-CTA click. We derive device / country / a daily-rotating session hash
// server-side and append one row to `special_view_events` via the service role.
// No cookies, no PII stored — the session hash rotates every UTC day and is
// never returned to the client. Mirrors `/api/site-track`, but writes the
// platform-level specials table (specials aren't website-scoped).

const EVENTS = new Set(["special_view", "special_book_click"]);

type Body = {
  specialId?: unknown;
  event?: unknown;
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

  const specialId = typeof body.specialId === "string" ? body.specialId : "";
  const event = typeof body.event === "string" ? body.event : "special_view";
  if (!specialId || !EVENTS.has(event)) {
    return new NextResponse(null, { status: 204 });
  }

  const ua = req.headers.get("user-agent") ?? "";
  // Daily-rotating, cookieless session id: a hash of ip+ua+special+UTC-day.
  // Never stored client-side, never reversible to the visitor.
  const day = new Date().toISOString().slice(0, 10);
  const sessionId = createHash("sha256")
    .update(`${clientIp(req)}|${ua}|${specialId}|${day}`)
    .digest("hex")
    .slice(0, 32);

  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;

  try {
    const admin = createAdminClient();
    // Only record events for a real, live special — a missing/inactive id is
    // dropped (an FK insert would throw anyway, and this stops junk rows).
    const { data: special } = await admin
      .from("specials")
      .select("id")
      .eq("id", specialId)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (!special) return new NextResponse(null, { status: 204 });

    await admin.from("special_view_events").insert({
      special_id: specialId,
      event,
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
