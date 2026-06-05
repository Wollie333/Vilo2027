import { createAdminClient } from "@/lib/supabase/admin";

import { dispatchEvent } from "./dispatch";

// Drains review_request_queue: for each not-yet-sent row (queued ~24h after
// checkout by the queue-review-requests cron), dispatch the review_request_guest
// notification (email + push + in-app via the registry/resolvers) and stamp
// sent_at so it fires once. submitReviewAction also stamps sent_at, so a guest
// who already reviewed is never nudged.
export async function runReviewRequestDrain(): Promise<{
  processed: number;
  sent: number;
}> {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("review_request_queue")
    .select("id, booking_id, guest_id, booking:bookings ( host_id, status )")
    .is("sent_at", null)
    .limit(200);

  let sent = 0;
  for (const row of rows ?? []) {
    const booking = (
      Array.isArray(row.booking) ? row.booking[0] : row.booking
    ) as { host_id: string; status: string } | null;
    // Only nudge for stays that actually completed.
    if (!booking || booking.status !== "completed") {
      // Stamp so we don't re-check a stale/cancelled row every tick.
      await admin
        .from("review_request_queue")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }

    try {
      await dispatchEvent({
        kind: "review_request_guest",
        recipientUserId: row.guest_id,
        hostId: booking.host_id,
        refs: { booking_id: row.booking_id },
      });
    } catch {
      // Best-effort — leave sent_at null so the next tick retries.
      continue;
    }

    await admin
      .from("review_request_queue")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", row.id);
    sent += 1;
  }

  return { processed: rows?.length ?? 0, sent };
}
