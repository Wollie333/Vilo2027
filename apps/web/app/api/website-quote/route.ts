import { NextResponse } from "next/server";

import { quoteWebsiteStay } from "@/lib/website/bookingFunnel";

// Public funnel endpoint (Phase 6B) — availability + a SERVER-RECALCULATED price
// for one of a site's properties. A Route Handler (not a Server Action) so it
// owns its JSON response; mirrors app/api/website-form-submit. Never throws —
// every failure returns 200 with { ok: false, error }. The price is always
// recomputed server-side; nothing the client sends is trusted.
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
    const result = await quoteWebsiteStay(body);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { ok: false, error: `Couldn't get a quote — ${message}` },
      { status: 200 },
    );
  }
}
