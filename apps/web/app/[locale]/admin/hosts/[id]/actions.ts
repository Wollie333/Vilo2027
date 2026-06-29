"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

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
