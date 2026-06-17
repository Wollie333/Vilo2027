"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import { MAX_REVIEW_PHOTOS } from "@/lib/reviews/photos";
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
  trip_type: z
    .enum(["couples", "family", "solo", "friends", "business", "other"])
    .nullable()
    .optional(),
  // Storage paths of photos the browser already uploaded via a signed URL.
  photo_paths: z.array(z.string()).max(MAX_REVIEW_PHOTOS).optional(),
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
 *
 * Reviews publish immediately (is_published = true); the host is notified at
 * once and an admin can still hide a review via moderation. The on_review_published
 * trigger recalculates listing/host aggregates on insert.
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
    trip_type?:
      | "couples"
      | "family"
      | "solo"
      | "friends"
      | "business"
      | "other"
      | null;
    photo_paths?: string[];
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
      "id, status, checked_out_at, guest_id, host_id, property_id, deleted_at",
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

  const { data: existing } = await admin
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "A review has already been submitted." };
  }

  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertError } = await admin
    .from("reviews")
    .insert({
      booking_id: bookingId,
      property_id: booking.property_id,
      host_id: booking.host_id,
      // Null for an account-less (manual-booking) guest — the review still maps
      // to this real booking; the display name comes from bookings.guest_name.
      guest_id: booking.guest_id ?? null,
      rating: parsed.data.rating,
      body: parsed.data.body?.trim() || null,
      rating_cleanliness: parsed.data.rating_cleanliness ?? null,
      rating_communication: parsed.data.rating_communication ?? null,
      rating_checkin: parsed.data.rating_checkin ?? null,
      rating_accuracy: parsed.data.rating_accuracy ?? null,
      rating_location: parsed.data.rating_location ?? null,
      rating_value: parsed.data.rating_value ?? null,
      trip_type: parsed.data.trip_type ?? null,
      // Publish immediately; admins can still hide via moderation.
      is_published: true,
      publish_at: nowIso,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Couldn't save the review.",
    };
  }

  // Attach uploaded photos. Each path must live under this booking's folder
  // (the signed-upload action mints exactly those). Best-effort: a photo
  // insert failure must not lose the review itself.
  const photoPaths = (parsed.data.photo_paths ?? [])
    .filter((p) => p.startsWith(`${bookingId}/`))
    .slice(0, 6);
  if (photoPaths.length > 0) {
    await admin.from("review_photos").insert(
      photoPaths.map((path, i) => ({
        review_id: inserted.id,
        storage_path: path,
        sort_order: i,
      })),
    );
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

/**
 * Issue a one-time signed upload URL so the (account-less) guest's browser can
 * upload a review photo straight to the public review-photos bucket — no file
 * through the action (Vercel body cap) and no session needed (the signed token
 * authorises the write). Token-gated and scoped to the booking's folder; the
 * booking must still be a completed stay with no review yet.
 */
export async function createReviewPhotoUploadUrl(
  bookingId: string,
  token: string,
  ext: string,
): Promise<
  { ok: true; path: string; token: string } | { ok: false; error: string }
> {
  if (!verifyReviewToken(bookingId, token)) {
    return { ok: false, error: "This review link is invalid or has expired." };
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, checked_out_at, deleted_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.deleted_at) {
    return { ok: false, error: "Booking not found." };
  }
  if (booking.status !== "completed" || !booking.checked_out_at) {
    return { ok: false, error: "Photos can only be added after checkout." };
  }

  const { data: existing } = await admin
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "A review has already been submitted." };
  }

  const safeExt =
    (ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${bookingId}/${crypto.randomUUID()}.${safeExt}`;

  const { data, error } = await admin.storage
    .from("review-photos")
    .createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, error: "Could not start the upload. Try again." };
  }
  return { ok: true, path, token: data.token };
}
