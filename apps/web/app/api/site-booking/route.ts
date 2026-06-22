import { NextResponse } from "next/server";

import { clientIpFromHeaders, verifyTurnstile } from "@/lib/security/turnstile";
import { createSiteBooking } from "@/lib/website/siteCheckout";

// Public on-site checkout endpoint (Phase 6B/c) — creates the booking
// session-lessly and starts payment, returning the redirect target (Paystack
// authorization URL, or the thank-you path for EFT). The price is ALWAYS
// recomputed server-side via the shared booking core; nothing the client sends
// about money is trusted. Route handler (no session on tenant hosts); never
// throws — every failure returns 200 with { ok: false, error }.
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

  // Bot-hardening — verify the Cloudflare Turnstile token before creating a
  // booking + starting payment (inert until the TURNSTILE_* keys are set).
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

  // The payment callback is built from this origin — read it from the request so
  // it returns to the host's own (tenant) domain.
  const origin = req.headers.get("origin") || new URL(req.url).origin || "";

  try {
    const result = await createSiteBooking(body, { origin });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { ok: false, error: `Couldn't complete your booking — ${message}` },
      { status: 200 },
    );
  }
}
