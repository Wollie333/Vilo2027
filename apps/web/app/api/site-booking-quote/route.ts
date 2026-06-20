import { NextResponse } from "next/server";

import { siteBookingQuote } from "@/lib/website/siteCheckout";

// Public on-site checkout endpoint (Phase 6B/c) — a live, server-recalculated
// price + availability for the running summary. Route handler (no session on
// tenant hosts); membership-gated server-side; never throws.
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
    const result = await siteBookingQuote(body);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { ok: false, error: `Couldn't price your stay — ${message}` },
      { status: 200 },
    );
  }
}
