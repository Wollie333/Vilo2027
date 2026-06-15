"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission, withAdminAudit } from "@/lib/admin";

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

// ─── Soft-delete (never hard-delete) ──────────────────────────
const deleteSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const softDeleteUserAction = withAdminAudit<
  z.infer<typeof deleteSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.delete",
    actionName: "user.soft_delete",
    targetType: "user",
    getTargetId: (a) => a.userId,
    requireReason: true,
  },
  async (args, service) => {
    if (!deleteSchema.safeParse(args).success)
      throw new Error("Invalid input.");
    const { error, data } = await service
      .from("user_profiles")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", args.userId)
      .select("id, deleted_at")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${args.userId}`);
    revalidatePath("/admin/users");
    return { result: { ok: true }, after: data };
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
  plan: z.string().min(1).max(60),
  billingCycle: z.enum(["monthly", "annual"]).nullable(),
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
    const now = new Date().toISOString();

    const { data: existing } = await service
      .from("subscriptions")
      .select("id")
      .eq("host_id", d.hostId)
      .maybeSingle();

    const patch = {
      plan: d.plan,
      billing_cycle: d.billingCycle,
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
      title: "Vilo support requested access",
      body: "Vilo support has asked to make changes to your account. Review and approve or decline.",
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

    const { data: product } = await service
      .from("products")
      .select("id, slug, type, billing_cycle")
      .eq("id", productId)
      .maybeSingle();
    if (!product) throw new Error("Product not found.");
    if (product.type !== "subscription") {
      throw new Error("Only subscription products can be set as a plan.");
    }

    // Map the product's slug to a plan key when one exists (drives gating);
    // otherwise keep the current plan so the FK stays valid.
    const { data: existing } = await service
      .from("subscriptions")
      .select("id, plan")
      .eq("host_id", hostId)
      .maybeSingle();

    let plan = existing?.plan ?? "free";
    if (product.slug) {
      const { data: planRow } = await service
        .from("plans")
        .select("key")
        .eq("key", product.slug)
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

export async function adminUpdateSubscription(input: {
  hostId: string;
  plan: string;
  billingCycle: "monthly" | "annual" | null;
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
