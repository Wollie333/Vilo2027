"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

const PRODUCT_TARGET = "00000000-0000-0000-0000-0000000900d5";

const upsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).optional().nullable(),
  type: z.enum(["subscription", "one_off"]),
  price: z.number().min(0).max(10_000_000),
  currency: z.string().trim().min(3).max(3).default("ZAR"),
  billingCycle: z
    .enum(["weekly", "monthly", "quarterly", "biannual", "annual"])
    .optional()
    .nullable(),
  isActive: z.boolean(),
  isRecommended: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  affiliateType: z.enum(["none", "amount", "percent"]),
  affiliateValue: z.number().min(0).max(10_000_000),
  bullets: z.array(z.string().trim().min(1).max(200)).max(20),
  paymentMethods: z.array(z.enum(["paystack", "eft"])).default(["paystack"]),
  reason: z.string().optional(),
});

export type UpsertProductInput = z.infer<typeof upsertSchema>;

export const upsertProductAction = withAdminAudit<
  UpsertProductInput,
  { ok: true; id: string }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "products.upsert",
    targetType: "product",
    getTargetId: () => PRODUCT_TARGET,
  },
  async (args, service) => {
    const parsed = upsertSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid product.");
    }
    const d = parsed.data;
    const row = {
      name: d.name,
      description: d.description ?? null,
      type: d.type,
      price: d.price,
      currency: d.currency,
      billing_cycle:
        d.type === "subscription" ? (d.billingCycle ?? "monthly") : null,
      is_active: d.isActive,
      is_recommended: d.isRecommended,
      sort_order: d.sortOrder,
      affiliate_type: d.affiliateType,
      affiliate_value: d.affiliateValue,
      bullets: d.bullets as never,
      payment_methods: d.paymentMethods.length
        ? d.paymentMethods
        : ["paystack"],
      updated_at: new Date().toISOString(),
    };

    let id = d.id ?? "";
    if (d.id) {
      const { error } = await service
        .from("products")
        .update(row)
        .eq("id", d.id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await service
        .from("products")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = data.id;
    }

    revalidatePath("/admin/products");
    return { result: { ok: true, id }, after: { id } };
  },
);

const toggleSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
  reason: z.string().optional(),
});

export const toggleProductActiveAction = withAdminAudit<
  z.infer<typeof toggleSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "products.toggle",
    targetType: "product",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const parsed = toggleSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { error } = await service
      .from("products")
      .update({
        is_active: parsed.data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/products");
    return { result: { ok: true }, after: parsed.data };
  },
);

const deleteSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
});

export const deleteProductAction = withAdminAudit<
  z.infer<typeof deleteSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "products.delete",
    targetType: "product",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const parsed = deleteSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { error } = await service
      .from("products")
      .delete()
      .eq("id", parsed.data.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/products");
    return { result: { ok: true }, after: { id: parsed.data.id } };
  },
);

// Set a feature permission on a product.
const featureSchema = z.object({
  productId: z.string().uuid(),
  featureKey: z.string().min(1).max(80),
  isEnabled: z.boolean(),
  limitValue: z.number().int().min(0).nullable(),
  reason: z.string().optional(),
});

export const upsertProductFeatureAction = withAdminAudit<
  z.infer<typeof featureSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "products.feature.upsert",
    targetType: "product_feature",
    getTargetId: (a) => a.productId,
  },
  async (args, service) => {
    const parsed = featureSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { error } = await service.from("product_features").upsert(
      {
        product_id: parsed.data.productId,
        feature_key: parsed.data.featureKey,
        is_enabled: parsed.data.isEnabled,
        limit_value: parsed.data.limitValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,feature_key" },
    );
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/products/${parsed.data.productId}`);
    return { result: { ok: true }, after: parsed.data };
  },
);

// ─── Thin client wrappers ─────────────────────────────────────
type Res = { ok: true; id?: string } | { ok: false; error: string };
async function wrap(fn: () => Promise<unknown>): Promise<Res> {
  try {
    const r = (await fn()) as { id?: string } | undefined;
    return { ok: true, id: r?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function upsertProduct(input: UpsertProductInput) {
  return wrap(() => upsertProductAction(input));
}
export async function toggleProductActive(input: {
  id: string;
  isActive: boolean;
}) {
  return wrap(() => toggleProductActiveAction(input));
}
export async function deleteProduct(input: { id: string }) {
  return wrap(() => deleteProductAction(input));
}
export async function upsertProductFeature(input: {
  productId: string;
  featureKey: string;
  isEnabled: boolean;
  limitValue: number | null;
}) {
  return wrap(() => upsertProductFeatureAction(input));
}
