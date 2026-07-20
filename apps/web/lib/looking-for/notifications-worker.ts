import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEvent } from "@/lib/notifications/dispatch";

// Drains the two Looking-For notification queues that the pg_cron jobs fill but
// nothing ever dispatched:
//   • looking_for_expiry_notifications  → "request expiring soon" to the GUEST
//   • looking_for_region_digest_queue   → "new request in your area" to HOSTS
// Idempotent via the dispatched_at / processed_at gates. Called by the bearer-
// gated /api/looking-for-worker route (scheduled hourly, 20260714130000).

export type LookingForDrainResult = {
  expiryDispatched: number;
  expiryProcessed: number;
  regionRowsProcessed: number;
  regionNotified: number;
};

type ExpiryPost = {
  id: string;
  title: string | null;
  guest_id: string | null;
  status: string;
  quote_count: number | null;
};

type ExpiryRow = {
  id: string;
  days_before: number;
  post: ExpiryPost | ExpiryPost[] | null;
};

export async function drainLookingForNotifications(): Promise<LookingForDrainResult> {
  const admin = createAdminClient();
  const result: LookingForDrainResult = {
    expiryDispatched: 0,
    expiryProcessed: 0,
    regionRowsProcessed: 0,
    regionNotified: 0,
  };

  // ---- 1. Expiring-soon → guest ------------------------------------------
  const { data: expiryRows } = await admin
    .from("looking_for_expiry_notifications")
    .select(
      "id, days_before, post:looking_for_posts(id, title, guest_id, status, quote_count)",
    )
    .is("dispatched_at", null)
    .limit(500);

  for (const raw of (expiryRows ?? []) as unknown as ExpiryRow[]) {
    const post = Array.isArray(raw.post) ? raw.post[0] : raw.post;
    // Only warn about a post that's still live; either way mark the row so a
    // stale warning never retries forever.
    if (post && post.status === "active" && post.guest_id) {
      await dispatchEvent({
        kind: "looking_for_post_expiring",
        recipientUserId: post.guest_id,
        guestId: post.guest_id,
        refs: {
          post_id: post.id,
          post_title: post.title ?? undefined,
          expires_in_days: raw.days_before,
          // Email props (LookingForRequestExpiringGuest):
          postTitle: post.title ?? undefined,
          postId: post.id,
          expiresInDays: raw.days_before,
          quoteCount: post.quote_count ?? 0,
        },
      });
      result.expiryDispatched += 1;
    }
    await admin
      .from("looking_for_expiry_notifications")
      .update({ dispatched_at: new Date().toISOString() })
      .eq("id", raw.id);
    result.expiryProcessed += 1;
  }

  // ---- 2. Region digest → DRAIN ONLY (superseded by WS-2c) ----------------
  // Default regional alerting is now real-time: on publish, notifyMatchingAlerts
  // (matchAlerts.ts, pass 2) notifies EVERY host with a published property in
  // range — not just saved-search holders. The hourly province digest would
  // therefore double-send the same `looking_for_new_post_region` to those hosts,
  // later and coarser. So we no longer DISPATCH from the digest; we just drain
  // the queue (mark rows processed) so the pg_cron-filled queue never backs up.
  // The real-time path is the single source of the "new request in your area"
  // notification. (Keep this drain until the pg_cron that fills the queue is
  // retired in a later migration.)
  const { data: digestRows } = await admin
    .from("looking_for_region_digest_queue")
    .select("id")
    .is("processed_at", null)
    .limit(500);

  for (const row of digestRows ?? []) {
    await admin
      .from("looking_for_region_digest_queue")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", row.id);
    result.regionRowsProcessed += 1;
  }

  return result;
}
