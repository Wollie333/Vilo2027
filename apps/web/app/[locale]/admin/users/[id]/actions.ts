"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import { assertActiveSupportGrant } from "@/lib/admin/supportGrant";
import { findFreeSlug, getAffiliateForUser } from "@/lib/affiliate/account";
import { createServerClient } from "@/lib/supabase/server";
import { DISPLAY_CURRENCIES } from "@/lib/currency";
import { BUSINESS_LOCALES } from "@/app/[locale]/dashboard/settings/businesses/schemas";
import { addonInputSchema } from "@/app/[locale]/dashboard/addons/schemas";

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

// ─── Admin-initiated password reset ───────────────────────────
// Sends the user the standard Supabase recovery email (same mechanism as the
// public forgot-password flow). The admin never sees the link. Audited.
const resetPwSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().optional(),
});

export const sendPasswordResetAction = withAdminAudit<
  z.infer<typeof resetPwSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.password_reset",
    targetType: "user",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    const { data: prof } = await service
      .from("user_profiles")
      .select("email")
      .eq("id", args.userId)
      .single();
    const email = prof?.email;
    if (!email) throw new Error("This user has no email on file.");
    const origin = headers().get("origin") ?? "";
    const supabase = createServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/reset-password`,
    });
    if (error) throw new Error(error.message);
    return { result: { ok: true }, after: { email } };
  },
);

export async function sendPasswordReset(input: { userId: string }) {
  const parsed = resetPwSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input." };
  try {
    await sendPasswordResetAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

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

// ─── Delete user ──────────────────────────────────────────────
// Admin-initiated account deletion must actually remove the user — not just
// soft-delete the profile. A soft delete leaves the auth.users row in place,
// so the email still reads as "already registered" and the person can never
// sign up again. We mirror the GDPR/self-service flow: purge historical rows,
// then hard-delete the auth user (cascades the profile + every CASCADE child).
// If RESTRICT FKs (bookings / invoices / audit) block the cascade, fall back to
// anonymisation, which still frees the email and de-identifies the account.
const deleteSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const softDeleteUserAction = withAdminAudit<
  z.infer<typeof deleteSchema>,
  { ok: true; method: "hard_deleted" | "anonymized" }
>(
  {
    permissionKey: "users.delete",
    actionName: "user.delete",
    targetType: "user",
    getTargetId: (a) => a.userId,
    requireReason: true,
  },
  async (args, service) => {
    if (!deleteSchema.safeParse(args).success)
      throw new Error("Invalid input.");

    // Block deleting a super_admin (would risk locking the platform out).
    const { data: target } = await service
      .from("user_profiles")
      .select("role")
      .eq("id", args.userId)
      .maybeSingle();
    if ((target?.role as string | undefined) === "super_admin") {
      throw new Error(
        "Super admin accounts can't be deleted here — change the role first.",
      );
    }

    // Clear historical / RESTRICT-FK rows first so the auth.users →
    // user_profiles cascade isn't blocked (pre-MVP policy — see migration
    // 20260531000021). Non-fatal: if it fails, the delete below falls back.
    await service.rpc("app_purge_user_account", { p_user_id: args.userId });

    // Hard-delete the auth user → frees the email for re-signup and cascades
    // the profile, notifications, push tokens, etc.
    const { error: delErr } = await service.auth.admin.deleteUser(args.userId);
    if (!delErr) {
      revalidatePath(`/admin/users/${args.userId}`);
      revalidatePath("/admin/users");
      return {
        result: { ok: true, method: "hard_deleted" },
        after: { user_id: args.userId, method: "hard_deleted" },
      };
    }

    // RESTRICT FKs still reference the account — anonymise instead. This still
    // releases the real email and de-identifies the profile + auth identity.
    const anonEmail = `deleted+${args.userId}@deleted.invalid`;
    await service
      .from("user_profiles")
      .update({
        full_name: "Deleted user",
        email: anonEmail,
        phone: null,
        avatar_url: null,
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", args.userId);
    await service.auth.admin.updateUserById(args.userId, {
      email: anonEmail,
      user_metadata: {},
    });

    revalidatePath(`/admin/users/${args.userId}`);
    revalidatePath("/admin/users");
    return {
      result: { ok: true, method: "anonymized" },
      after: { user_id: args.userId, method: "anonymized" },
    };
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

// ─── Manually set a host's subscription (plan / cycle / status) ───────
const subSchema = z.object({
  hostId: z.string().uuid(),
  // Product-first: when a product is chosen we derive plan + cycle from it. plan/
  // billingCycle remain for the legacy path (no product selected).
  productId: z.string().uuid().nullable().optional(),
  plan: z.string().min(1).max(60).optional(),
  billingCycle: z.enum(["monthly", "annual"]).nullable().optional(),
  status: z.enum([
    "trialing",
    "active",
    "past_due",
    "restricted",
    "paused",
    "cancelled",
    "expired",
  ]),
  reason: z.string().optional(),
});

export const adminUpdateSubscriptionAction = withAdminAudit<
  z.infer<typeof subSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "user.update_subscription",
    targetType: "subscription",
    getTargetId: (a) => a.hostId,
  },
  async (args, service) => {
    const parsed = subSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid subscription input.");
    const d = parsed.data;
    // Financial write — requires the host's active support-access grant.
    await assertActiveSupportGrant(service, d.hostId);
    const now = new Date().toISOString();

    const { data: existing } = await service
      .from("subscriptions")
      .select("id, plan, product_id")
      .eq("host_id", d.hostId)
      .maybeSingle();

    // Product-first: when a real product is chosen, link it + derive the plan
    // (feature tier) and billing cycle FROM the product — the single source of
    // truth — so gating (check_feature_permission) resolves correctly. Falls
    // back to the legacy plan/cycle when no product is selected.
    const productId: string | null | undefined = d.productId;
    let plan = d.plan ?? existing?.plan ?? "free";
    let billingCycle: "monthly" | "annual" | null = d.billingCycle ?? null;

    if (d.productId) {
      const { data: product } = await service
        .from("products")
        .select("id, slug, type, billing_cycle, plan_key")
        .eq("id", d.productId)
        .maybeSingle();
      if (!product) throw new Error("Product not found.");
      if (product.type !== "subscription") {
        throw new Error("Only subscription products can be set as a plan.");
      }
      const desiredKey = product.plan_key ?? product.slug;
      if (desiredKey) {
        const { data: planRow } = await service
          .from("plans")
          .select("key")
          .eq("key", desiredKey)
          .maybeSingle();
        if (planRow) plan = planRow.key;
      }
      billingCycle = product.billing_cycle === "annual" ? "annual" : "monthly";
    }

    const patch = {
      // Only touch product_id when the caller sent one (undefined = leave as-is).
      ...(productId !== undefined ? { product_id: productId } : {}),
      plan,
      billing_cycle: billingCycle,
      status: d.status,
      updated_at: now,
    };

    const { error } = existing
      ? await service.from("subscriptions").update(patch).eq("id", existing.id)
      : await service
          .from("subscriptions")
          .insert({ host_id: d.hostId, ...patch });
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/users`);
    return { result: { ok: true }, after: { hostId: d.hostId, ...patch } };
  },
);

