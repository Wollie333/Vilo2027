import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { clientIpFromHeaders, verifyTurnstile } from "@/lib/security/turnstile";
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

  // Bot-hardening — verify the Cloudflare Turnstile token (inert until the
  // TURNSTILE_* keys are configured). The honeypot check still runs inside
  // submitWebsiteForm; this is the second, stronger gate.
  const ts =
    body && typeof body === "object" && "ts" in body
      ? (body as { ts?: unknown }).ts
      : undefined;
  const human = await verifyTurnstile(
    typeof ts === "string" ? ts : undefined,
    clientIpFromHeaders(req.headers),
  );
  if (!human.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Couldn't verify you're human. Please try again.",
      },
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
