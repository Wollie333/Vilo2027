import { NextResponse } from "next/server";

import { submitFunnelLead } from "@/lib/funnels/submit";
import { clientIpFromHeaders } from "@/lib/security/turnstile";

// Public funnel lead-capture endpoint (/api/funnel-submit). A Route Handler (not
// a Server Action) so it owns its JSON response and never leaks an opaque 500 —
// mirrors app/api/website-form-submit/route.ts. Always returns HTTP 200 with
// { ok, error?, redirectTo? }; the honeypot + Turnstile checks run in the core.

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

  const ts =
    body && typeof body === "object" && "ts" in body
      ? (body as { ts?: unknown }).ts
      : undefined;

  try {
    const result = await submitFunnelLead(body, {
      turnstileToken: typeof ts === "string" ? ts : undefined,
      clientIp: clientIpFromHeaders(req.headers),
    });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { ok: false, error: `Couldn't submit the form — ${message}` },
      { status: 200 },
    );
  }
}