// ─── Request host support access (to edit their financials) ───────────
const supportSchema = z.object({
  hostId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const requestSupportAccessAction = withAdminAudit<
  z.infer<typeof supportSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.request_support_access",
    targetType: "user",
    getTargetId: (a) => a.hostId,
    requireReason: true,
  },
  async (args, service) => {
    if (!supportSchema.safeParse(args).success) {
      throw new Error("Invalid input.");
    }
    const admin = await requirePermission("users.edit");

    const { data: host } = await service
      .from("hosts")
      .select("id, user_id, display_name")
      .eq("id", args.hostId)
      .maybeSingle();
    if (!host?.user_id) throw new Error("Host not found.");

    const { data: grant, error } = await service
      .from("admin_support_grants")
      .insert({
        host_id: host.id,
        host_user_id: host.user_id,
        requested_by: admin.userId,
        reason: args.reason,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Notify the host so they can approve/decline in their dashboard.
    await service.from("in_app_notifications").insert({
      user_id: host.user_id,
      kind: "support_access_request",
      title: "Wielo support requested access",
      body: "Wielo support has asked to make changes to your account. Review and approve or decline.",
      link: "/dashboard/support-access",
      payload: { grant_id: grant.id },
    });

    return { result: { ok: true }, after: grant };
  },
);

// ─── Activate a catalog product on a user's subscription ──────────────
const setProductSchema = z.object({
  hostId: z.string().uuid(),
  productId: z.string().uuid(),
  reason: z.string().optional(),
});

function addMonthsIso(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}

export const setUserProductAction = withAdminAudit<
  z.infer<typeof setProductSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "user.set_product",
    targetType: "subscription",
    getTargetId: (a) => a.hostId,
  },
  async (args, service) => {
    const parsed = setProductSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { hostId, productId } = parsed.data;
    // Financial write — requires the host's active support-access grant.
    await assertActiveSupportGrant(service, hostId);

    const { data: product } = await service
      .from("products")
      .select("id, slug, type, billing_cycle, plan_key")
      .eq("id", productId)
      .maybeSingle();
    if (!product) throw new Error("Product not found.");
    if (product.type !== "subscription") {
      throw new Error("Only subscription products can be set as a plan.");
    }

    // Map the product to a plan key (drives gating): prefer its explicit
    // plan_key, else its slug when that's a plan key; otherwise keep the current
    // plan so the FK stays valid.
    const { data: existing } = await service
      .from("subscriptions")
      .select("id, plan")
      .eq("host_id", hostId)
      .maybeSingle();

    let plan = existing?.plan ?? "free";
    const desiredKey = product.plan_key ?? product.slug;
    if (desiredKey) {
      const { data: planRow } = await service
        .from("plans")
        .select("key")
        .eq("key", desiredKey)
        .maybeSingle();
      if (planRow) plan = planRow.key;
    }

    const cycle = product.billing_cycle === "annual" ? "annual" : "monthly";
    const now = new Date().toISOString();
    const patch = {
      product_id: product.id,
      plan,
      billing_cycle: cycle,
      status: "active" as const,
      current_period_start: now,
      current_period_end: addMonthsIso(cycle === "annual" ? 12 : 1),
      updated_at: now,
    };

    const { error } = existing
      ? await service.from("subscriptions").update(patch).eq("id", existing.id)
      : await service
          .from("subscriptions")
          .insert({ host_id: hostId, ...patch });
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/users`);
    return { result: { ok: true }, after: { hostId, ...patch } };
  },
);

// ─── Edit a host's business (legal entity on their documents) ─────────
const opt = z.string().trim().max(200).optional().or(z.literal(""));
const businessSchema = z.object({
  businessId: z.string().uuid(),
  trading_name: z.string().trim().min(1, "Give the business a name.").max(160),
  legal_name: z.string().trim().max(160).optional().or(z.literal("")),
  vat_number: z.string().trim().max(20).optional().or(z.literal("")),
  company_registration_number: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("")),
  address_line1: opt,
  address_line2: opt,
  city: z.string().trim().max(120).optional().or(z.literal("")),
  municipality: z.string().trim().max(160).optional().or(z.literal("")),
  province: z.string().trim().max(120).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().length(2, "Use a 2-letter country code, e.g. ZA."),
  default_currency: z.enum(DISPLAY_CURRENCIES),
  default_language: z.enum(BUSINESS_LOCALES),
  reason: z.string().optional(),
});

const nn = (v: string | undefined) => (v && v.length > 0 ? v : null);

export const adminUpdateBusinessAction = withAdminAudit<
  z.infer<typeof businessSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.update_business",
    targetType: "business",
    getTargetId: (a) => a.businessId,
  },
  async (args, service) => {
    const parsed = businessSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues[0]?.message ?? "Invalid business details.",
      );
    }
    const d = parsed.data;
    // Financial/legal write — requires the host's active support-access grant.
    // Resolve the business's host to check the grant.
    const { data: biz } = await service
      .from("businesses")
      .select("host_id")
      .eq("id", d.businessId)
      .maybeSingle();
    if (!biz?.host_id) throw new Error("Business not found.");
    await assertActiveSupportGrant(service, biz.host_id);
    // lat/lng are left untouched — there's no map picker in the admin modal, so
    // we never want to wipe a host's geocoded coordinates.
    const { error, data } = await service
      .from("businesses")
      .update({
        trading_name: d.trading_name.trim(),
        legal_name: nn(d.legal_name),
        vat_number: nn(d.vat_number),
        company_registration_number: nn(d.company_registration_number),
        address_line1: nn(d.address_line1),
        address_line2: nn(d.address_line2),
        city: nn(d.city),
        municipality: nn(d.municipality),
        province: nn(d.province),
        postal_code: nn(d.postal_code),
        country: d.country.toUpperCase(),
        default_currency: d.default_currency,
        default_language: d.default_language,
      })
      .eq("id", d.businessId)
      .select("id, trading_name")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users`);
    return { result: { ok: true }, after: data };
  },
);

