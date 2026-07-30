import { NextResponse } from "next/server";

import { runCampaignCommsSweep } from "@/lib/affiliate/campaignComms";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Shares EMAIL_WORKER_SECRET with the other queue workers (one bearer, several
// workers — see notification_system_cron migration).
function authorised(req: Request): boolean {
  const expected = process.env.EMAIL_WORKER_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqual(header.slice(prefix.length), expected);
}

/**
 * The P2b campaign-comms sweep (SoT §10.7). For every ACTIVE competition, fires
 * the three clock-/state-driven sequence emails — milestone_hit, standings
 * digest, ending-soon — each gated by the Communications override layer + the
 * recipient's prefs (via dispatchEvent) and de-duped through
 * notification_delivery_log. Pinged daily by the drain-campaign-comms pg_cron.
 */
export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "" } },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();
    const data = await runCampaignCommsSweep(admin);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "CAMPAIGN_COMMS_WORKER_FAILED", message },
      },
      { status: 500 },
    );
  }
}
