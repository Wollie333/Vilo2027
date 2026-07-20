import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createRequestPublic } from "@/lib/looking-for/createRequestPublic";

// Public "post a request" endpoint for the post-first Looking-For funnel (WS-2b).
// A Route Handler (not a Server Action) so it owns its JSON response and the real
// error reaches the client verbatim instead of an opaque 500. The handler never
// throws — every failure returns a 200 with `{ ok: false, error }` so the browser
// always receives a parseable body (mirrors app/api/enquiry/route.ts).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request — could not read the form data." },
      { status: 200 },
    );
  }

  try {
    const result = await createRequestPublic(body);
    if (result.ok) {
      revalidatePath("/looking-for");
    }
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      {
        ok: false,
        error: `Couldn't post your request — ${message}`,
        ...(process.env.NODE_ENV !== "production"
          ? { detail: e instanceof Error ? (e.stack ?? e.message) : String(e) }
          : {}),
      },
      { status: 200 },
    );
  }
}
