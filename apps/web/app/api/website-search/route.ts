import { NextResponse } from "next/server";

import { searchWebsiteRooms } from "@/lib/website/bookingFunnel";

// Public funnel endpoint — ROOM-based availability + a SERVER-RECALCULATED price
// for the search-results page. A Route Handler (not a Server Action) so it owns
// its JSON response; mirrors app/api/website-quote. Never throws — every failure
// returns 200 with { ok: false, error }. Prices are always recomputed server-side
// and every requested room is validated against the site's visible listings;
// nothing the client sends is trusted.
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
    const result = await searchWebsiteRooms(body);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { ok: false, error: `Couldn't run the search — ${message}` },
      { status: 200 },
    );
  }
}
