"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

const hideSchema = z.object({
  reviewId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const hideReviewAction = withAdminAudit<
  z.infer<typeof hideSchema>,
  { ok: true }
>(
  {
    permissionKey: "reviews.moderate",
    actionName: "review.uphold_flag",
    targetType: "review",
    getTargetId: (a) => a.reviewId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("reviews")
      .update({
        flagged: true,
        is_published: false,
        admin_decision: "upheld",
      })
      .eq("id", args.reviewId)
      .select("id, flagged, is_published, admin_decision")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/reviews");
    return { result: { ok: true }, after: data };
  },
);

export const restoreReviewAction = withAdminAudit<
  z.infer<typeof hideSchema>,
  { ok: true }
>(
  {
    permissionKey: "reviews.moderate",
    actionName: "review.reject_flag",
    targetType: "review",
    getTargetId: (a) => a.reviewId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("reviews")
      .update({
        flagged: false,
        is_published: true,
        admin_decision: "rejected",
      })
      .eq("id", args.reviewId)
      .select("id, flagged, is_published, admin_decision")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/reviews");
    return { result: { ok: true }, after: data };
  },
);

export async function hideReview(input: { reviewId: string; reason: string }) {
  const parsed = hideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await hideReviewAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function restoreReview(input: {
  reviewId: string;
  reason: string;
}) {
  const parsed = hideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await restoreReviewAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