// ─── Pay an affiliate out immediately (admin) ────────────────────────
// Reuses the canonical money RPCs: create_affiliate_payout claims cleared
// commission + applies the per-method fee/threshold, then settle_affiliate_payout
// marks it paid. Never forks the payout maths (single source of truth).
const PAYOUT_ERRORS: Record<string, string> = {
  not_found: "This user has no affiliate account.",
  suspended: "The affiliate account is suspended.",
  bad_method: "Choose a valid payout method.",
  no_method: "Add payout details for this method first.",
  nothing_to_pay: "There is no cleared commission to pay out yet.",
  below_threshold: "The cleared balance is below the payout threshold.",
};

const payoutSchema = z.object({
  affiliateId: z.string().uuid(),
  method: z.enum(["eft", "paystack"]),
  reference: z.string().trim().max(120).optional(),
  reason: z.string().optional(),
});

export const adminPayoutAffiliateAction = withAdminAudit<
  z.infer<typeof payoutSchema>,
  { ok: true; net: number }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "affiliate.admin_payout",
    targetType: "affiliate",
    getTargetId: (a) => a.affiliateId,
  },
  async (args, service) => {
    const parsed = payoutSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid payout request.");
    const { affiliateId, method, reference } = parsed.data;
    const admin = await requirePermission("subscriptions.edit");

    const { data: created, error: cErr } = await service.rpc(
      "create_affiliate_payout",
      { p_affiliate_id: affiliateId, p_method: method },
    );
    if (cErr) throw new Error(cErr.message);
    const c = created as {
      ok: boolean;
      error?: string;
      payout_id?: string;
      net?: number;
    };
    if (!c?.ok || !c.payout_id) {
      throw new Error(
        PAYOUT_ERRORS[c?.error ?? ""] ?? "Could not create the payout.",
      );
    }

    const { data: settled, error: sErr } = await service.rpc(
      "settle_affiliate_payout",
      {
        p_payout_id: c.payout_id,
        p_action: "paid",
        p_admin: admin.userId,
        p_reference: reference ?? null,
        p_reason: null,
      },
    );
    if (sErr) throw new Error(sErr.message);
    const s = settled as { ok: boolean; error?: string };
    if (!s?.ok) {
      throw new Error(
        s?.error ?? "Created the payout but couldn't mark it paid.",
      );
    }

    revalidatePath(`/admin/users`);
    revalidatePath("/admin/affiliates");
    return {
      result: { ok: true, net: c.net ?? 0 },
      after: { payoutId: c.payout_id, method, reference: reference ?? null },
    };
  },
);

