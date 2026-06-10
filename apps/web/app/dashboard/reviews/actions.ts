"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { sendReviewRequest } from "@/lib/reviews/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Host-initiated review request for one or more of their own COMPLETED + PAID
 * bookings that haven't been reviewed yet. Reuses the SSOT sendReviewRequest
 * (email + in-app + thread card) and stamps review_request_queue.sent_at so the
 * 5-minute auto-send can't double-fire and the "last requested" badge updates.
 * sendReviewRequest re-validates eligibility, so an already-reviewed booking is
 * silently skipped even if one slipped into the request.
 */
export async function requestReviewsAction(
  bookingIds: string[],
): Promise<
  { ok: true; sent: number; skipped: number } | { ok: false; error: string }
> {
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return { ok: false, error: "Pick at least one guest." };
  }
  if (bookingIds.length > 100) {
    return { ok: false, error: "Too many at once — select up to 100." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile." };

  // Only act on bookings this host owns (RLS-scoped read + explicit host_id).
  const { data: owned } = await supabase
    .from("bookings")
    .select("id, guest_id")
    .in("id", bookingIds)
    .eq("host_id", host.id);
  const ownedGuest = new Map(
    (owned ?? []).map((b) => [b.id, b.guest_id as string | null]),
  );

  const admin = createAdminClient();
  let sent = 0;
  let skipped = 0;
  for (const id of bookingIds) {
    if (!ownedGuest.has(id)) {
      skipped += 1;
      continue;
    }
    const result = await sendReviewRequest(id);
    if (result.ok && !result.skipped) {
      sent += 1;
      const guestId = ownedGuest.get(id);
      if (guestId) {
        const now = new Date().toISOString();
        await admin
          .from("review_request_queue")
          .upsert(
            { booking_id: id, guest_id: guestId, send_at: now, sent_at: now },
            { onConflict: "booking_id" },
          );
      }
    } else {
      skipped += 1;
    }
  }

  revalidatePath("/dashboard/reviews");
  return { ok: true, sent, skipped };
}

const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "Replies need at least two characters.")
    .max(1500, "Replies are capped at 1 500 characters."),
});

async function assertReviewOwnership(
  reviewId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  // RLS host_read_own_reviews filters non-owners — this returns null when
  // the caller isn't the review's host.
  const { data: review } = await supabase
    .from("reviews")
    .select("id")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) return { ok: false, error: "Review not found." };
  return { ok: true };
}

export async function replyToReviewAction(
  reviewId: string,
  input: { body: string },
): Promise<ActionResult> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Reply looks invalid.",
    };
  }

  const own = await assertReviewOwnership(reviewId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("reviews")
    .update({
      host_response: parsed.data.body,
      host_responded_at: new Date().toISOString(),
    })
    .eq("id", reviewId);
  if (error) {
    return { ok: false, error: "Couldn't post the reply. Try again." };
  }

  revalidatePath("/dashboard/reviews");
  return { ok: true };
}

export async function editReplyAction(
  reviewId: string,
  input: { body: string },
): Promise<ActionResult> {
  // Same shape as posting — RLS host_respond_reviews allows UPDATE either way.
  return replyToReviewAction(reviewId, input);
}

export async function clearReplyAction(
  reviewId: string,
): Promise<ActionResult> {
  const own = await assertReviewOwnership(reviewId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("reviews")
    .update({
      host_response: null,
      host_responded_at: null,
    })
    .eq("id", reviewId);
  if (error) {
    return { ok: false, error: "Couldn't clear the reply. Try again." };
  }

  revalidatePath("/dashboard/reviews");
  return { ok: true };
}

const flagSchema = z.object({
  reason: z.enum([
    "false_information",
    "personal_attack",
    "booking_never_occurred",
    "other",
  ]),
  details: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function flagReviewAction(
  reviewId: string,
  input: { reason: string; details?: string },
): Promise<ActionResult> {
  const parsed = flagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Pick a flag reason." };
  }

  const own = await assertReviewOwnership(reviewId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Two-step: insert the audit row + set the review's flagged flag for
  // admin attention. The unique check on (review_id, flagged_by) keeps
  // hosts from flag-spamming the same review.
  const { error: flagErr } = await supabase.from("review_flags").insert({
    review_id: reviewId,
    flagged_by: user!.id,
    reason: parsed.data.reason,
    details:
      parsed.data.details && parsed.data.details.length > 0
        ? parsed.data.details
        : null,
  });
  if (flagErr) {
    return { ok: false, error: "Couldn't flag the review. Try again." };
  }

  await supabase
    .from("reviews")
    .update({
      flagged: true,
      flagged_at: new Date().toISOString(),
      flagged_reason: parsed.data.reason,
    })
    .eq("id", reviewId);

  revalidatePath("/dashboard/reviews");
  return { ok: true };
}
