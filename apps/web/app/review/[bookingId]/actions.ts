"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReviewToken } from "@/lib/review-token";

const subRating = z.number().int().min(1).max(5).nullable().optional();

const submitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional().nullable(),
  // Optional per-category star ratings (1–5, or null/omitted if not given).
  rating_cleanliness: subRating,
  rating_communication: subRating,
  rating_checkin: subRating,
  rating_accuracy: subRating,
  rating_location: subRating,
  rating_value: subRating,
});

type ActionResult =
  | { ok: true; reviewId: string }
  | { ok: false; error: string };

/**
 * Guest-side review submission. Token-gated; uses the admin client because
 * guests don't have a `reviews FOR INSERT` RLS policy (this is intentional —
 * the only legitimate path for a guest to write a review is via the
 * post-checkout link). All gates run server-side:
 *   - token must verify against the bookingId
 *   - booking must exist, be 'completed', and have a checked_out_at
 *   - no existing review may already be linked to the booking
 *   - publish_at is set to now() + 48h so the moderation cron still applies
 */
export async function submitReviewAction(
  bookingId: string,
  token: string,
  input: {
    rating: number;
    body?: string | null;
    rating_cleanliness?: number | null;
    rating_communication?: number | null;
    rating_checkin?: number | null;
    rating_accuracy?: number | null;
    rating_location?: number | null;
    rating_value?: number | null;
  },
): Promise<ActionResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid review payload." };
  }

  if (!verifyReviewToken(bookingId, token)) {
    return { ok: false, error: "This review link is invalid or has expired." };
  }

  const admin = createAdminClient();

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, status, checked_out_at, guest_id, host_id, listing_id, deleted_at",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return { ok: false, error: "Couldn't load this booking." };
  }
  if (!booking || booking.deleted_at) {
    return { ok: false, error: "Booking not found." };
  }
  if (booking.status !== "completed" || !booking.checked_out_at) {
    return {
      ok: false,
      error: "You can only review a booking after the stay is complete.",
    };
  }
  if (!booking.guest_id) {
    return {
      ok: false,
      error: "This booking has no registered guest — reviews aren't supported.",
    };
  }

  const { data: existing } = await admin
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "A review has already been submitted." };
  }

  const publishAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data: inserted, error: insertError } = await admin
    .from("reviews")
    .insert({
      booking_id: bookingId,
      listing_id: booking.listing_id,
      host_id: booking.host_id,
      guest_id: booking.guest_id,
      rating: parsed.data.rating,
      body: parsed.data.body?.trim() || null,
      rating_cleanliness: parsed.data.rating_cleanliness ?? null,
      rating_communication: parsed.data.rating_communication ?? null,
      rating_checkin: parsed.data.rating_checkin ?? null,
      rating_accuracy: parsed.data.rating_accuracy ?? null,
      rating_location: parsed.data.rating_location ?? null,
      rating_value: parsed.data.rating_value ?? null,
      is_published: false,
      publish_at: publishAt,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Couldn't save the review.",
    };
  }

  // Mark the queue row as processed if one exists. No-op if not.
  await admin
    .from("review_request_queue")
    .update({ sent_at: new Date().toISOString() })
    .eq("booking_id", bookingId);

  // Notify the host across all enabled channels (email + in-app, push if
  // they have a token). Email payload is hydrated by newReviewHostResolver
  // from review_id.
  const { data: hostRow } = await admin
    .from("hosts")
    .select("user_id")
    .eq("id", booking.host_id)
    .maybeSingle();
  if (hostRow?.user_id) {
    await dispatchEvent({
      kind: "new_review_host",
      recipientUserId: hostRow.user_id,
      hostId: booking.host_id,
      refs: {
        review_id: inserted.id,
        booking_id: bookingId,
        rating: parsed.data.rating,
        excerpt: parsed.data.body ? parsed.data.body.slice(0, 120) : undefined,
      },
    });
  }

  revalidatePath(`/review/${bookingId}`);
  return { ok: true, reviewId: inserted.id };
}
