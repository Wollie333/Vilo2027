"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { normalizePromoCode } from "@/lib/billing/platform-coupons";

// Wielo promo codes — admin CRUD. These discount WIELO's own products; a host's
// booking coupons are a separate feature (dashboard/coupons) against a separate
// table. Every write is audited: a promo code is a money lever.

// promo_codes has no natural single target row, so audit entries pin to a stable
// synthetic id (mirrors PRODUCT_TARGET in admin/products/actions.ts).
const PROMO_TARGET = "00000000-0000-0000-0000-0000000c0de5";

const upsertSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    code: z
      .string()
      .trim()
      .min(3, "A code needs at least 3 characters.")
      .max(40)
      // Letters/numbers/dash/underscore only — a code with a space or a slash
      // can't survive being read down a phone or pasted from an email.
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _ only."),
    description: z.string().trim().max(200).optional().nullable(),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.number().positive("Enter a discount above 0."),
    // "" from a <select> means "no target" → normalised to null below.
    productId: z.string().uuid().nullable().default(null),
    productType: z
      .enum(["membership", "service", "product", "wielo_credits"])
      .nullable()
      .default(null),
    currency: z.string().trim().length(3).default("ZAR"),
    minSpend: z.number().min(0).nullable().default(null),
    startsAt: z.string().trim().nullable().default(null),
    endsAt: z.string().trim().nullable().default(null),
    maxRedemptions: z.number().int().positive().nullable().default(null),
    perUserLimit: z.number().int().positive().nullable().default(null),
    isActive: z.boolean().default(true),
    // Optional free-text note captured into the audit payload (withAdminAudit
    // reads args.reason) — every admin schema in this app carries it.
    reason: z.string().optional(),
  })
  // Mirror the DB CHECKs so the form fails with a readable message instead of a
  // raw constraint violation.
  .refine((d) => d.discountType !== "percent" || d.discountValue <= 100, {
    message: "A percentage discount can't exceed 100%.",
    path: ["discountValue"],
  })
  .refine((d) => !(d.productId && d.productType), {
    message: "Target one product OR one product type — not both.",
    path: ["productType"],
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.endsAt >= d.startsAt, {
    message: "The end date can't be before the start date.",
    path: ["endsAt"],
  });

export type UpsertPromoInput = z.infer<typeof upsertSchema>;

export const upsertPromoAction = withAdminAudit<
  UpsertPromoInput,
  { ok: true; id: string }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "promo_codes.upsert",
    targetType: "platform_coupon",
    getTargetId: () => PROMO_TARGET,
  },
  async (args, service) => {
    const parsed = upsertSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid promo code.");
    }
    const d = parsed.data;
    const code = normalizePromoCode(d.code);

    // Friendly duplicate check. The unique index on upper(code) is still the
    // real guard — this only turns a 23505 into a sentence.
    const { data: clash } = await service
      .from("platform_coupons")
      .select("id")
      .ilike("code", code)
      .maybeSingle();
    if (clash && clash.id !== d.id) {
      throw new Error(`The code ${code} already exists.`);
    }

    const row = {
      code,
      description: d.description || null,
      discount_type: d.discountType,
      discount_value: d.discountValue,
      product_id: d.productId || null,
      product_type: d.productId ? null : d.productType || null,
      currency: d.currency.toUpperCase(),
      min_spend: d.minSpend,
      starts_at: d.startsAt || null,
      ends_at: d.endsAt || null,
      max_redemptions: d.maxRedemptions,
      per_user_limit: d.perUserLimit,
      is_active: d.isActive,
    };

    let id = d.id ?? "";
    if (d.id) {
      const { error } = await service
        .from("platform_coupons")
        .update(row)
        .eq("id", d.id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await service
        .from("platform_coupons")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = data.id;
    }

    revalidatePath("/admin/promo-codes");
    return { result: { ok: true, id }, after: { id, ...row } };
  },
);

const toggleSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
  reason: z.string().optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
});

export const togglePromoActiveAction = withAdminAudit<
  z.infer<typeof toggleSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "promo_codes.toggle_active",
    targetType: "platform_coupon",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const d = toggleSchema.parse(args);
    const { error } = await service
      .from("platform_coupons")
      .update({ is_active: d.isActive })
      .eq("id", d.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/promo-codes");
    return { result: { ok: true }, after: { is_active: d.isActive } };
  },
);

export const deletePromoAction = withAdminAudit<
  z.infer<typeof deleteSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "promo_codes.delete",
    targetType: "platform_coupon",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const d = deleteSchema.parse(args);
    // A redeemed code is history — deleting it would cascade its redemptions
    // away and silently rewrite what a buyer was charged. Turn it off instead.
    const { count } = await service
      .from("platform_coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", d.id);
    if ((count ?? 0) > 0) {
      throw new Error(
        "This code has been redeemed — turn it off instead of deleting it.",
      );
    }
    const { error } = await service
      .from("platform_coupons")
      .delete()
      .eq("id", d.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/promo-codes");
    return { result: { ok: true }, after: null };
  },
);

// ─── Thin client wrappers ─────────────────────────────────────
// A client component can only call `export async function` — not a const built
// by withAdminAudit (see reference-admin-state docs).
type Res = { ok: true; id?: string } | { ok: false; error: string };
async function wrap(fn: () => Promise<unknown>): Promise<Res> {
  try {
    const r = (await fn()) as { id?: string } | undefined;
    return { ok: true, id: r?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function upsertPromo(input: UpsertPromoInput) {
  return wrap(() => upsertPromoAction(input));
}
export async function togglePromoActive(input: {
  id: string;
  isActive: boolean;
}) {
  return wrap(() => togglePromoActiveAction(input));
}
export async function deletePromo(input: { id: string }) {
  return wrap(() => deletePromoAction(input));
}
