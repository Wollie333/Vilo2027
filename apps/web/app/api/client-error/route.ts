import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/auth/rateLimit";
import { reportError } from "@/lib/observability/reportError";
import { clientIpFromHeaders } from "@/lib/security/turnstile";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Ingest for browser-side crashes caught by the global error boundary.
 *
 * Public by necessity — a crash can happen to a signed-out visitor, and that is
 * exactly the failure worth hearing about. So it is rate limited per IP, and the
 * payload is treated as untrusted: only the fields we expect, truncated, with
 * the signed-in user resolved SERVER-side rather than taken from the body.
 *
 * Always answers 204. A reporting endpoint that returns errors gives an attacker
 * a probe and gives a broken page a second thing to break on.
 */
export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(
      clientIpFromHeaders(request.headers),
      "client-error",
      30,
      60,
    );
    if (!rate.ok) return new NextResponse(null, { status: 204 });

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new NextResponse(null, { status: 204 });
    }
    const b = body as Record<string, unknown>;
    const message =
      typeof b.message === "string" ? b.message.slice(0, 2000) : null;
    if (!message) return new NextResponse(null, { status: 204 });

    // Never trust a client-supplied identity.
    let userId: string | null = null;
    try {
      const supabase = createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }

    await reportError({
      error: Object.assign(new Error(message), {
        stack: typeof b.stack === "string" ? b.stack.slice(0, 8000) : undefined,
      }),
      source: "client",
      route: typeof b.url === "string" ? b.url.slice(0, 500) : null,
      userId,
      context: {
        digest: typeof b.digest === "string" ? b.digest.slice(0, 100) : null,
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch {
    // Swallow — see route doc.
  }
  return new NextResponse(null, { status: 204 });
}
