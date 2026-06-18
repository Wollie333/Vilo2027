import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { pollWebsiteDomain } from "@/lib/website/domain-poll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 50;

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
 * Polls custom domains awaiting verification/SSL against Vercel and persists the
 * latest status (the shared `pollWebsiteDomain` SSOT). Pinged by the
 * poll-website-domains pg_cron; a fast no-op when nothing is pending. Inert
 * until the Vercel secrets are set (poll returns notConfigured).
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
    const { data: sites, error } = await admin
      .from("host_websites")
      .select("id, custom_domain, domain_status, ssl_status, settings")
      .not("custom_domain", "is", null)
      .in("domain_status", ["pending", "verifying"])
      .is("deleted_at", null)
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    let processed = 0;
    let active = 0;
    for (const site of sites ?? []) {
      const res = await pollWebsiteDomain(admin, site);
      processed += 1;
      if (res.domainStatus === "active") active += 1;
    }

    return NextResponse.json({
      success: true,
      data: { processed, active },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "WEBSITE_DOMAIN_POLL_FAILED", message },
      },
      { status: 500 },
    );
  }
}
