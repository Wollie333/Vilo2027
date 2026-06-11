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

  // Resolve the host record (if this user is a host) so we can scope the
  // safety check + purge to their listings as well as their guest bookings.
  const { data: hostRow } = await admin
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const hostId = (hostRow?.id as string | undefined) ?? null;

  // ── Safety gate ──────────────────────────────────────────────────
  // A host/guest may NOT delete their account while a booking, payment or
  // refund is still active — those must be cancelled / settled first. This
  // mirrors the listing-delete guard: live money/commitments block teardown.
  const ACTIVE_BOOKING_STATUSES = [
    "pending",
    "pending_eft",
    "pending_eft_review",
    "confirmed",
    "checked_in",
  ];
  const bookingScope = hostId
    ? `host_id.eq.${hostId},guest_id.eq.${user.id}`
    : `guest_id.eq.${user.id}`;
  const { count: activeBookings } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .or(bookingScope)
    .in("status", ACTIVE_BOOKING_STATUSES);

  let openRefunds = 0;
  if (hostId) {
    const { count } = await admin
      .from("refund_requests")
      .select("id", { count: "exact", head: true })
      .eq("host_id", hostId)
      .in("status", ["pending", "processing", "escalated"]);
    openRefunds = count ?? 0;
  }

  if ((activeBookings ?? 0) > 0 || openRefunds > 0) {
    const parts: string[] = [];
    if ((activeBookings ?? 0) > 0)
      parts.push(
        `${activeBookings} active booking${activeBookings === 1 ? "" : "s"}`,
      );
    if (openRefunds > 0)
      parts.push(`${openRefunds} open refund${openRefunds === 1 ? "" : "s"}`);
    return {
      ok: false,
      error: `You still have ${parts.join(" and ")}. Cancel or settle ${parts.length > 1 ? "them" : "it"} from your dashboard first, then delete your account.`,
    };
  }

  // ── Purge ────────────────────────────────────────────────────────
  // Gate passed: only historical rows remain (cancelled / expired /
  // completed bookings + their payments, invoices, reviews, snapshots).
  // Hard-delete them in FK-safe order via the transactional DB function so
  // the auth.users → user_profiles cascade isn't blocked by a RESTRICT FK.
  // (Pre-MVP policy — see migration 20260531000021.)
  const { error: purgeErr } = await admin.rpc("app_purge_user_account", {
    p_user_id: user.id,
  });
  if (purgeErr) {
    return {
      ok: false,
      error:
        "We hit a snag clearing your historical records. Try again or email privacy@viloplatform.com.",
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