// ─── Add-ons catalog (host-wide; managed from the admin "Add-ons & policies" tab) ──
function addonRow(input: z.infer<typeof addonInputSchema>) {
  return {
    name: input.name,
    description: input.description ?? null,
    pricing_model: input.pricing_model,
    unit_price: input.unit_price,
    currency: input.currency,
    min_quantity: input.min_quantity,
    max_quantity: input.max_quantity ?? null,
    allow_custom_quantity: input.allow_custom_quantity,
    stock_quantity: input.stock_quantity ?? null,
    is_required: input.is_required,
    is_active: input.is_active,
    lead_time_days: input.lead_time_days,
    category: input.category ?? null,
    vat_included: input.vat_included,
    daily_capacity: input.daily_capacity ?? null,
  };
}

const createAddonSchema = z.object({
  hostId: z.string().uuid(),
  addon: addonInputSchema,
  reason: z.string().optional(),
});

export const adminCreateAddonAction = withAdminAudit<
  z.infer<typeof createAddonSchema>,
  { ok: true; id: string }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.create_addon",
    targetType: "addon",
    getTargetId: (a) => a.hostId,
  },
  async (args, service) => {
    const parsed = createAddonSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid add-on.");
    }
    const { hostId, addon } = parsed.data;
    const { data: last } = await service
      .from("addons")
      .select("sort_order")
      .eq("host_id", hostId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await service
      .from("addons")
      .insert({
        host_id: hostId,
        sort_order: (last?.sort_order ?? -1) + 1,
        ...addonRow(addon),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${hostId}`);
    return { result: { ok: true, id: data.id }, after: data };
  },
);

const updateAddonSchema = z.object({
  hostId: z.string().uuid(),
  addonId: z.string().uuid(),
  addon: addonInputSchema,
  reason: z.string().optional(),
});

export const adminUpdateAddonAction = withAdminAudit<
  z.infer<typeof updateAddonSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.update_addon",
    targetType: "addon",
    getTargetId: (a) => a.addonId,
  },
  async (args, service) => {
    const parsed = updateAddonSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid add-on.");
    }
    const { hostId, addonId, addon } = parsed.data;
    const { data, error } = await service
      .from("addons")
      .update(addonRow(addon))
      .eq("id", addonId)
      .eq("host_id", hostId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${hostId}`);
    return { result: { ok: true }, after: data };
  },
);

