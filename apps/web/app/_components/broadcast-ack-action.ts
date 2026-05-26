"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

type Input = {
  broadcastId: string;
  mode: "acknowledge" | "dismiss";
};

/**
 * Marks a broadcast as acknowledged (critical tier) or dismissed (warning
 * tier) for the calling user. Idempotent — re-upserting is harmless.
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
      : { dismissed_at: now };

  const { error } = await supabase
    .from("broadcast_acknowledgements")
    .upsert(
      { broadcast_id: input.broadcastId, user_id: user.id, ...patch },
      { onConflict: "broadcast_id,user_id" },
    );

  if (error) return { ok: false };

  // Refresh any layout the banner is mounted in.
  revalidatePath("/dashboard");
  revalidatePath("/account");
  revalidatePath("/admin");
  return { ok: true };
}
