"use server";

import { createServerClient } from "@/lib/supabase/server";

export type VoteResult =
  | { ok: true; voted: boolean }
  | { ok: false; error: string };

/**
 * Toggle the signed-in user's "helpful" vote on a review. The denormalised
 * reviews.helpful_count is kept in sync by a DB trigger. Idempotent per user
 * (RLS + composite PK guarantee one vote each).
 */
export async function voteReviewHelpfulAction(
  reviewId: string,
): Promise<VoteResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to mark reviews helpful." };
  }

  const { data: existing } = await supabase
    .from("review_helpful_votes")
    .select("review_id")
    .eq("review_id", reviewId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("review_helpful_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Could not update your vote." };
    return { ok: true, voted: false };
  }

  const { error } = await supabase
    .from("review_helpful_votes")
    .insert({ review_id: reviewId, user_id: user.id });
  if (error) return { ok: false, error: "Could not record your vote." };
  return { ok: true, voted: true };
}
