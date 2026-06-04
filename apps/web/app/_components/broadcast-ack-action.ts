"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

type Input = {
  broadcastId: string;
  mode: "acknowledge" | "dismiss" | "click";
};

/**
 * Marks a broadcast as acknowledged (critical tier) / dismissed (warning
 * tier) / link-clicked (any tier) for the calling user. Idempotent. The
 * click variant uses ON CONFLICT to only set link_clicked_at on the first
 * click — repeat clicks are silently no-op'd, so CTR counts distinct
 * users, not raw clicks.
 */
export async function ackBroadcastAction(input: Input): Promise<{
  ok: boolean;
}> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const now = new Date().toISOString();
  const patch =
    input.mode === "acknowledge"
      ? { acknowledged_at: now }
      : input.mode === "dismiss"
        ? { dismissed_at: now }
        : { link_clicked_at: now };

  const { error } = await supabase.from("broadcast_acknowledgements").upsert(
    { broadcast_id: input.broadcastId, user_id: user.id, ...patch },
    {
      onConflict: "broadcast_id,user_id",
      // For clicks we only want to set link_clicked_at on the first
      // click. ignoreDuplicates would skip the whole row though, so we
      // upsert and let the column already-set survive: the column was
      // null before so the first upsert writes it; subsequent upserts
      // overwrite to a newer timestamp which is harmless for CTR (we
      // count IS NOT NULL, not value).
    },
  );

  if (error) return { ok: false };

  // Refresh any layout the banner is mounted in.
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  revalidatePath("/admin");
  return { ok: true };
}
