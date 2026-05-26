"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  requestType: z.enum(["export", "deletion"]),
  notes: z.string().max(2000).optional().nullable(),
});

type Result = { ok: true } | { ok: false; error: string };

export async function createDataRequestAction(input: {
  requestType: "export" | "deletion";
  notes?: string | null;
}): Promise<Result> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Block stacking — at most one pending request per user per type.
  const { data: existing } = await supabase
    .from("data_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("request_type", parsed.data.requestType)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error: `You already have a pending ${parsed.data.requestType} request.`,
    };
  }

  const { error } = await supabase.from("data_requests").insert({
    user_id: user.id,
    request_type: parsed.data.requestType,
    notes: parsed.data.notes?.trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/data");
  return { ok: true };
}

const cancelSchema = z.object({ requestId: z.string().uuid() });

export async function cancelDataRequestAction(input: {
  requestId: string;
}): Promise<Result> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("data_requests")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.requestId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/data");
  return { ok: true };
}

// ─── Self-service immediate account deletion ─────────────────────────
//
// Hard-deletes every row the user owns, then deletes the auth.users row.
// Pre-MVP policy (CLAUDE.md): hard-delete is acceptable; historical
// records like bookings/reviews get removed alongside the user. Once we
// have real production data we'll switch to anonymise-then-soft-delete.
//
// Guard rails:
//   - super_admin self-delete is blocked (would lock the platform out;
//     another admin has to do it manually).
//   - User must type their exact email to confirm, server re-checks it.

const deleteSchema = z.object({
  confirmation: z.string().min(1, "Type your email to confirm."),
});

export async function deleteAccountAction(input: {
  confirmation: string;
}): Promise<{ ok: false; error: string }> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Type your email to confirm." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: "Not signed in." };

  if (
    parsed.data.confirmation.trim().toLowerCase() !== user.email.toLowerCase()
  ) {
    return {
      ok: false,
      error: "Email doesn't match — type it exactly to confirm.",
    };
  }

  // Block super_admin self-delete.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile?.role as string | undefined) === "super_admin") {
    return {
      ok: false,
      error:
        "Super admin accounts can't self-delete — ask another admin to remove your account.",
    };
  }

  const admin = createAdminClient();

  // Pre-clear children with ON DELETE RESTRICT against user_profiles + hosts.
  // Anything with CASCADE will cascade automatically from the auth.users
  // delete at the end (auth.users → user_profiles → CASCADE children).
  try {
    // Hosts have a RESTRICT chain: listings RESTRICT, refund_requests RESTRICT.
    const { data: hostRow } = await admin
      .from("hosts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (hostRow?.id) {
      const hostId = hostRow.id as string;
      await admin.from("listings").delete().eq("host_id", hostId);
      await admin.from("refund_requests").delete().eq("host_id", hostId);
      await admin.from("hosts").delete().eq("id", hostId);
    }

    // Direct RESTRICT FKs against user_profiles.
    await admin.from("bookings").delete().eq("guest_id", user.id);
    await admin.from("reviews").delete().eq("guest_id", user.id);
    await admin
      .from("admin_message_batches")
      .delete()
      .eq("created_by", user.id);

    // SET NULL columns don't block delete but clear them so the cascade
    // is unambiguous.
    await admin
      .from("messages")
      .update({ sender_id: null })
      .eq("sender_id", user.id);
    await admin.from("data_requests").delete().eq("user_id", user.id);
  } catch {
    return {
      ok: false,
      error:
        "We hit a snag clearing your data. Try again or email privacy@viloplatform.com.",
    };
  }

  // Delete the auth user → cascades user_profiles + every CASCADE child
  // (in_app_notifications, push_tokens, user_notification_*, broadcast_acks, etc.).
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    return {
      ok: false,
      error:
        "Could not finalise account deletion. Some records may still reference your account — email privacy@viloplatform.com.",
    };
  }

  // Best-effort: invalidate the current cookie session.
  await supabase.auth.signOut().catch(() => undefined);

  // redirect throws to terminate execution — return type narrows to error
  // for callers that don't await/handle the throw.
  redirect("/?account_deleted=1");
}
