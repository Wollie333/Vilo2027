"use server";

import { revalidatePath } from "next/cache";

import { withAdminAudit } from "@/lib/admin";

type Result = { success: true } | { success: false; error: string };

type ModerationArgs = { postId: string; reason?: string };

const MODERATION_PERMISSION = "platform.features" as const;

/**
 * Moderating a Looking-For post takes a GUEST's content offline, so every one of
 * these actions is audited (RULES.md §5, AGENT_RULES.md §6.1). They previously
 * wrote no audit row at all — there was no record of who hid whose post.
 *
 * `expectedStatus` matters: the reversible pause/resume pair only applies to a
 * post in a specific state. A PostgREST update that matches ZERO rows is NOT an
 * error (RULES.md §8.1) — `suspend` and `resume` used to return `{success:true}`
 * after changing nothing, so an admin pausing an already-cancelled post saw a
 * success toast and no effect. Every update below uses RETURNING and treats an
 * empty result as a failure the admin can see.
 */
function moderatePost(config: {
  actionName: string;
  patch: () => Record<string, unknown>;
  /** Only apply when the post is currently in this status. */
  expectedStatus?: string;
  /** Shown when the update matched no row. */
  noMatchError: string;
}) {
  return withAdminAudit<ModerationArgs, Result>(
    {
      permissionKey: MODERATION_PERMISSION,
      actionName: config.actionName,
      targetType: "looking_for_post",
      getTargetId: (args) => args.postId,
      // Surface the action on the post OWNER's user-record History tab.
      getOwnerUserId: async (args, service) => {
        const { data } = await service
          .from("looking_for_posts")
          .select("guest_id")
          .eq("id", args.postId)
          .maybeSingle();
        return data?.guest_id ?? null;
      },
      captureBefore: async (service, args) => {
        const { data } = await service
          .from("looking_for_posts")
          .select("id, status, expires_at")
          .eq("id", args.postId)
          .maybeSingle();
        return data;
      },
    },
    async (args, service) => {
      let q = service
        .from("looking_for_posts")
        .update({ ...config.patch(), updated_at: new Date().toISOString() })
        .eq("id", args.postId);
      if (config.expectedStatus) q = q.eq("status", config.expectedStatus);

      const { data, error } = await q.select("id, status, expires_at");

      if (error) {
        return {
          result: { success: false, error: error.message },
          after: null,
        };
      }
      // Zero rows matched — the post is gone or not in the expected state.
      if (!data || data.length === 0) {
        return {
          result: { success: false, error: config.noMatchError },
          after: null,
        };
      }

      revalidatePath("/admin/looking-for/posts");
      return { result: { success: true }, after: data[0] };
    },
  );
}

const flagPost = moderatePost({
  actionName: "looking_for_post.flag",
  patch: () => ({ status: "flagged" }),
  noMatchError: "That post no longer exists.",
});

const unflagPost = moderatePost({
  actionName: "looking_for_post.unflag",
  patch: () => ({ status: "active" }),
  noMatchError: "That post no longer exists.",
});

const removePost = moderatePost({
  actionName: "looking_for_post.remove",
  patch: () => ({ status: "cancelled" }),
  noMatchError: "That post no longer exists.",
});

// Neutral "take offline for now" — distinct from moderation flagging. Hidden
// from public / host browse / respond (all gate on status = 'active'); the guest
// owner still sees their post badged "Paused". Reversible via resume.
const suspendPost = moderatePost({
  actionName: "looking_for_post.suspend",
  patch: () => ({ status: "suspended" }),
  expectedStatus: "active",
  noMatchError: "Only a live post can be paused.",
});

// Resume a paused post back to live. Keep the existing expiry — a pause is not a
// fresh post; if it already lapsed while paused the hourly cron expires it.
const resumePost = moderatePost({
  actionName: "looking_for_post.resume",
  patch: () => ({ status: "active" }),
  expectedStatus: "suspended",
  noMatchError: "Only a paused post can be resumed.",
});

// Set back to active and extend expiry by 7 days from now.
const reinstatePost = moderatePost({
  actionName: "looking_for_post.reinstate",
  patch: () => {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);
    return { status: "active", expires_at: newExpiry.toISOString() };
  },
  noMatchError: "That post no longer exists.",
});

export async function flagPostAction(postId: string): Promise<Result> {
  return flagPost({ postId });
}

export async function unflagPostAction(postId: string): Promise<Result> {
  return unflagPost({ postId });
}

export async function removePostAction(postId: string): Promise<Result> {
  return removePost({ postId });
}

export async function suspendPostAction(postId: string): Promise<Result> {
  return suspendPost({ postId });
}

export async function resumePostAction(postId: string): Promise<Result> {
  return resumePost({ postId });
}

export async function reinstatePostAction(postId: string): Promise<Result> {
  return reinstatePost({ postId });
}
