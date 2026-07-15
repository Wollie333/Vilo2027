"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertFullHost as getHost } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

import {
  inviteStaffSchema,
  updateStaffRoleSchema,
  type InviteStaffInput,
  type StaffRole,
  type UpdateStaffRoleInput,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function getSeatLimit(hostId: string): Promise<number | null> {
  const supabase = createServerClient();
  const { data } = await supabase.rpc("check_feature_permission", {
    p_host_id: hostId,
    p_feature_key: "staff_seats",
  });
  if (!data) return null;
  const result = data as { is_enabled: boolean; limit_value: number | null };
  if (!result.is_enabled) return 0;
  return result.limit_value;
}

export async function inviteStaffAction(
  input: InviteStaffInput,
): Promise<ActionResult<{ inviteId: string; token: string }>> {
  const host = await getHost();
  if (!host.ok) return host;

  const parsed = inviteStaffSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }

  const supabase = createServerClient();

  // Seat limit check. limit_value of null or 0 means no seats on this plan.
  const limit = await getSeatLimit(host.hostId);
  if (limit == null || limit < 1) {
    return {
      ok: false,
      error:
        "Your plan doesn't include staff seats. Upgrade to Basic or higher.",
    };
  }

  const [{ count: activeCount }, { count: pendingCount }] = await Promise.all([
    supabase
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("host_id", host.hostId),
    supabase
      .from("staff_invites")
      .select("id", { count: "exact", head: true })
      .eq("host_id", host.hostId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);

  const used = (activeCount ?? 0) + (pendingCount ?? 0);
  if (used >= limit) {
    return {
      ok: false,
      error: `You've used all ${limit} staff seat${
        limit === 1 ? "" : "s"
      } on this plan.`,
    };
  }

  const email = parsed.data.email.toLowerCase();

  // Refuse if there's already an active staff_members row for this email.
  const { data: existingProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    const { data: existingStaff } = await supabase
      .from("staff_members")
      .select("id")
      .eq("host_id", host.hostId)
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (existingStaff) {
      return { ok: false, error: "That person is already on your team." };
    }
  }

  // Refuse if there's already a pending invite for this email.
  const { data: existingInvite } = await supabase
    .from("staff_invites")
    .select("id")
    .eq("host_id", host.hostId)
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existingInvite) {
    return {
      ok: false,
      error:
        "There's already a pending invite for that email. Cancel or resend it instead.",
    };
  }

  const { data: invite, error } = await supabase
    .from("staff_invites")
    .insert({
      host_id: host.hostId,
      email,
      role: parsed.data.role,
      invited_by: host.userId,
    })
    .select("id, token")
    .single();
  if (error || !invite) {
    return { ok: false, error: "Could not create the invite." };
  }

  revalidatePath("/dashboard/staff");
  return { ok: true, data: { inviteId: invite.id, token: invite.token } };
}

export async function cancelInviteAction(
  inviteId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("staff_invites")
    .delete()
    .eq("id", inviteId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not cancel the invite." };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function resendInviteAction(
  inviteId: string,
): Promise<ActionResult<{ token: string }>> {
  const host = await getHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("staff_invites")
    .select("id, accepted_at")
    .eq("id", inviteId)
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Invite not found." };
  if (existing.accepted_at) {
    return { ok: false, error: "That invite was already accepted." };
  }

  // Rotate the token (admin client — column has DB default but supabase-js
  // won't re-default an explicit null, so generate via crypto).
  const newToken = generateHexToken(32);
  const newExpires = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const { error } = await supabase
    .from("staff_invites")
    .update({ token: newToken, expires_at: newExpires })
    .eq("id", inviteId);
  if (error) return { ok: false, error: "Could not refresh the invite." };

  revalidatePath("/dashboard/staff");
  return { ok: true, data: { token: newToken } };
}

export async function removeStaffAction(
  staffMemberId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("staff_members")
    .delete()
    .eq("id", staffMemberId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not remove staff member." };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function updateStaffRoleAction(
  staffMemberId: string,
  input: UpdateStaffRoleInput,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const parsed = updateStaffRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a valid role." };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("staff_members")
    .update({ role: parsed.data.role })
    .eq("id", staffMemberId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not change the role." };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

// ─── Public accept flow (called from /staff/accept/[token]) ─────

export type AcceptResult =
  | { ok: true; hostHandle: string | null }
  | {
      ok: false;
      error: string;
      reason?: "not_signed_in" | "wrong_account" | "invalid";
      expectedEmail?: string;
    };

export async function acceptInviteAction(token: string): Promise<AcceptResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in.", reason: "not_signed_in" };
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("staff_invites")
    .select("id, host_id, email, role, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite) {
    return { ok: false, error: "Invite not found.", reason: "invalid" };
  }
  if (invite.accepted_at) {
    return {
      ok: false,
      error: "This invite has already been used.",
      reason: "invalid",
    };
  }
  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false, error: "This invite has expired.", reason: "invalid" };
  }

  // Email must match the invitee. Profile lookup for the email is the
  // source of truth (auth user can drift but user_profiles.email is what
  // RLS keys off via auth.uid()).
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle();
  const profileEmail = (profile?.email ?? user.email ?? "").toLowerCase();
  if (profileEmail !== invite.email.toLowerCase()) {
    return {
      ok: false,
      error: `This invite is for ${invite.email}. Sign in with that account to accept.`,
      reason: "wrong_account",
      expectedEmail: invite.email,
    };
  }

  // Insert the staff_members row + mark the invite consumed.
  const { error: insErr } = await admin.from("staff_members").insert({
    host_id: invite.host_id,
    user_id: user.id,
    role: invite.role as StaffRole,
  });
  if (insErr && !insErr.message.includes("unique_staff_per_host")) {
    return { ok: false, error: "Could not finish joining the team." };
  }

  await admin
    .from("staff_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Look up host handle for the success redirect.
  const { data: host } = await admin
    .from("hosts")
    .select("handle")
    .eq("id", invite.host_id)
    .maybeSingle();

  revalidatePath("/dashboard/staff");
  return { ok: true, hostHandle: host?.handle ?? null };
}

function generateHexToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