const toggleAddonSchema = z.object({
  hostId: z.string().uuid(),
  addonId: z.string().uuid(),
  isActive: z.boolean(),
  reason: z.string().optional(),
});

export const adminToggleAddonAction = withAdminAudit<
  z.infer<typeof toggleAddonSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.toggle_addon",
    targetType: "addon",
    getTargetId: (a) => a.addonId,
  },
  async (args, service) => {
    if (!toggleAddonSchema.safeParse(args).success) {
      throw new Error("Invalid input.");
    }
    const { error } = await service
      .from("addons")
      .update({ is_active: args.isActive })
      .eq("id", args.addonId)
      .eq("host_id", args.hostId);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${args.hostId}`);
    return { result: { ok: true }, after: { isActive: args.isActive } };
  },
);

const deleteAddonSchema = z.object({
  hostId: z.string().uuid(),
  addonId: z.string().uuid(),
  reason: z.string().optional(),
});

export const adminDeleteAddonAction = withAdminAudit<
  z.infer<typeof deleteAddonSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.delete_addon",
    targetType: "addon",
    getTargetId: (a) => a.addonId,
  },
  async (args, service) => {
    if (!deleteAddonSchema.safeParse(args).success) {
      throw new Error("Invalid input.");
    }
    // Detach from any listings first (FK), then remove the catalog row.
    await service.from("property_addons").delete().eq("addon_id", args.addonId);
    const { error } = await service
      .from("addons")
      .delete()
      .eq("id", args.addonId)
      .eq("host_id", args.hostId);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${args.hostId}`);
    return { result: { ok: true }, after: { deleted: args.addonId } };
  },
);

// ─── Policies library (host-wide; create/edit happens in the listing editor) ──
// Host-level controls: set default, activate/draft, delete-or-archive. Mirrors
// the host self-service logic but service-role + by hostId + audited.
const policyToggleSchema = z.object({
  hostId: z.string().uuid(),
  policyId: z.string().uuid(),
  active: z.boolean(),
  reason: z.string().optional(),
});

export const adminTogglePolicyStatusAction = withAdminAudit<
  z.infer<typeof policyToggleSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.toggle_policy",
    targetType: "policy",
    getTargetId: (a) => a.policyId,
  },
  async (args, service) => {
    if (!policyToggleSchema.safeParse(args).success) {
      throw new Error("Invalid input.");
    }
    const update: { status: string; is_default?: boolean } = {
      status: args.active ? "active" : "draft",
    };
    if (!args.active) update.is_default = false; // a draft can't be default
    const { error } = await service
      .from("policies")
      .update(update)
      .eq("id", args.policyId)
      .eq("host_id", args.hostId);
    if (error) throw new Error(error.message);
    // Activating may be the first active policy of its type — backfill a default.
    if (args.active) {
      await service.rpc("ensure_host_default_policies", {
        p_host_id: args.hostId,
      });
    }
    revalidatePath(`/admin/users/${args.hostId}`);
    return { result: { ok: true }, after: { active: args.active } };
  },
);

