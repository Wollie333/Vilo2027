import "server-only";

import { SITE_URL as CANONICAL_SITE_URL } from "@/lib/contact";
import { sendTransactionalEmail } from "@/lib/email/send";
import { postGuestSystemCard } from "@/lib/messaging/system-card";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import { buildReviewPath, buildReviewUrl } from "@/lib/review-token";
import { createAdminClient } from "@/lib/supabase/admin";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || CANONICAL_SITE_URL;

// The stay happened (completed) AND money was collected at some point. A refund
// issued after a real stay still counts — the guest is entitled to review.
const PAID_STATUSES = new Set(["completed", "partially_refunded", "refunded"]);

export type SendReviewRequestResult =
  | { ok: true; skipped?: "exists" | "ineligible" | "no_guest" }
  | { ok: false; error: string };

/**
 * Single source of truth for "ask this guest to review their stay". Validates
 * eligibility (completed + paid + no existing review), then fires the request:
 *   - Account guest → email + in-app (push if a token) via dispatchEvent, plus a
 *     system card in their thread with the tokenised link.
 *   - Account-less (manual) guest → a direct transactional email to the
 *     booking's guest_email with the same tokenised link. No account needed.
 *
 * Idempotent: re-running for a booking that already has a review is a no-op,
 * and dispatchEvent dedupes the notification per booking. Called by the
 * review-request worker (5 min after checkout) and the daily backstop cron.
 */
export async function sendReviewRequest(
  bookingId: string,
): Promise<SendReviewRequestResult> {
  const admin = createAdminClient();

  const { data: booking } = await admin
    .from("bookings")
    .select(
      `id, status, payment_status, guest_id, guest_name, guest_email,
       host_id, property_id, quote_id, reference, deleted_at,
       listing:properties ( name ),
       host:hosts ( display_name )`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  // Missing/soft-deleted → terminal (the worker marks the queue row done so it
  // never retries forever).
  if (!booking || booking.deleted_at)
    return { ok: true, skipped: "ineligible" };
  if (
    booking.status !== "completed" ||
    !PAID_STATUSES.has(booking.payment_status ?? "")
  ) {
    return { ok: true, skipped: "ineligible" };
  }

  const { data: existing } = await admin
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (existing) return { ok: true, skipped: "exists" };

  const listing = Array.isArray(booking.listing)
    ? booking.listing[0]
    : booking.listing;
  const host = Array.isArray(booking.host) ? booking.host[0] : booking.host;
  const listingName = listing?.name ?? "your stay";
  const hostFirstName = (host?.display_name ?? "").split(" ")[0] || undefined;

  // ─── Account-less (manual) guest: direct email with the link, if we have one.
  if (!booking.guest_id) {
    if (!booking.guest_email) return { ok: true, skipped: "no_guest" };
    const reviewUrl = buildReviewUrl(SITE_URL, bookingId);
    const first = (booking.guest_name ?? "there").split(" ")[0] || "there";
    const res = await sendTransactionalEmail({
      to: booking.guest_email,
      subject: `How was your stay at ${listingName}?`,
      html:
        `<p>Hi ${first},</p>` +
        `<p>Hope you enjoyed your stay at <strong>${listingName}</strong>. ` +
        `Would you mind leaving a quick review? It takes about 30 seconds and you can add photos.</p>` +
        `<p><a href="${reviewUrl}">Leave a review</a></p>` +
        `<p>Your review goes live straight away${hostFirstName ? `, and ${hostFirstName} can reply to it publicly` : ""}.</p>`,
    });
    return res.ok
      ? { ok: true }
      : { ok: false, error: res.error ?? "Couldn't send the email." };
  }

  // ─── Account guest: email + in-app (push if a token). The email resolver
  // hydrates from booking_id and signs the link token; the in-app link uses
  // the tokenised path passed here.
  await dispatchEvent({
    kind: "review_request_guest",
    recipientUserId: booking.guest_id,
    guestId: booking.guest_id,
    refs: {
      booking_id: bookingId,
      listing_name: listingName,
      host_first_name: hostFirstName,
      review_path: buildReviewPath(bookingId),
    },
  });

  // Drop a clickable card into the guest's thread (unread for the guest as a
  // gentle nudge; the host doesn't need to action it).
  await postGuestSystemCard(admin, booking, {
    systemEvent: "review_request",
    body: `⭐ How was your stay at ${listingName}? Leave a quick review — it takes about 30 seconds and you can add photos: ${buildReviewUrl(SITE_URL, bookingId)}`,
    readByHost: true,
    readByGuest: false,
  });

  return { ok: true };
}
