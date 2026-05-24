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