const policyOpSchema = z.object({
  hostId: z.string().uuid(),
  policyId: z.string().uuid(),
  reason: z.string().optional(),
});

export const adminSetDefaultPolicyAction = withAdminAudit<
  z.infer<typeof policyOpSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.set_default_policy",
    targetType: "policy",
    getTargetId: (a) => a.policyId,
  },
  async (args, service) => {
    if (!policyOpSchema.safeParse(args).success) {
      throw new Error("Invalid input.");
    }
    const { data: policy } = await service
      .from("policies")
      .select("type")
      .eq("id", args.policyId)
      .eq("host_id", args.hostId)
      .maybeSingle();
    if (!policy) throw new Error("Policy not found.");
    // Clear the current default of this type first (partial unique index).
    await service
      .from("policies")
      .update({ is_default: false })
      .eq("host_id", args.hostId)
      .eq("type", policy.type)
      .eq("is_default", true);
    const { error } = await service
      .from("policies")
      .update({ is_default: true, status: "active" })
      .eq("id", args.policyId)
      .eq("host_id", args.hostId);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${args.hostId}`);
    return { result: { ok: true }, after: { default: args.policyId } };
  },
);

export const adminDeletePolicyAction = withAdminAudit<
  z.infer<typeof policyOpSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.edit",
    actionName: "user.delete_policy",
    targetType: "policy",
    getTargetId: (a) => a.policyId,
  },
  async (args, service) => {
    // property_policies / policy_snapshots are ON DELETE RESTRICT — a referenced
    // policy is archived (soft) rather than hard-deleted.
    const [{ count: assigned }, { count: snapshots }] = await Promise.all([
      service
        .from("property_policies")
        .select("id", { count: "exact", head: true })
        .eq("policy_id", args.policyId),
      service
        .from("policy_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("policy_id", args.policyId),
    ]);
    if ((assigned ?? 0) > 0 || (snapshots ?? 0) > 0) {
      const { error } = await service
        .from("policies")
        .update({ status: "archived", deleted_at: new Date().toISOString() })
        .eq("id", args.policyId)
        .eq("host_id", args.hostId);
      if (error) throw new Error(error.message);
      await service.rpc("ensure_host_default_policies", {
        p_host_id: args.hostId,
      });
      revalidatePath(`/admin/users/${args.hostId}`);
      return { result: { ok: true }, after: { archived: args.policyId } };
    }
    const { error } = await service
      .from("policies")
      .delete()
      .eq("id", args.policyId)
      .eq("host_id", args.hostId);
    if (error) throw new Error(error.message);
    await service.rpc("ensure_host_default_policies", {
      p_host_id: args.hostId,
    });
    revalidatePath(`/admin/users/${args.hostId}`);
    return { result: { ok: true }, after: { deleted: args.policyId } };
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

export async function updateUserProfile(input: {
  userId: string;
  fullName?: string | null;
  phone?: string | null;
}) {
  return wrap(() => updateUserProfileAction(input));
}

export async function changeUserRole(input: {
  userId: string;
  role: "guest" | "host" | "staff" | "super_admin";
  reason: string;
}) {
  return wrap(() => changeUserRoleAction(input));
}

export async function softDeleteUser(input: {
  userId: string;
  reason: string;
}) {
  return wrap(() => softDeleteUserAction(input));
}

export async function addAdminUserNote(input: {
  userId: string;
  body: string;
}) {
  return wrap(() => addAdminUserNoteAction(input));
}

export async function requestSupportAccess(input: {
  hostId: string;
  reason: string;
}) {
  return wrap(() => requestSupportAccessAction(input));
}

export async function setUserProduct(input: {
  hostId: string;
  productId: string;
}) {
  return wrap(() => setUserProductAction(input));
}

export async function adminUpdateBusiness(input: {
  businessId: string;
  trading_name: string;
  legal_name: string;
  vat_number: string;
  company_registration_number: string;
  address_line1: string;
  address_line2: string;
  city: string;
  municipality: string;
  province: string;
  postal_code: string;
  country: string;
  default_currency: string;
  default_language: string;
}) {
  // The action re-validates with Zod; cast past the enum-narrowed param type.
  return wrap(() =>
    adminUpdateBusinessAction(
      input as Parameters<typeof adminUpdateBusinessAction>[0],
    ),
  );
}

export async function adminPayoutAffiliate(input: {
  affiliateId: string;
  method: "eft" | "paystack";
  reference?: string;
}): Promise<{ ok: true; net: number } | { ok: false; error: string }> {
  try {
    const r = await adminPayoutAffiliateAction(input);
    return { ok: true, net: r.net };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// ─── Enable a user as an affiliate (admin) ───────────────────────────
// Creates the affiliate_accounts row for a user who isn't one yet, mirroring the
// portal self-enrol (unique slug, active, current terms/currency). Idempotent.
const enableAffiliateSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().optional(),
});

export const enableAffiliateAction = withAdminAudit<
  z.infer<typeof enableAffiliateSchema>,
  { ok: true; slug: string }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "affiliate.admin_enable",
    targetType: "user",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    const parsed = enableAffiliateSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid request.");
    const { userId } = parsed.data;

    const existing = await getAffiliateForUser(service, userId);
    if (existing) {
      return {
        result: { ok: true, slug: existing.slug },
        after: { slug: existing.slug, existed: true },
      };
    }

    const [{ data: settings }, { data: profile }] = await Promise.all([
      service
        .from("affiliate_settings")
        .select("terms_version, currency")
        .eq("id", true)
        .maybeSingle(),
      service
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    const base =
      profile?.full_name || profile?.email?.split("@")[0] || "affiliate";
    const slug = await findFreeSlug(service, base);

    const { error } = await service.from("affiliate_accounts").insert({
      user_id: userId,
      slug,
      status: "active",
      terms_version: settings?.terms_version ?? "v1",
      currency: settings?.currency ?? "ZAR",
    });
    if (error) {
      const created = await getAffiliateForUser(service, userId);
      if (created) {
        return {
          result: { ok: true, slug: created.slug },
          after: { slug: created.slug, existed: true },
        };
      }
      throw new Error("Could not create the affiliate account.");
    }

    revalidatePath(`/admin/users/${userId}`);
    return { result: { ok: true, slug }, after: { slug } };
  },
);

export async function enableAffiliate(
  userId: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  try {
    const r = await enableAffiliateAction({ userId });
    return { ok: true, slug: r.slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

type AdminAddonInput = z.infer<typeof addonInputSchema>;

export async function adminCreateAddon(
  hostId: string,
  addon: AdminAddonInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const r = await adminCreateAddonAction({ hostId, addon });
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function adminUpdateAddon(
  hostId: string,
  addonId: string,
  addon: AdminAddonInput,
) {
  return wrap(() => adminUpdateAddonAction({ hostId, addonId, addon }));
}

export async function adminToggleAddon(
  hostId: string,
  addonId: string,
  isActive: boolean,
) {
  return wrap(() => adminToggleAddonAction({ hostId, addonId, isActive }));
}

export async function adminDeleteAddon(hostId: string, addonId: string) {
  return wrap(() => adminDeleteAddonAction({ hostId, addonId }));
}

export async function adminTogglePolicyStatus(
  hostId: string,
  policyId: string,
  active: boolean,
) {
  return wrap(() =>
    adminTogglePolicyStatusAction({ hostId, policyId, active }),
  );
}

export async function adminSetDefaultPolicy(hostId: string, policyId: string) {
  return wrap(() => adminSetDefaultPolicyAction({ hostId, policyId }));
}

export async function adminDeletePolicy(hostId: string, policyId: string) {
  return wrap(() => adminDeletePolicyAction({ hostId, policyId }));
}

export async function adminUpdateSubscription(input: {
  hostId: string;
  productId?: string | null;
  plan?: string;
  billingCycle?: "monthly" | "annual" | null;
  status:
    | "trialing"
    | "active"
    | "past_due"
    | "restricted"
    | "paused"
    | "cancelled"
    | "expired";
}) {
  return wrap(() => adminUpdateSubscriptionAction(input));
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
