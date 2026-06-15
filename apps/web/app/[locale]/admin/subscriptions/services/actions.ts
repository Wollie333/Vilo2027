"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

const SERVICE_TARGET = "00000000-0000-0000-0000-00000000e5e1";

const upsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000).optional().nullable(),
  billingType: z.enum(["one_time", "recurring"]),
  price: z.number().min(0).max(10_000_000),
  currency: z.string().trim().min(3).max(3).default("ZAR"),
  billingCycle: z.enum(["monthly", "annual"]).optional().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  reason: z.string().optional(),
});

export type UpsertServiceInput = z.infer<typeof upsertSchema>;

export const upsertServiceAction = withAdminAudit<
  UpsertServiceInput,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "subscriptions.service.upsert",
    targetType: "platform_service",
    getTargetId: () => SERVICE_TARGET,
  },
  async (args, service) => {
    const parsed = upsertSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid service.");
    }
    const d = parsed.data;
    const row = {
      name: d.name,
      description: d.description ?? null,
      billing_type: d.billingType,
      price: d.price,
      currency: d.currency,
      billing_cycle:
        d.billingType === "recurring" ? (d.billingCycle ?? "monthly") : null,
      is_active: d.isActive,
      sort_order: d.sortOrder,
      updated_at: new Date().toISOString(),
    };
    const q = d.id
      ? service.from("platform_services").update(row).eq("id", d.id)
      : service.from("platform_services").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    revalidatePath("/admin/subscriptions/services");
    return { result: { ok: true }, after: { id: d.id ?? null } };
  },
);

const toggleSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
  reason: z.string().optional(),
});

export const toggleServiceActiveAction = withAdminAudit<
  z.infer<typeof toggleSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "subscriptions.service.toggle",
    targetType: "platform_service",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const parsed = toggleSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { error } = await service
      .from("platform_services")
      .update({
        is_active: parsed.data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/subscriptions/services");
    return { result: { ok: true }, after: parsed.data };
  },
);

const deleteSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
});

export const deleteServiceAction = withAdminAudit<
  z.infer<typeof deleteSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "subscriptions.service.delete",
    targetType: "platform_service",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const parsed = deleteSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { error } = await service
      .from("platform_services")
      .delete()
      .eq("id", parsed.data.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/subscriptions/services");
    return { result: { ok: true }, after: { id: parsed.data.id } };
  },
);
