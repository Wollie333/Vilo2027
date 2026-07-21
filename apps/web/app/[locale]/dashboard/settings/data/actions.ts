"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { PRIVACY_EMAIL } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { softDeleteUserAccount } from "@/lib/users/accountLifecycle";

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

// ─── Self-service account deletion (soft delete + 30-day hold) ────────
//
// Deleting an account SOFT-deletes it: the user is signed out and blocked from
// signing in, every listing/booking/record is hidden from them and the world,
// but nothing is destroyed. The account sits in the admin "Deleted" category
// for a 30-day hold, during which an admin can reinstate it (restoring
// everything). Only after the hold does an admin MANUALLY hard-purge the data —
// there is no automatic purge. This gives a change-of-mind window and keeps the
// data recoverable for disputes/compliance.
//
// Guard rails:
//   - super_admin self-delete is blocked (would lock the platform out;
//     another admin has to do it manually).
//   - User must type their exact email to confirm, server re-checks it.
//   - Active bookings / open refunds must be settled first (safety gate below).

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
      .in("status", ["pending", "processing"]);
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

  // ── Soft delete + hold ───────────────────────────────────────────
  // Gate passed. Soft-delete: hide the account + block sign-in, but retain
  // every row so the account can be reinstated during the 30-day hold. An
  // admin hard-purges the data manually after the hold — nothing is destroyed
  // here. (See lib/users/accountLifecycle.ts.)
  try {
    await softDeleteUserAccount(admin, user.id);
  } catch {
    return {
      ok: false,
      error: `We hit a snag closing your account. Try again or email ${PRIVACY_EMAIL}.`,
    };
  }

  // Best-effort: invalidate the current cookie session.
  await supabase.auth.signOut().catch(() => undefined);

  // redirect throws to terminate execution — return type narrows to error
  // for callers that don't await/handle the throw.
  redirect("/?account_deleted=1");
}
