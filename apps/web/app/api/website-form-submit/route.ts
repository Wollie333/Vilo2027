import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { submitWebsiteForm } from "@/lib/website/submitWebsiteForm";

// Public host-built-form endpoint (Phase 4 — slice 2). A Route Handler (not a
// Server Action) so it controls its own JSON response and any server-side error
// reaches the client verbatim instead of an opaque 500 — mirrors
// app/api/website-enquiry/route.ts. The handler never throws; every failure
// returns 200 with { ok: false, error }.

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
    const result = await submitWebsiteForm(body);
    if (result.ok) revalidatePath("/dashboard/inbox");
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { ok: false, error: `Couldn't submit the form — ${message}` },
      { status: 200 },
    );
  }
}
