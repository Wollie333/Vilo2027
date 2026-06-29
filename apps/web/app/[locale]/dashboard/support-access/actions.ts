"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  grantId: z.string().uuid(),
  action: z.enum(["approve", "decline", "revoke"]),
});

type Result = { ok: true } | { ok: false; error: string };

// The HOST approves/declines/revokes a Wielo support-access request on their own
// account. RLS scopes the update to the host's own grant rows. Approving opens a
// 72-hour edit window for the admin.
export async function respondSupportAccessAction(input: {
  grantId: string;
  action: "approve" | "decline" | "revoke";
}): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const now = new Date();
  const patch =
    parsed.data.action === "approve"
      ? {
          status: "approved" as const,
          decided_at: now.toISOString(),
          // 24-hour support window — auto-expires; host must re-grant after.
          expires_at: new Date(now.getTime() + 24 * 3_600_000).toISOString(),
        }
      : parsed.data.action === "decline"
        ? { status: "declined" as const, decided_at: now.toISOString() }
        : { status: "revoked" as const, decided_at: now.toISOString() };

  const { error } = await supabase
    .from("admin_support_grants")
    .update(patch)
    .eq("id", parsed.data.grantId)
    .eq("host_user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/support-access");
  return { ok: true };
}
