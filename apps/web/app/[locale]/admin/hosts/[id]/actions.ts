"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireAdmin, withAdminAudit } from "@/lib/admin";
import { getBrandName } from "@/lib/brand";
import { sendTransactionalEmail } from "@/lib/email/send";

const verifySchema = z.object({
  hostId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const verifyHostAction = withAdminAudit<
  z.infer<typeof verifySchema>,
  { ok: true }
>(
  {
    permissionKey: "hosts.verify",
    actionName: "host.verify",
    targetType: "host",
    getTargetId: (a) => a.hostId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("hosts")
      .update({ is_verified: true })
      .eq("id", args.hostId)
      .select("id, is_verified")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/hosts/${args.hostId}`);
    revalidatePath("/admin/hosts");
    return { result: { ok: true }, after: data };
  },
);

export const unverifyHostAction = withAdminAudit<
  z.infer<typeof verifySchema>,
  { ok: true }
>(
  {
    permissionKey: "hosts.verify",
    actionName: "host.unverify",
    targetType: "host",
    getTargetId: (a) => a.hostId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("hosts")
      .update({ is_verified: false })
      .eq("id", args.hostId)
      .select("id, is_verified")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/hosts/${args.hostId}`);
    revalidatePath("/admin/hosts");
    return { result: { ok: true }, after: data };
  },
);

export async function verifyHost(input: { hostId: string; reason: string }) {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await verifyHostAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function unverifyHost(input: { hostId: string; reason: string }) {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await unverifyHostAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

// Host-level suspend/reactivate (hosts.is_active) — distinct from user-level
// suspend (user_profiles.is_active). A suspended host's listings should not take
// bookings; reason is required + audited.
const setActiveSchema = z.object({
  hostId: z.string().uuid(),
  active: z.boolean(),
  reason: z.string().min(5).max(500),
});

export const setHostActiveAction = withAdminAudit<
  z.infer<typeof setActiveSchema>,
  { ok: true }
>(
  {
    permissionKey: "hosts.verify",
    actionName: "host.set_active",
    targetType: "host",
    getTargetId: (a) => a.hostId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("hosts")
      .update({ is_active: args.active })
      .eq("id", args.hostId)
      .select("id, is_active")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/hosts/${args.hostId}`);
    revalidatePath("/admin/hosts");
    return { result: { ok: true }, after: data };
  },
);

export async function setHostActive(input: {
  hostId: string;
  active: boolean;
  reason: string;
}) {
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await setHostActiveAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

// ── Host staff (assign existing users as staff to a host) ──────
// `staff_members` is host-scoped (host_id + user_id). Admin can directly assign
// an existing Vilo user as staff to a host (host-side, this normally goes via an
// invite the user accepts; admin assignment is authoritative). Audited.
const addStaffSchema = z.object({
  hostId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(160),
  reason: z.string().optional(),
});

export const addHostStaffAction = withAdminAudit<
  z.infer<typeof addStaffSchema>,
  { ok: true }
>(
  {
    permissionKey: "hosts.verify",
    actionName: "host.staff_add",
    targetType: "host",
    getTargetId: (a) => a.hostId,
  },
  async (args, service) => {
    const { data: u } = await service
      .from("user_profiles")
      .select("id, deleted_at")
      .ilike("email", args.email)
      .maybeSingle();
    if (!u)
      throw new Error(
        "No Vilo user with that email — they need an account first.",
      );
    if (u.deleted_at) throw new Error("That user account is deleted.");
    const { error } = await service
      .from("staff_members")
      .insert({ host_id: args.hostId, user_id: u.id });
    if (error) {
      if (error.code === "23505")
        throw new Error("Already a staff member of this host.");
      throw new Error(error.message);
    }
    revalidatePath(`/admin/hosts/${args.hostId}`);
    return {
      result: { ok: true },
      after: { host_id: args.hostId, user_id: u.id },
    };
  },
);

const removeStaffSchema = z.object({
  hostId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().optional(),
});

export const removeHostStaffAction = withAdminAudit<
  z.infer<typeof removeStaffSchema>,
  { ok: true }
>(
  {
    permissionKey: "hosts.verify",
    actionName: "host.staff_remove",
    targetType: "host",
    getTargetId: (a) => a.hostId,
  },
  async (args, service) => {
    const { error } = await service
      .from("staff_members")
      .delete()
      .eq("host_id", args.hostId)
      .eq("user_id", args.userId);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/hosts/${args.hostId}`);
    return {
      result: { ok: true },
      after: { host_id: args.hostId, user_id: args.userId },
    };
  },
);

export async function addHostStaff(input: { hostId: string; email: string }) {
  const parsed = addStaffSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, error: "Enter a valid email." };
  try {
    await addHostStaffAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function removeHostStaff(input: {
  hostId: string;
  userId: string;
}) {
  const parsed = removeStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input." };
  try {
    await removeHostStaffAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

// Admin "invite instead": create a host-scoped staff_invites row + email the
// existing /staff/accept/<token> link (reuses the host-side acceptInviteAction).
// role defaults to 'assistant'; admin override skips the plan seat-limit check.
export const inviteHostStaffAction = withAdminAudit<
  z.infer<typeof addStaffSchema>,
  { ok: true }
>(
  {
    permissionKey: "hosts.verify",
    actionName: "host.staff_invite",
    targetType: "host",
    getTargetId: (a) => a.hostId,
  },
  async (args, service) => {
    const email = args.email;
    // Already an active staff member of this host?
    const { data: u } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (u) {
      const { data: existing } = await service
        .from("staff_members")
        .select("id")
        .eq("host_id", args.hostId)
        .eq("user_id", u.id)
        .maybeSingle();
      if (existing) throw new Error("Already a staff member of this host.");
    }

    const actor = await requireAdmin();
    // Replace any prior pending invite for this email on this host.
    await service
      .from("staff_invites")
      .delete()
      .eq("host_id", args.hostId)
      .ilike("email", email)
      .is("accepted_at", null);
    const { data: invite, error } = await service
      .from("staff_invites")
      .insert({ host_id: args.hostId, email, invited_by: actor.userId })
      .select("id, token")
      .single();
    if (error || !invite) throw new Error(error?.message ?? "Invite failed.");

    const h = headers();
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      h.get("origin") ||
      `https://${h.get("host") ?? "vilo.site"}`;
    const brand = await getBrandName();
    const link = `${origin}/staff/accept/${invite.token}`;
    await sendTransactionalEmail({
      to: email,
      subject: `You've been invited to join a team on ${brand}`,
      html: `<p>You've been invited to join a host's team on ${brand}.</p>
<p>Sign in (or create an account) with this email, then accept:</p>
<p><a href="${link}">${link}</a></p>
<p>This invite expires in 7 days.</p>`,
    });

    revalidatePath(`/admin/hosts/${args.hostId}`);
    return {
      result: { ok: true },
      after: { host_id: args.hostId, email, invite_id: invite.id },
    };
  },
);

export async function inviteHostStaff(input: {
  hostId: string;
  email: string;
}) {
  const parsed = addStaffSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, error: "Enter a valid email." };
  try {
    await inviteHostStaffAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
