import { NextResponse } from "next/server";

import {
  countryFromHeaders,
  deviceFromUa,
  funnelSessionId,
  recordFunnelEvent,
  referrerHost,
} from "@/lib/funnel/track";
import {
  CLIENT_EVENTS,
  FUNNEL_LOOKING_FOR,
  FUNNELS,
  LF_STEPS,
  type FunnelEvent,
} from "@/lib/funnel/shared";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// WS-7 — cookieless beacon for WIELO's own funnel (mirrors /api/site-track,
// which does the same job for host micro-sites). Always 204, never throws: a
// broken beacon must not break the page it measures.
//
// Only the browser-side events are accepted here. account_created / published
// are recorded server-side in the publish path, so a forged beacon cannot
// inflate the conversion numbers this funnel is judged on.

type Body = {
  event?: unknown;
  step?: unknown;
  referrer?: unknown;
  funnel?: unknown;
};

const ALLOWED = new Set<string>(CLIENT_EVENTS);
const STEPS = new Set<string>(LF_STEPS);
const KNOWN_FUNNELS = new Set<string>(FUNNELS);

export async function POST(req: Request) {
  // Honour Do Not Track — accept silently, record nothing.
  if (req.headers.get("dnt") === "1") {
    return new NextResponse(null, { status: 204 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!ALLOWED.has(event)) return new NextResponse(null, { status: 204 });

  const step =
    typeof body.step === "string" && STEPS.has(body.step) ? body.step : null;

  const funnel =
    typeof body.funnel === "string" && KNOWN_FUNNELS.has(body.funnel)
      ? body.funnel
      : FUNNEL_LOOKING_FOR;

  await recordFunnelEvent(createAdminClient(), {
    event: event as FunnelEvent,
    funnel,
    step,
    sessionId: funnelSessionId(req.headers, funnel),
    device: deviceFromUa(req.headers.get("user-agent") ?? ""),
    country: countryFromHeaders(req.headers),
    referrerHost: referrerHost(body.referrer),
  });

  return new NextResponse(null, { status: 204 });
}
