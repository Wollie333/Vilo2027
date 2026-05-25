"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

const upsertSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  icon: z.string().min(1).max(40),
  uptimePct: z.number().min(0).max(100),
  status: z.enum(["normal", "degraded", "incident", "maintenance"]),
  note: z.string().max(280).optional(),
  sparkValues: z.array(z.number().min(0).max(100)).length(7),
  sortOrder: z.number().int().min(0).max(10000),
  isCreate: z.boolean(),
  reason: z.string().optional(),
});

const idReasonSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const upsertHelpStatusAction = withAdminAudit<
  z.infer<typeof upsertSchema>,
  { ok: true; id: string }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.status.upsert",
    targetType: "help_status",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const payload = {
      name: args.name.trim(),
      icon: args.icon,
      uptime_pct: args.uptimePct,
      status: args.status,
      note: args.note ?? null,
      spark_values: args.sparkValues as never,
      sort_order: args.sortOrder,
    };
    if (args.isCreate) {
      const { data, error } = await service
        .from("help_status_components")
        .insert({ id: args.id, ...payload })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      revalidatePath("/admin/help/status");
      revalidatePath("/dashboard/help");
      revalidatePath("/help");
      return {
        result: { ok: true, id: (data as { id: string }).id },
        after: data,
      };
    }
    const { data, error } = await service
      .from("help_status_components")
      .update(payload)
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/status");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return {
      result: { ok: true, id: (data as { id: string }).id },
      after: data,
    };
  },
);

export const deleteHelpStatusAction = withAdminAudit<
  z.infer<typeof idReasonSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.status.delete",
    targetType: "help_status",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("help_status_components")
      .delete()
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/status");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return { result: { ok: true }, after: data };
  },
);

export async function saveHelpStatus(input: {
  id?: string;
  name: string;
  icon: string;
  uptimePct: number;
  status: "normal" | "degraded" | "incident" | "maintenance";
  note?: string;
  sparkValues: number[];
  sortOrder: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const id =
    input.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000");
  const parsed = upsertSchema.safeParse({ ...input, id, isCreate: !input.id });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    const res = await upsertHelpStatusAction(parsed.data);
    if (res.ok) return res;
    return { ok: false, error: "Save failed." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function deleteHelpStatus(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = idReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await deleteHelpStatusAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
