import { createHash } from "node:crypto";

import type { createAdminClient } from "@/lib/supabase/admin";

import { FUNNEL_LOOKING_FOR, type FunnelEvent } from "./shared";

// WS-7 — server side of the funnel beacon. Kept free of `server-only` so the
// session-hash logic can be unit-tested; it is imported by the beacon route and
// by the publish path, never by a client component.

type Db = ReturnType<typeof createAdminClient>;

export function deviceFromUa(ua: string): "desktop" | "mobile" {
  return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua)
    ? "mobile"
    : "desktop";
}

export function clientIpFromRequestHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

/** Host only (never the full URL), lowercased; null for same-site / empty. */
export function referrerHost(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Cookieless, daily-rotating session id — the SAME formula everywhere, so the
 * server-recorded publish event lands on the session the browser reported its
 * steps under. Never sent to the client, never reversible to a visitor.
 */
export function funnelSessionId(
  h: Headers,
  funnel: string = FUNNEL_LOOKING_FOR,
  today: string = new Date().toISOString().slice(0, 10),
): string {
  return createHash("sha256")
    .update(
      `${clientIpFromRequestHeaders(h)}|${h.get("user-agent") ?? ""}|${funnel}|${today}`,
    )
    .digest("hex")
    .slice(0, 32);
}

export function countryFromHeaders(h: Headers): string | null {
  const c = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  return c ? c.slice(0, 2).toUpperCase() : null;
}

/**
 * Append one funnel event. Instrumentation must NEVER break the flow it
 * measures, so every failure is swallowed.
 */
export async function recordFunnelEvent(
  admin: Db,
  input: {
    event: FunnelEvent;
    funnel?: string;
    step?: string | null;
    sessionId?: string | null;
    postId?: string | null;
    isLead?: boolean | null;
    device?: string | null;
    country?: string | null;
    referrerHost?: string | null;
  },
): Promise<void> {
  try {
    await admin.from("funnel_events").insert({
      funnel: input.funnel ?? FUNNEL_LOOKING_FOR,
      event: input.event,
      step: input.step ?? null,
      session_id: input.sessionId ?? null,
      post_id: input.postId ?? null,
      is_lead: input.isLead ?? null,
      device: input.device ?? null,
      country: input.country ?? null,
      referrer_host: input.referrerHost ?? null,
    });
  } catch {
    // Telemetry is never worth a failed publish.
  }
}
