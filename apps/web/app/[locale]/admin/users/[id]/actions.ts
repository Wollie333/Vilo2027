"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission, withAdminAudit } from "@/lib/admin";

const suspendSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

const reinstateSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const suspendUserAction = withAdminAudit<
  z.infer<typeof suspendSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.suspend",
    actionName: "user.suspend",
    targetType: "user",
    getTargetId: (a) => a.userId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("user_profiles")
      .update({ is_active: false })
      .eq("id", args.userId)
      .select("id, is_active")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/users/${args.userId}`);
    revalidatePath("/admin/users");
    return { result: { ok: true }, after: data };
  },
);

export const reinstateUserAction = withAdminAudit<
  z.infer<typeof reinstateSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.suspend",
    actionName: "user.reinstate",
    targetType: "user",
    getTargetId: (a) => a.userId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("user_profiles")
      .update({ is_active: true })
      .eq("id", args.userId)
      .select("id, is_active")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/users/${args.userId}`);
    revalidatePath("/admin/users");
    return { result: { ok: true }, after: data };
  },
);

// ─── Edit profile ─────────────────────────────────────────────
const editSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  reason: z.string().optional(),
});

export const updateUserProfileAction = withAdminAudit<
  z.infer<typeof editSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.update_profile",
    targetType: "user",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    if (!editSchema.safeParse(args).success) throw new Error("Invalid input.");
    const { error, data } = await service
      .from("user_profiles")
      .update({
        full_name: args.fullName?.trim() || null,
        phone: args.phone?.trim() || null,
      })
      .eq("id", args.userId)
      .select("id, full_name, phone")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${args.userId}`);
    return { result: { ok: true }, after: data };
  },
);

// ─── Change role ──────────────────────────────────────────────
const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["guest", "host", "staff", "super_admin"]),
  reason: z.string().min(5).max(500),
});

export const changeUserRoleAction = withAdminAudit<
  z.infer<typeof roleSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.role",
    actionName: "user.change_role",
    targetType: "user",
    getTargetId: (a) => a.userId,
    requireReason: true,
  },
  async (args, service) => {
    if (!roleSchema.safeParse(args).success) throw new Error("Invalid input.");
    const { error, data } = await service
      .from("user_profiles")
      .update({ role: args.role })
      .eq("id", args.userId)
      .select("id, role")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${args.userId}`);
    revalidatePath("/admin/users");
    return { result: { ok: true }, after: data };
  },
);

// ─── Soft-delete (never hard-delete) ──────────────────────────
const deleteSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const softDeleteUserAction = withAdminAudit<
  z.infer<typeof deleteSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.delete",
    actionName: "user.soft_delete",
    targetType: "user",
    getTargetId: (a) => a.userId,
    requireReason: true,
  },
  async (args, service) => {
    if (!deleteSchema.safeParse(args).success)
      throw new Error("Invalid input.");
    const { error, data } = await service
      .from("user_profiles")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", args.userId)
      .select("id, deleted_at")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${args.userId}`);
    revalidatePath("/admin/users");
    return { result: { ok: true }, after: data };
  },
);

// ─── Admin note ───────────────────────────────────────────────
const noteSchema = z.object({
  userId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  reason: z.string().optional(),
});

export const addAdminUserNoteAction = withAdminAudit<
  z.infer<typeof noteSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.add_note",
    targetType: "user",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    if (!noteSchema.safeParse(args).success) throw new Error("Invalid input.");
    const admin = await requirePermission("users.edit");
    const { error, data } = await service
      .from("admin_user_notes")
      .insert({
        user_id: args.userId,
        author_id: admin.userId,
        body: args.body.trim(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${args.userId}`);
    return { result: { ok: true }, after: data };
  },
);

// ─── Thin client wrappers (return {ok,error} instead of redirect-throw) ───
type Res = { ok: true } | { ok: false; error: string };
async function wrap(fn: () => Promise<unknown>): Promise<Res> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export function updateUserProfile(input: {
  userId: string;
  fullName?: string | null;
  phone?: string | null;
}) {
  return wrap(() => updateUserProfileAction(input));
}

export function changeUserRole(input: {
  userId: string;
  role: "guest" | "host" | "staff" | "super_admin";
  reason: string;
}) {
  return wrap(() => changeUserRoleAction(input));
}

export function softDeleteUser(input: { userId: string; reason: string }) {
  return wrap(() => softDeleteUserAction(input));
}

export function addAdminUserNote(input: { userId: string; body: string }) {
  return wrap(() => addAdminUserNoteAction(input));
}

export async function suspendUser(input: { userId: string; reason: string }) {
  const parsed = suspendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await suspendUserAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function reinstateUser(input: { userId: string; reason: string }) {
  const parsed = reinstateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await reinstateUserAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
