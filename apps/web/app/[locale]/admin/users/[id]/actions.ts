"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

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
