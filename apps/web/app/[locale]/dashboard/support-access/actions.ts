"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureWieloThread } from "@/lib/inbox/platform-thread";
import { createAdminClient } from "@/lib/supabase/admin";
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

// The account owner REPORTS a support-access request: auto-decline it AND drop a
// message into their Wielo support thread so Wielo staff see the flag on their
// admin inbox. The decline is the security-critical part; a thread-post failure
// must never block it.
export async function reportSupportAccessAction(input: {
  grantId: string;
}): Promise<Result> {
  const parsed = z.object({ grantId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("admin_support_grants")
    .select("id, host_id, host_user_id, reason, status")
    .eq("id", parsed.data.grantId)
    .eq("host_user_id", user.id)
    .maybeSingle();
  if (!grant) return { ok: false, error: "Request not found." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("admin_support_grants")
    .update({ status: "declined", decided_at: now })
    .eq("id", grant.id)
    .eq("host_user_id", user.id);
  if (error) return { ok: false, error: "Could not decline the request." };

  // Flag it in the Wielo support thread (best-effort). Posted AS the account
  // owner so Wielo staff see the owner reporting it, unread on their side.
  try {
    const conversationId = await ensureWieloThread(admin, {
      id: grant.host_id as string,
      userId: user.id,
    });
    await admin.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: `🚩 I'm reporting a request to access/edit my financial records — I did not expect it and have declined it. Reason stated by staff: "${
        grant.reason ?? "—"
      }". Please investigate who requested this.`,
      read_by_host: true,
      read_by_guest: false,
    });
  } catch {
    // Non-blocking: the decline already protected the account.
  }

  revalidatePath("/dashboard/support-access");
  return { ok: true };
}
