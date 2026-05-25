import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type EnqueueArgs = {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * Server-only — inserts a row into `in_app_notifications`. Uses the admin
 * client (service role) because RLS denies INSERT to authenticated users
 * (you should not be able to write into another user's notification feed
 * from the client even by accident).
 *
 * Realtime delivers the new row to the recipient's open dashboard bell
 * within ~1s. Failures are logged but not thrown — never let a missed
 * notification roll back the action that triggered it.
 */
export async function enqueueInAppNotification(
  args: EnqueueArgs,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("in_app_notifications").insert({
      user_id: args.userId,
      kind: args.kind,
      title: args.title,
      body: args.body ?? null,
      link: args.link ?? null,
      payload: args.payload ?? {},
    });
    if (error) {
      console.error("enqueueInAppNotification failed", {
        kind: args.kind,
        error: error.message,
      });
    }
  } catch (err) {
    console.error("enqueueInAppNotification threw", err);
  }
}
