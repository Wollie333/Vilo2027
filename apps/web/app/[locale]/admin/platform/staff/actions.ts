"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireAdmin, withAdminAudit } from "@/lib/admin";
import { getBrandName } from "@/lib/brand";
import { sendTransactionalEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

type Ok = { ok: true } | { ok: false; error: string };

function appOrigin(): string {
  const h = headers();
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    h.get("origin") ||
    `https://${h.get("host") ?? "vilo.site"}`
  );
}

/** True when `userId` is the ONLY active super_admin — protects against lockout. */
async function isLastActiveSuperAdmin(
  service: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  const { data: target } = await service
    .from("platform_staff")
    .select("role_id, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (target?.role_id !== "super_admin") return false;
  const { count } = await service
    .from("platform_staff")
    .select("user_id", { count: "exact", head: true })
    .eq("role_id", "super_admin")
    .eq("is_active", true);
  return (count ?? 0) <= 1;
}

// ── Invite a teammate ─────────────────────────────────────────
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  roleId: z.string().trim().min(1).max(40),
  reason: z.string().optional(),
});

export const inviteStaffAction = withAdminAudit<
  z.infer<typeof inviteSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.staff",
    actionName: "staff.invite",
    targetType: "platform_staff",
    getTargetId: (a) => a.email,
  },
  async (args, service) => {
    const parsed = inviteSchema.safeParse(args);
    if (!parsed.success) throw new Error("Enter a valid email and role.");
    const { email, roleId } = parsed.data;

    // Already an active staff member?
    const { data: existingUser } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existingUser) {
      const { data: staff } = await service
        .from("platform_staff")
        .select("is_active")
        .eq("user_id", existingUser.id)
        .maybeSingle();
      if (staff?.is_active) throw new Error("Already an active staff member.");
    }

    const actor = await requireAdmin();

    // Clear any prior pending invite for this email, then issue a fresh one.
    await service
      .from("platform_staff_invites")
      .delete()
      .ilike("email", email)
      .is("accepted_at", null);
    const { data: invite, error } = await service
      .from("platform_staff_invites")
      .insert({ email, role_id: roleId, invited_by: actor.userId })
      .select("id, token")
      .single();
    if (error || !invite) throw new Error(error?.message ?? "Invite failed.");

    // Best-effort email with the accept link (never throws).
    const brand = await getBrandName();
    const link = `${appOrigin()}/staff-invite?token=${invite.token}`;
    await sendTransactionalEmail({
      to: email,
      subject: `You've been invited to the ${brand} admin team`,
      html: `<p>You've been invited to join the ${brand} admin team as <strong>${roleId}</strong>.</p>
<p>Sign in (or create an account) with this email, then accept your invite:</p>
<p><a href="${link}">${link}</a></p>
<p>This invite expires in 72 hours.</p>`,
    });

    revalidatePath("/admin/platform/staff");
    return { result: { ok: true }, after: { id: invite.id, email, roleId } };
  },
);

export async function inviteStaff(input: {
  email: string;
  roleId: string;
}): Promise<Ok> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Enter a valid email + role." };
  try {
    await inviteStaffAction(parsed.data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// ── Revoke a pending invite ───────────────────────────────────
const revokeSchema = z.object({
  inviteId: z.string().uuid(),
  reason: z.string().optional(),
});

export const revokeInviteAction = withAdminAudit<
  z.infer<typeof revokeSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.staff",
    actionName: "staff.invite_revoke",
    targetType: "platform_staff",
    getTargetId: (a) => a.inviteId,
  },
  async (args, service) => {
    const { error } = await service
      .from("platform_staff_invites")
      .delete()
      .eq("id", args.inviteId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/platform/staff");
    return { result: { ok: true }, after: { id: args.inviteId } };
  },
);

export async function revokeInvite(input: { inviteId: string }): Promise<Ok> {
  try {
    await revokeInviteAction(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// ── Activate / deactivate a staff member ──────────────────────
const setActiveSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
  reason: z.string().optional(),
});

export const setStaffActiveAction = withAdminAudit<
  z.infer<typeof setActiveSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.staff",
    actionName: "staff.set_active",
    targetType: "platform_staff",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    if (
      !args.isActive &&
      (await isLastActiveSuperAdmin(service, args.userId))
    ) {
      throw new Error("Can't deactivate the last active super admin.");
    }
    const { error, data } = await service
      .from("platform_staff")
      .update({ is_active: args.isActive })
      .eq("user_id", args.userId)
      .select("user_id, is_active")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/platform/staff");
    return { result: { ok: true }, after: data };
  },
);

export async function setStaffActive(input: {
  userId: string;
  isActive: boolean;
}): Promise<Ok> {
  try {
    await setStaffActiveAction(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// ── Change a staff member's role ──────────────────────────────
const roleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().trim().min(1).max(40),
  reason: z.string().optional(),
});

export const changeStaffRoleAction = withAdminAudit<
  z.infer<typeof roleSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.staff",
    actionName: "staff.change_role",
    targetType: "platform_staff",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    if (
      args.roleId !== "super_admin" &&
      (await isLastActiveSuperAdmin(service, args.userId))
    ) {
      throw new Error("Can't demote the last active super admin.");
    }
    const { error, data } = await service
      .from("platform_staff")
      .update({ role_id: args.roleId })
      .eq("user_id", args.userId)
      .select("user_id, role_id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/platform/staff");
    return { result: { ok: true }, after: data };
  },
);

export async function changeStaffRole(input: {
  userId: string;
  roleId: string;
}): Promise<Ok> {
  try {
    await changeStaffRoleAction(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// ── Accept an invite (NOT admin-gated — the invitee isn't staff yet) ──
export async function acceptStaffInvite(token: string): Promise<Ok> {
  const t = (token ?? "").trim();
  if (!t) return { ok: false, error: "Missing invite token." };

  const sb = createServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in to accept." };

  const service = createAdminClient();
  const { data: invite } = await service
    .from("platform_staff_invites")
    .select(
      "id, email, role_id, expires_at, accepted_at, invited_by, created_at",
    )
    .eq("token", t)
    .maybeSingle();
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.accepted_at)
    return { ok: false, error: "This invite was already used." };
  if (new Date(invite.expires_at) < new Date())
    return { ok: false, error: "This invite has expired." };

  const { data: profile } = await service
    .from("user_profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  const userEmail = (profile?.email ?? user.email ?? "").toLowerCase();
  if (userEmail !== invite.email.toLowerCase()) {
    return {
      ok: false,
      error: `This invite is for ${invite.email}. Sign in with that email.`,
    };
  }

  const { error: upErr } = await service.from("platform_staff").upsert(
    {
      user_id: user.id,
      role_id: invite.role_id,
      is_active: true,
      invited_by: invite.invited_by,
      invited_at: invite.created_at,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (upErr) return { ok: false, error: upErr.message };

  await service
    .from("platform_staff_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return { ok: true };
}
