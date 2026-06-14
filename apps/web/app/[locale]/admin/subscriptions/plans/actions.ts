"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { PLANS_CACHE_TAG } from "@/lib/plans/getPlans";

// target_id is a uuid; plans are keyed by text, so (like the platform-settings
// actions) we use a stable sentinel and carry the plan key in payload.args.
const PLAN_TARGET = "00000000-0000-0000-0000-0000000b1a47";

const upsertSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(
      /^[a-z0-9_]+$/,
      "Key: lowercase letters, numbers, underscores only.",
    ),
  name: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  currency: z.string().trim().min(3).max(3).default("ZAR"),
  trialDays: z.number().int().min(0).max(365),
  isFree: z.boolean(),
  isActive: z.boolean(),
  isRecommended: z.boolean(),
  bullets: z.array(z.string().trim().min(1).max(200)).max(20),
  sortOrder: z.number().int().min(0).max(9999),
  monthlyPrice: z.number().min(0).max(10_000_000),
  annualPrice: z.number().min(0).max(10_000_000),
  reason: z.string().optional(),
});

export type UpsertPlanInput = z.infer<typeof upsertSchema>;

// Create or update a plan + its monthly/annual prices. The plan `key` is the
// PK and immutable after creation (subscriptions FK to it) — the editor only
// sends it on create. Super-admin only, audited; busts the plans cache.
export const upsertPlanAction = withAdminAudit<UpsertPlanInput, { ok: true }>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "subscriptions.plan.upsert",
    targetType: "plan",
    getTargetId: () => PLAN_TARGET,
  },
  async (args, service) => {
    const parsed = upsertSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid plan.");
    }
    const d = parsed.data;

    const { error: planErr } = await service.from("plans").upsert(
      {
        key: d.key,
        name: d.name,
        tagline: d.tagline ?? null,
        description: d.description ?? null,
        currency: d.currency,
        trial_days: d.trialDays,
        is_free: d.isFree,
        is_active: d.isActive,
        is_recommended: d.isRecommended,
        bullets: d.bullets as never,
        sort_order: d.sortOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (planErr) throw new Error(planErr.message);

    const priceRows = [
      {
        plan: d.key,
        billing_cycle: "monthly",
        price: d.monthlyPrice,
        currency: d.currency,
      },
      {
        plan: d.key,
        billing_cycle: "annual",
        price: d.annualPrice,
        currency: d.currency,
      },
    ];
    const { error: priceErr } = await service.from("plan_prices").upsert(
      priceRows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      { onConflict: "plan,billing_cycle,currency" },
    );
    if (priceErr) throw new Error(priceErr.message);

    revalidateTag(PLANS_CACHE_TAG);
    revalidatePath("/admin/subscriptions/plans");
    return { result: { ok: true }, after: { key: d.key } };
  },
);

const toggleSchema = z.object({
  key: z.string().trim().min(1).max(60),
  isActive: z.boolean(),
  reason: z.string().optional(),
});

// Show/hide a plan from pickers without deleting it.
export const togglePlanActiveAction = withAdminAudit<
  z.infer<typeof toggleSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "subscriptions.plan.toggle_active",
    targetType: "plan",
    getTargetId: () => PLAN_TARGET,
  },
  async (args, service) => {
    const parsed = toggleSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { error } = await service
      .from("plans")
      .update({
        is_active: parsed.data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("key", parsed.data.key);
    if (error) throw new Error(error.message);
    revalidateTag(PLANS_CACHE_TAG);
    revalidatePath("/admin/subscriptions/plans");
    return { result: { ok: true }, after: parsed.data };
  },
);

const deleteSchema = z.object({
  key: z.string().trim().min(1).max(60),
  reason: z.string().optional(),
});

// Delete a plan. Blocked if any subscription still references it (the DB FK
// would reject anyway — we pre-check for a friendly message). Cascades its
// plan_prices + plan_features.
export const deletePlanAction = withAdminAudit<
  z.infer<typeof deleteSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "subscriptions.plan.delete",
    targetType: "plan",
    getTargetId: () => PLAN_TARGET,
  },
  async (args, service) => {
    const parsed = deleteSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { key } = parsed.data;

    const { count } = await service
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("plan", key);
    if ((count ?? 0) > 0) {
      throw new Error(
        `Can't delete — ${count} host(s) are on this plan. Move them first or just deactivate it.`,
      );
    }

    const { error } = await service.from("plans").delete().eq("key", key);
    if (error) throw new Error(error.message);
    revalidateTag(PLANS_CACHE_TAG);
    revalidatePath("/admin/subscriptions/plans");
    return { result: { ok: true }, after: { key } };
  },
);
