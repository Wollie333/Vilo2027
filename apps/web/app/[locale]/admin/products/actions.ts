"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import { createProductOrder } from "@/lib/billing/product-checkout";
import { PRODUCTS_CACHE_TAG } from "@/lib/products/getProducts";

const PRODUCT_TARGET = "00000000-0000-0000-0000-0000000900d5";

const upsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).optional().nullable(),
  // membership (Wielo sub) | service (subscription service) | product (once-off)
  // | wielo_credits (once-off credit package that tops up a host's credit wallet).
  // membership + service are "subscription-like" (billing cycle, plan tier).
  productType: z.enum(["membership", "service", "product", "wielo_credits"]),
  // Only for productType=wielo_credits: how many credits + which wallet purpose.
  creditQuantity: z
    .number()
    .int()
    .min(1)
    .max(1_000_000)
    .nullable()
    .default(null),
  creditPurpose: z.string().trim().min(1).max(40).default("quote"),
  // Only for membership/service: Wielo credits included each billing cycle.
  // Persisted as the `wielo_credits_per_month` permission (the SSOT the grant
  // engine reads) rather than products.credit_quantity, which now only covers
  // one-off credit packages. null = unlimited, 0 = none.
  creditsPerMonth: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .default(null),
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
  affiliateDuration: z.enum(["once", "months", "forever"]).default("once"),
  affiliateDurationMonths: z
    .number()
    .int()
    .min(1)
    .max(120)
    .nullable()
    .default(null),
  // Once-off setup fee bundled with a subscription.
  setupFee: z.number().min(0).max(10_000_000).default(0),
  setupFeeLabel: z.string().trim().max(120).optional().nullable(),
  setupFeeAffiliateType: z.enum(["none", "amount", "percent"]).default("none"),
  setupFeeAffiliateValue: z.number().min(0).max(10_000_000).default(0),
  bullets: z.array(z.string().trim().min(1).max(200)).max(20),
  paymentMethods: z
    .array(z.enum(["paystack", "paypal", "eft"]))
    .default(["paystack"]),
  trialDays: z.number().int().min(0).max(365).default(0),
  isVisible: z.boolean().default(true),
  // Hard cap on total units ever sold (null = unlimited).
  maxQuantity: z.number().int().min(0).max(10_000_000).nullable().default(null),
  reason: z.string().optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

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

    // Resolve a stable slug for the standalone page. Keep an existing product's
    // slug (don't break shared links); generate a unique one otherwise.
    let slug: string;
    if (d.id) {
      const { data: existing } = await service
        .from("products")
        .select("slug")
        .eq("id", d.id)
        .maybeSingle();
      slug = existing?.slug ?? (slugify(d.name) || "product");
    } else {
      slug = slugify(d.name) || "product";
    }
    const { data: clash } = await service
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (clash && clash.id !== d.id) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // `type` is a GENERATED column derived from product_type — write product_type.
    const isSubLike =
      d.productType === "membership" || d.productType === "service";
    const isCredits = d.productType === "wielo_credits";
    const row = {
      name: d.name,
      description: d.description ?? null,
      product_type: d.productType,
      price: d.price,
      currency: d.currency,
      billing_cycle: isSubLike ? (d.billingCycle ?? "monthly") : null,
      is_active: d.isActive,
      is_visible: d.isVisible,
      is_recommended: d.isRecommended,
      sort_order: d.sortOrder,
      trial_days: d.trialDays,
      affiliate_type: d.affiliateType,
      affiliate_value: d.affiliateValue,
      affiliate_duration: d.affiliateDuration,
      affiliate_duration_months:
        d.affiliateDuration === "months"
          ? (d.affiliateDurationMonths ?? 1)
          : null,
      setup_fee: isSubLike ? d.setupFee : 0,
      setup_fee_label: d.setupFeeLabel ?? null,
      setup_fee_affiliate_type: d.setupFeeAffiliateType,
      setup_fee_affiliate_value: d.setupFeeAffiliateValue,
      // credit_quantity now covers ONE-OFF credit packages only — the amount a
      // buyer's wallet is topped up by (grantCreditsForOrder). A subscription's
      // recurring allowance is the `wielo_credits_per_month` permission written
      // below, which is what grantSubscriptionCredits actually reads.
      credit_quantity: isCredits ? (d.creditQuantity ?? null) : null,
      credit_purpose: isCredits ? d.creditPurpose : null,
      bullets: d.bullets as never,
      slug,
      payment_methods: d.paymentMethods.length
        ? d.paymentMethods
        : ["paystack"],
      max_quantity: d.maxQuantity ?? null,
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

    // A subscription's monthly Wielo credits live in product_features, because
    // that's the SSOT grantSubscriptionCredits resolves through. Written here so
    // it can be set while CREATING the product — previously the only way in was
    // the permissions list, which needs a saved product, so a new membership
    // could not be given credits at all.
    if (isSubLike) {
      const qty = d.creditsPerMonth;
      if (qty == null || qty <= 0) {
        // 0 / blank = no allowance from this product; drop the row so the
        // plan-level default can answer instead of a hard 0 overriding it.
        await service
          .from("product_features")
          .delete()
          .eq("product_id", id)
          .eq("feature_key", "wielo_credits_per_month");
      } else {
        await service.from("product_features").upsert(
          {
            product_id: id,
            feature_key: "wielo_credits_per_month",
            is_enabled: true,
            limit_value: qty,
          },
          { onConflict: "product_id,feature_key" },
        );
      }
    }

    revalidatePath("/admin/products");
    revalidateTag(PRODUCTS_CACHE_TAG);
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
    revalidateTag(PRODUCTS_CACHE_TAG);
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

    // In-use guard: a product referenced by a subscription or an order must not
    // be hard-deleted (it would orphan those rows). Deactivate it instead.
    const [{ count: subs }, { count: orders }] = await Promise.all([
      service
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("product_id", parsed.data.id),
      service
        .from("product_orders")
        .select("id", { count: "exact", head: true })
        .eq("product_id", parsed.data.id),
    ]);
    if ((subs ?? 0) > 0 || (orders ?? 0) > 0) {
      throw new Error(
        `This product is in use (${subs ?? 0} subscription(s), ${orders ?? 0} order(s)). Deactivate it instead of deleting.`,
      );
    }

    const { error } = await service
      .from("products")
      .delete()
      .eq("id", parsed.data.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/products");
    revalidateTag(PRODUCTS_CACHE_TAG);
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

// Generate a tokenised pay-link for a user to buy a product.
const payLinkSchema = z.object({
  productId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  reason: z.string().optional(),
});

export const generateProductPayLinkAction = withAdminAudit<
  z.infer<typeof payLinkSchema>,
  { ok: true; url: string }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "products.paylink",
    targetType: "product",
    getTargetId: (a) => a.productId,
  },
  async (args, service) => {
    void service;
    const parsed = payLinkSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const admin = await requirePermission("subscriptions.edit");
    const r = await createProductOrder({
      productId: parsed.data.productId,
      email: parsed.data.email,
      createdBy: admin.userId,
    });
    if (!r.ok) throw new Error(r.error);
    return { result: { ok: true, url: r.url }, after: { url: r.url } };
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

export async function generateProductPayLink(input: {
  productId: string;
  email: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const r = await generateProductPayLinkAction(input);
    return { ok: true, url: r.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
