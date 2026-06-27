import { NextResponse } from "next/server";

// External reviews sync worker
// Called by the daily pg_cron job to sync all active external review sources.
// Also callable manually for testing.
//
// Authorization: Bearer token via EXTERNAL_REVIEWS_WORKER_SECRET

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Constant-time compare to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.EXTERNAL_REVIEWS_WORKER_SECRET;
  if (!expected) {
    console.warn(
      "external-reviews-worker: EXTERNAL_REVIEWS_WORKER_SECRET not set",
    );
    return false;
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const providedToken = authHeader.replace(/^Bearer\s+/i, "");

  return timingSafeEqual(providedToken, expected);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    // Parse request body
    let body: { sync_type?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is OK
    }

    const syncType = body.sync_type || "auto";

    // Call the external-reviews-sync Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const functionUrl = `${supabaseUrl}/functions/v1/external-reviews-sync`;

    console.log(`external-reviews-worker: Starting ${syncType} sync...`);

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sync_type: syncType }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("external-reviews-worker: Edge Function error:", result);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Edge Function failed",
        },
        { status: 500 },
      );
    }

    console.log(
      `external-reviews-worker: Sync completed. Success: ${result.successCount}, Failed: ${result.failedCount}`,
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("external-reviews-worker error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
