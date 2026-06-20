import { NextResponse } from "next/server";

import { websiteAvailability } from "@/lib/website/bookingFunnel";

// Public funnel endpoint (Phase 6B) — the blocked dates for one of a site's
// properties over a window, for the availability-calendar widget. Route Handler
// (mirrors website-quote); membership-gated server-side; never throws.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 200 },
    );
  }

  try {
    const result = await websiteAvailability(body);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { ok: false, error: `Couldn't load availability — ${message}` },
      { status: 200 },
    );
  }
}
