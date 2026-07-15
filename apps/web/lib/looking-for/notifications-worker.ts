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

  // ---- 2. Region digest → hosts operating there --------------------------
  const { data: digestRows } = await admin
    .from("looking_for_region_digest_queue")
    .select("id, region, post_count, sample_post_ids")
    .is("processed_at", null)
    .limit(100);

  for (const row of digestRows ?? []) {
    const region = row.region as string;
    const samplePostId = ((row.sample_post_ids as string[] | null) ?? [])[0];

    if (region && samplePostId) {
      // Sample post details to enrich the host email/notification.
      const { data: sample } = await admin
        .from("looking_for_posts")
        .select(
          "title, location_text, adults, children, infants, budget_min, budget_max, check_in_date",
        )
        .eq("id", samplePostId)
        .maybeSingle();
      const sGuests =
        (sample?.adults ?? 0) +
        (sample?.children ?? 0) +
        (sample?.infants ?? 0);
      const sBudget =
        sample?.budget_min && sample?.budget_max
          ? `R ${sample.budget_min.toLocaleString("en-ZA").replace(/,/g, " ")} – R ${sample.budget_max.toLocaleString("en-ZA").replace(/,/g, " ")}`
          : sample?.budget_max
            ? `Up to R ${sample.budget_max.toLocaleString("en-ZA").replace(/,/g, " ")}`
            : sample?.budget_min
              ? `From R ${sample.budget_min.toLocaleString("en-ZA").replace(/,/g, " ")}`
              : undefined;
      const sCheckIn = sample?.check_in_date
        ? new Date(`${sample.check_in_date}T00:00:00`).toLocaleDateString(
            "en-ZA",
            { day: "numeric", month: "short", year: "numeric" },
          )
        : undefined;

      // Hosts with a published listing in this province.
      const { data: props } = await admin
        .from("properties")
        .select("host_id")
        .ilike("province", region)
        .eq("is_published", true)
        .is("deleted_at", null);
      const hostIds = Array.from(
        new Set((props ?? []).map((p) => p.host_id as string)),
      );

      if (hostIds.length) {
        // Skip hosts who already get precise real-time alerts for this region —
        // they were notified per-post at creation time (matchAlerts).
        const { data: alertHosts } = await admin
          .from("looking_for_alerts")
          .select("host_id")
          .eq("is_active", true)
          .ilike("location_region", region)
          .in("host_id", hostIds);
        const excluded = new Set(
          (alertHosts ?? []).map((a) => a.host_id as string),
        );
        const targets = hostIds.filter((h) => !excluded.has(h));

        if (targets.length) {
          const { data: hostRows } = await admin
            .from("hosts")
            .select("id, user_id, display_name")
            .in("id", targets)
            .is("deleted_at", null);
          for (const h of hostRows ?? []) {
            if (!h.user_id) continue;
            await dispatchEvent({
              kind: "looking_for_new_post_region",
              recipientUserId: h.user_id as string,
              hostId: h.id as string,
              refs: {
                post_id: samplePostId,
                location_text: sample?.location_text ?? region,
                // Email props (LookingForNewRequestHost):
                hostFirstName:
                  ((h.display_name as string | null) ?? "").split(" ")[0] ||
                  undefined,
                postTitle: sample?.title ?? undefined,
                locationText: sample?.location_text ?? region,
                postId: samplePostId,
                checkIn: sCheckIn,
                guests:
                  sGuests > 0
                    ? `${sGuests} guest${sGuests === 1 ? "" : "s"}`
                    : undefined,
                budget: sBudget,
              },
            });
            result.regionNotified += 1;
          }
        }
      }
    }

    await admin
      .from("looking_for_region_digest_queue")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", row.id);
    result.regionRowsProcessed += 1;
  }

  return result;
}
