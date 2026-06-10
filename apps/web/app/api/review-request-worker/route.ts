import { NextResponse } from "next/server";

import { sendReviewRequest } from "@/lib/reviews/request";
import { createAdminClient } from "@/lib/supabase/admin";

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
 * Drains review_request_queue: for every due, unsent row (send_at <= now)
 * fire sendReviewRequest and mark the row sent. Marking on every non-error
 * outcome (sent OR skipped: exists/ineligible/no_guest) stops the row being
 * retried forever. Pinged by the drain-review-requests pg_cron each minute.
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
    const nowIso = new Date().toISOString();

    const { data: rows, error } = await admin
      .from("review_request_queue")
      .select("id, booking_id")
      .is("sent_at", null)
      .lte("send_at", nowIso)
      .order("send_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    let sent = 0;
    let skipped = 0;
    for (const row of rows ?? []) {
      const result = await sendReviewRequest(row.booking_id);
      // A transient "Booking not found" leaves the row to retry; every other
      // outcome is terminal, so stamp sent_at.
      if (result.ok) {
        await admin
          .from("review_request_queue")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", row.id);
        if (result.skipped) skipped += 1;
        else sent += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: { processed: rows?.length ?? 0, sent, skipped },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "REVIEW_REQUEST_WORKER_FAILED", message },
      },
      { status: 500 },
    );
  }
}
