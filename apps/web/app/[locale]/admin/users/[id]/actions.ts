"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import { assertActiveSupportGrant } from "@/lib/admin/supportGrant";
import { findFreeSlug, getAffiliateForUser } from "@/lib/affiliate/account";
import { accrueAffiliateAndNotify } from "@/lib/affiliate/notify";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { daysRemaining, proratedAmount, round2 } from "@/lib/billing/proration";
import { createProductOrder } from "@/lib/billing/product-checkout";
import { grantSubscriptionCredits } from "@/lib/credits/wallet";
import {
  adminPostUpgradeCardToHostThread,
  adminPostPaymentLinkToHostThread,
  adminPostToHostThread,
} from "@/lib/inbox/platform-thread";
import { ensureHostForUser } from "@/lib/hosts/ensureHost";
import {
  DELETED_ACCOUNT_HOLD_DAYS,
  hardPurgeUserAccount,
  isPurgeEligible,
  restoreUserAccount,
  softDeleteUserAccount,
} from "@/lib/users/accountLifecycle";
import { routing } from "@/i18n/routing";
import {
  signStatementToken,
  type StatementToken,
} from "@/lib/finance/statement-token";
import { sendTransactionalEmail } from "@/lib/email/send";
import { DISPLAY_CURRENCIES } from "@/lib/currency";
import { BUSINESS_LOCALES } from "@/app/[locale]/dashboard/settings/businesses/schemas";
import { addonInputSchema } from "@/app/[locale]/dashboard/addons/schemas";

type AdminService = ReturnType<typeof createAdminClient>;

// ─── Owner resolvers for the audit trail ─────────────────────────────
// Host-scoped admin actions (add-ons, policies, subscription, business,
// affiliate) audit against a hostId/businessId/affiliateId — not the user row.
// These resolve the owning user_profiles.id so withAdminAudit can stamp
// payload.owner_user_id, making the action visible in that user's History tab.
async function ownerUserIdForHost(
  service: AdminService,
  hostId: string | null | undefined,
): Promise<string | null> {
  if (!hostId) return null;
  const { data } = await service
    .from("hosts")
    .select("user_id")
    .eq("id", hostId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function ownerUserIdForBusiness(
  service: AdminService,
  businessId: string | null | undefined,
): Promise<string | null> {
  if (!businessId) return null;
  const { data } = await service
    .from("businesses")
    .select("host_id")
    .eq("id", businessId)
    .maybeSingle();
  return ownerUserIdForHost(service, data?.host_id as string | undefined);
}

async function ownerUserIdForAffiliate(
  service: AdminService,
  affiliateId: string | null | undefined,
): Promise<string | null> {
  if (!affiliateId) return null;
  const { data } = await service
    .from("affiliate_accounts")
    .select("user_id")
    .eq("id", affiliateId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

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

// ─── Create a brand-new user (admin-driven) ───────────────────
// The admin adds a user to Wielo: provision the auth user (service role, no
// password — a magic sign-in link is returned instead so the founder can log in
// as them / share it), then shape the profile + host substrate for the chosen
// account type. `guest` = plain profile; `host` = full host substrate;
// `quote_only` = host substrate flagged account_kind='quote_only' (the scoped
// quotes-only shell). Landing on the new user's record lets the existing
// subscription/product controls assign a plan. Audited (users.role).
//
// account_type → role / substrate:
//   guest      → role stays 'guest', no host row
//   host       → ensureHostForUser (role → 'host'), account_kind 'host'
//   quote_only → ensureHostForUser + hosts.account_kind = 'quote_only'
const createUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
  fullName: z.string().trim().max(120).optional().nullable(),
  accountType: z.enum(["guest", "host", "quote_only"]),
  reason: z.string().max(500).optional(),
});

export const createUserAction = withAdminAudit<
  z.infer<typeof createUserSchema>,
  { ok: true; userId: string; loginUrl?: string }
>(
  {
    permissionKey: "users.role",
    actionName: "user.create",
    targetType: "user",
    // The new user id isn't known from args — the handler stashes it back onto
    // args (same object reference) so the audit row can reference it; falls back
    // to the email otherwise (kept in payload.args either way).
    getTargetId: (a) => (a as { userId?: string }).userId ?? a.email,
  },
  async (args, service) => {
    const parsed = createUserSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const d = parsed.data;
    const email = d.email.toLowerCase();
    const fullName = d.fullName?.trim() || null;

    // Refuse an email that already has an account (incl. soft-deleted, so we
    // don't collide with the 30-day hold). Clear message rather than a raw
    // GoTrue "already registered" error.
    const { data: dupe } = await service
      .from("user_profiles")
      .select("id, deleted_at")
      .eq("email", email)
      .maybeSingle();
    if (dupe) {
      throw new Error(
        dupe.deleted_at
          ? "A deleted account already uses this email — restore or purge it first."
          : "A user with this email already exists.",
      );
    }

    // Provision the auth user — confirmed (so a magic link signs them straight
    // in), NO password (prohibited to set one for a user; they set their own via
    // the returned link / the record's "Send password reset").
    const { data: created, error: createErr } =
      await service.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : {},
      });
    if (createErr || !created?.user) {
      const msg = createErr?.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered")) {
        throw new Error("A user with this email already exists.");
      }
      throw new Error(createErr?.message ?? "Could not create the user.");
    }
    const userId = created.user.id;
    // Stash for the audit target (see getTargetId).
    (args as { userId?: string }).userId = userId;

    // The auth trigger seeds a user_profiles row — set the name here. Role is set
    // by ensureHostForUser for host/quote_only; a guest keeps the default role.
    await service
      .from("user_profiles")
      .update({ full_name: fullName })
      .eq("id", userId);

    if (d.accountType === "host" || d.accountType === "quote_only") {
      const hostId = await ensureHostForUser(service, userId);
      if (d.accountType === "quote_only") {
        await service
          .from("hosts")
          .update({
            account_kind: "quote_only",
            updated_at: new Date().toISOString(),
          })
          .eq("id", hostId);
      }
    }

    // A shareable magic sign-in link (no password) so the admin can test/hand it
    // over. Best-effort — the account exists regardless; the record's password
    // reset is the fallback. Uses the request origin so a dev link resolves here.
    let loginUrl: string | undefined;
    const origin = headers().get("origin") ?? "";
    if (origin) {
      const { data: link } = await service.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${origin}/auth/confirm?next=/dashboard` },
      });
      const hashed = link?.properties?.hashed_token;
      if (hashed) {
        loginUrl = `${origin}/auth/confirm?token_hash=${hashed}&type=magiclink&next=/dashboard`;
      }
    }

    revalidatePath("/admin/users");
    return {
      result: { ok: true, userId, loginUrl },
      after: { userId, email, accountType: d.accountType },
    };
  },
);

// ─── Quote-only account class + access switches ───────────────
// Set a user's host account_kind ('host' | 'quote_only') and the two admin block
// switches (quote_access / platform_access). A quote_only account gets the scoped
// quotes-only shell; platform_access=false bounces any account to that shell.
const hostAccessSchema = z.object({
  userId: z.string().uuid(),
  accountKind: z.enum(["host", "quote_only"]).optional(),
  quoteAccess: z.boolean().optional(),
  platformAccess: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

export const setHostAccessAction = withAdminAudit<
  z.infer<typeof hostAccessSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.role",
    actionName: "user.set_host_access",
    targetType: "user",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    const parsed = hostAccessSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const d = parsed.data;
    const patch: Record<string, unknown> = {};
    if (d.accountKind !== undefined) patch.account_kind = d.accountKind;
    if (d.quoteAccess !== undefined) patch.quote_access = d.quoteAccess;
    if (d.platformAccess !== undefined)
      patch.platform_access = d.platformAccess;
    if (Object.keys(patch).length === 0) {
      return { result: { ok: true }, after: {} };
    }
    patch.updated_at = new Date().toISOString();
    const { data, error } = await service
      .from("hosts")
      .update(patch)
      .eq("user_id", d.userId)
      .is("deleted_at", null)
      .select("id, account_kind, quote_access, platform_access")
      .maybeSingle();
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/users/${d.userId}`);
    revalidatePath("/admin/users");
    return { result: { ok: true }, after: data };
  },
);

// ─── Delete user (soft delete + 30-day hold) ──────────────────
// SOFT delete only — the absolute rule (CLAUDE.md / AGENT_RULES §2.1) is that
// user_profiles / hosts / listings / bookings are NEVER hard-deleted here. We
// set deleted_at + deactivate, soft-delete the host row, and ban the auth user
// so it can't sign in. Nothing is anonymised or destroyed — every row is
// retained so the account is fully recoverable during the hold (see
// restoreUserAction). Data is only removed by the manual hard purge
// (purgeUserAction) after the 30-day hold. NEVER call app_purge_user_account
// here. Shared with the self-service delete path via lib/users/accountLifecycle.
const deleteSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const softDeleteUserAction = withAdminAudit<
  z.infer<typeof deleteSchema>,
  { ok: true; method: "soft_deleted" }
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

    await softDeleteUserAccount(service, args.userId);

    revalidatePath(`/admin/users/${args.userId}`);
    revalidatePath("/admin/users");
    return {
      result: { ok: true, method: "soft_deleted" },
      after: { user_id: args.userId, method: "soft_deleted" },
    };
  },
);

// ─── Restore (reinstate a soft-deleted account) ───────────────
// Reverses a soft delete during the hold: clears deleted_at, reactivates, and
// lifts the auth ban so the user can sign in again. Everything comes back
// because nothing was destroyed.
const restoreSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const restoreUserAction = withAdminAudit<
  z.infer<typeof restoreSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.delete",
    actionName: "user.restore",
    targetType: "user",
    getTargetId: (a) => a.userId,
    requireReason: true,
  },
  async (args, service) => {
    const { data: target } = await service
      .from("user_profiles")
      .select("deleted_at")
      .eq("id", args.userId)
      .maybeSingle();
    if (!target?.deleted_at) {
      throw new Error("This account is not deleted — nothing to restore.");
    }

    await restoreUserAccount(service, args.userId);

    revalidatePath(`/admin/users/${args.userId}`);
    revalidatePath("/admin/users");
    return {
      result: { ok: true },
      after: { user_id: args.userId, restored: true },
    };
  },
);

// ─── Permanent purge (manual, admin-only, after the 30-day hold) ──
// Irreversibly deletes every row the user owns + the auth user. Only allowed on
// an account that has been soft-deleted for at least DELETED_ACCOUNT_HOLD_DAYS.
// This is the ONLY place user data is truly destroyed. No cron runs this — an
// admin must trigger it deliberately.
const purgeSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const purgeUserAction = withAdminAudit<
  z.infer<typeof purgeSchema>,
  { ok: true; method: "hard_purged" }
>(
  {
    permissionKey: "users.delete",
    actionName: "user.purge",
    targetType: "user",
    getTargetId: (a) => a.userId,
    requireReason: true,
  },
  async (args, service) => {
    const { data: target } = await service
      .from("user_profiles")
      .select("role, deleted_at")
      .eq("id", args.userId)
      .maybeSingle();

    if ((target?.role as string | undefined) === "super_admin") {
      throw new Error(
        "Super admin accounts can't be purged here — change the role first.",
      );
    }
    if (!target?.deleted_at) {
      throw new Error(
        "Only a deleted account can be purged. Delete it first, then wait out the hold.",
      );
    }
    if (!isPurgeEligible(target.deleted_at as string)) {
      throw new Error(
        `This account is still in its ${DELETED_ACCOUNT_HOLD_DAYS}-day hold — it can't be purged yet.`,
      );
    }

    await hardPurgeUserAccount(service, args.userId);

    revalidatePath("/admin/users");
    return {
      result: { ok: true, method: "hard_purged" },
      after: { user_id: args.userId, method: "hard_purged" },
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

// ─── Multi-subscription helpers ───────────────────────────────────────
// A host may hold ONE active membership + MANY active service subscriptions
// (once-off products live in product_orders only). These helpers key every
// admin write by (host_id, product_id) — never the single-row assumption —
// and mirror the settle-path activateMappedPlan so all paths behave alike.
type SubService = ReturnType<typeof createAdminClient>;
type SubProduct = {
  id: string;
  slug: string | null;
  product_type: string | null;
  billing_cycle: string | null;
  plan_key: string | null;
};

// Keep subscriptions.plan a valid plans.key (drives legacy gating): prefer the
// product's explicit plan_key, else its slug when that's a real plan key, else
// preserve the existing plan (or 'free' for a brand-new subscription).
async function derivePlanKey(
  service: SubService,
  product: SubProduct,
  fallback: string,
): Promise<string> {
  const desiredKey = product.plan_key ?? product.slug;
  if (!desiredKey) return fallback;
  const { data: planRow } = await service
    .from("plans")
    .select("key")
    .eq("key", desiredKey)
    .maybeSingle();
  return planRow ? planRow.key : fallback;
}

// The one-membership rule is enforced by a DB trigger (raises on a 2nd active
// membership). Before activating a membership we retire any OTHER active
// membership so the write succeeds — a plain switch. The ledger credit/refund
// on a paid downgrade is handled by the admin manage flow (Phase 4), not here.
async function retireOtherMemberships(
  service: SubService,
  hostId: string,
  keepProductId: string,
): Promise<void> {
  const { data: active } = await service
    .from("subscriptions")
    .select("id, product_id")
    .eq("host_id", hostId)
    .in("status", ["trialing", "active", "past_due"]);
  const pids = (active ?? [])
    .map((s) => s.product_id)
    .filter((x): x is string => !!x && x !== keepProductId);
  if (!pids.length) return;
  const { data: mem } = await service
    .from("products")
    .select("id")
    .in("id", pids)
    .eq("product_type", "membership");
  const memIds = new Set((mem ?? []).map((p) => p.id));
  const retire = (active ?? [])
    .filter((s) => s.product_id && memIds.has(s.product_id))
    .map((s) => s.id);
  if (retire.length) {
    await service
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", retire);
  }
}

function addMonthsIso(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}

// The public base for a pay-link SHARED with a user — never a localhost/dev
// origin. Prefer the configured app URL; ignore a localhost value and fall back
// to the brand domain so a link generated locally still resolves for the buyer.
function publicPayBase(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  return !envUrl || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(envUrl)
    ? "https://wielo.co.za"
    : envUrl;
}

// ─── Manually set a host's subscription (plan / cycle / status) ───────
const subSchema = z.object({
  hostId: z.string().uuid(),
  // Which subscription to manage — the product it's linked to. A host can hold
  // several subscriptions (1 membership + N services), so the write MUST target
  // (host_id, product_id). Legacy callers may omit it (falls back below).
  productId: z.string().uuid().nullable().optional(),
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
  // Cancelling a PAID sub posts a pro-rated money document for the unused portion
  // — a credit note by default, or a refund (admin's choice at the moment of
  // cancellation). Ignored for non-cancel changes / free subs / no unused value.
  refundDoc: z.enum(["credit", "refund"]).optional(),
  // Timing of a CANCEL: "now" cancels immediately (+ pro-rated credit/refund);
  // "end_of_cycle" schedules the cancellation for current_period_end (the sub
  // stays active until then; the cron cancels it; no credit — full period used).
  timing: z.enum(["now", "end_of_cycle"]).optional(),
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
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
  },
  async (args, service) => {
    const parsed = subSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid subscription input.");
    const d = parsed.data;
    const now = new Date().toISOString();
    const activeLike = ["trialing", "active", "past_due"].includes(d.status);

    // Resolve the product driving this subscription. When productId is given we
    // manage THAT subscription; when omitted (legacy) we manage the host's
    // membership row (or the sole subscription) so old links keep working.
    type ExistingSub = {
      id: string;
      plan: string;
      product_id: string | null;
      status: string;
      current_period_start: string | null;
      current_period_end: string | null;
    };
    const SUB_COLS =
      "id, plan, product_id, status, current_period_start, current_period_end";
    let productId: string | null | undefined = d.productId;
    let existing: ExistingSub | null | undefined;

    if (productId) {
      const { data } = await service
        .from("subscriptions")
        .select(SUB_COLS)
        .eq("host_id", d.hostId)
        .eq("product_id", productId)
        .maybeSingle();
      existing = data;
    } else {
      const { data: rows } = await service
        .from("subscriptions")
        .select(`${SUB_COLS}, product:products ( product_type )`)
        .eq("host_id", d.hostId);
      const membership = (rows ?? []).find(
        (r) =>
          (r.product as { product_type?: string } | null)?.product_type ===
          "membership",
      );
      const chosen = (membership ?? (rows ?? [])[0] ?? null) as
        | (ExistingSub & { product?: unknown })
        | null;
      existing = chosen
        ? {
            id: chosen.id,
            plan: chosen.plan,
            product_id: chosen.product_id,
            status: chosen.status,
            current_period_start: chosen.current_period_start,
            current_period_end: chosen.current_period_end,
          }
        : null;
      productId = existing?.product_id ?? null;
    }

    // Derive plan (feature tier) + cycle FROM the linked product — the single
    // source of truth — so gating resolves correctly. Also carry the product's
    // price/name for the pro-rated credit/refund on cancellation.
    let plan = existing?.plan ?? "free";
    let billingCycle: "monthly" | "annual" | null = d.billingCycle ?? null;
    let isMembership = false;
    let productPrice = 0;
    let productCurrency = "ZAR";
    let productName = "subscription";

    if (productId) {
      const { data: product } = await service
        .from("products")
        .select(
          "id, name, slug, product_type, billing_cycle, plan_key, price, currency",
        )
        .eq("id", productId)
        .maybeSingle();
      if (!product) throw new Error("Product not found.");
      if (product.product_type === "product") {
        throw new Error("Once-off products aren't managed as subscriptions.");
      }
      isMembership = product.product_type === "membership";
      plan = await derivePlanKey(service, product, plan);
      billingCycle = product.billing_cycle === "annual" ? "annual" : "monthly";
      productPrice = Number(product.price ?? 0);
      productCurrency = product.currency ?? "ZAR";
      productName = product.name ?? "subscription";
    }

    // ─── End-of-cycle cancel: schedule it for current_period_end instead of
    // cancelling now. The sub stays active until then; the hourly cron applies
    // it. No credit/refund (the full paid period is used). Falls through to an
    // immediate cancel if there's no future period end to schedule against.
    const periodEndMs = existing?.current_period_end
      ? new Date(existing.current_period_end).getTime()
      : 0;
    if (
      existing &&
      d.status === "cancelled" &&
      d.timing === "end_of_cycle" &&
      ["trialing", "active", "past_due"].includes(existing.status) &&
      periodEndMs > Date.now()
    ) {
      const admin = await requirePermission("subscriptions.edit");
      // At most one pending change per sub — supersede any prior one.
      await service
        .from("subscription_scheduled_changes")
        .update({ status: "superseded" })
        .eq("subscription_id", existing.id)
        .eq("status", "pending");
      const { error: schErr } = await service
        .from("subscription_scheduled_changes")
        .insert({
          subscription_id: existing.id,
          host_id: d.hostId,
          kind: "cancel",
          effective_at: existing.current_period_end,
          created_by: admin.userId,
          note: d.reason ?? null,
        });
      if (schErr) throw new Error(schErr.message);
      await service
        .from("subscriptions")
        .update({ cancel_at_period_end: true, updated_at: now })
        .eq("id", existing.id);
      revalidatePath(`/admin/users`);
      return {
        result: { ok: true },
        after: {
          hostId: d.hostId,
          scheduledCancel: existing.current_period_end,
        },
      };
    }

    // Re-activating a membership must respect the one-per-host rule.
    if (activeLike && isMembership && productId) {
      await retireOtherMemberships(service, d.hostId, productId);
    }

    const patch = {
      ...(productId !== undefined ? { product_id: productId } : {}),
      plan,
      billing_cycle: billingCycle,
      status: d.status,
      updated_at: now,
    };

    if (existing) {
      const { error } = await service
        .from("subscriptions")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      // No row yet for this product — create it (activating the subscription).
      const cycle = billingCycle ?? "monthly";
      const { error } = await service.from("subscriptions").insert({
        host_id: d.hostId,
        ...patch,
        current_period_start: now,
        current_period_end: addMonthsIso(cycle === "annual" ? 12 : 1),
      });
      if (error) throw new Error(error.message);
    }

    // Mirror the settle-path activateMappedPlan: an active-like membership/service
    // grants its per-cycle credit allotment (idempotent per product+period). Without
    // this, admin-activating a plan silently skipped the Wielo Credits that a
    // Paystack/PayPal/free purchase of the SAME plan grants. Best-effort.
    if (activeLike && productId) {
      await grantSubscriptionCredits(service, {
        hostId: d.hostId,
        productId,
        periodStart: existing?.current_period_start ?? now,
      });
    }

    // ─── Auto-ledger on downgrade: cancelling a PAID sub that was live posts a
    // pro-rated money document for the UNUSED portion — a credit note by default,
    // or a refund (admin's choice). The mint triggers turn the ledger row into a
    // CN/REF doc that shows on the ledger + the user's transaction history.
    const wasLive =
      !!existing &&
      ["trialing", "active", "past_due"].includes(existing.status);
    if (existing && d.status === "cancelled" && wasLive && productPrice > 0) {
      const amount = proratedAmount(
        productPrice,
        existing.current_period_start,
        existing.current_period_end,
      );
      if (amount > 0) {
        const docType = d.refundDoc === "refund" ? "refund" : "credit";
        const { data: hostRow } = await service
          .from("hosts")
          .select("user_id")
          .eq("id", d.hostId)
          .maybeSingle();
        const admin = await requirePermission("subscriptions.edit");
        const left = daysRemaining(existing.current_period_end);
        // Link this pro-rated reversal to the charge whose commission it reverses
        // — the most recent unreversed accrual for this host + product — so
        // affiliate commission is clawed back PROPORTIONALLY (refund ÷ charge)
        // by the clawback trigger. Null when the host wasn't referred (no-op).
        const { data: srcComm } = productId
          ? await service
              .from("affiliate_commissions")
              .select("source_ledger_id")
              .eq("referred_host_id", d.hostId)
              .eq("product_id", productId)
              .eq("entry_type", "accrual")
              .in("status", ["pending", "cleared"])
              .is("refund_ledger_id", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : { data: null };
        const { error: ledErr } = await service.from("platform_ledger").insert({
          user_id: hostRow?.user_id ?? null,
          host_id: d.hostId,
          type: docType,
          status: "completed",
          amount: -Math.abs(amount),
          currency: productCurrency,
          provider: "manual",
          reverses_ledger_id: srcComm?.source_ledger_id ?? null,
          reason: `Pro-rated ${
            docType === "refund" ? "refund" : "credit"
          } for cancelled ${productName} (${left} day${
            left === 1 ? "" : "s"
          } unused)`,
          created_by: admin.userId,
          paid_at: now,
        });
        if (ledErr) throw new Error(ledErr.message);
      }
    }

    revalidatePath(`/admin/users`);
    revalidatePath("/admin/subscriptions/revenue");
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
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
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

// ─── Activate / add a catalog product on a user's account ─────────────
// Multi-subscription: activating a MEMBERSHIP switches the host's membership
// (retiring any other active one); activating a SERVICE adds its own row (many
// allowed). Keyed by (host_id, product_id) so a host can hold several subs.
const setProductSchema = z.object({
  // Provide the host directly, OR a userId — a guest with no host is provisioned
  // as a host on the spot (so an admin can sell a guest a subscription/product).
  hostId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  productId: z.string().uuid(),
  // How to bill a paid upgrade/add. "paid": post a COMPLETED pro-rated charge
  // (invoice mints). "paylink": activate now + return a custom-amount pay-link
  // for the buyer to pay the pro-rated delta (settles WITHOUT re-activating).
  // "none" (default): just activate (free product, or the admin isn't collecting).
  charge: z.enum(["paid", "paylink", "none"]).optional(),
  // Timing of a membership SWITCH: "end_of_cycle" schedules the switch for the
  // current membership's period end (the cron applies it) instead of now.
  timing: z.enum(["now", "end_of_cycle"]).optional(),
  reason: z.string().optional(),
});

export const setUserProductAction = withAdminAudit<
  z.infer<typeof setProductSchema>,
  { ok: true; payUrl?: string }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "user.set_product",
    targetType: "subscription",
    getTargetId: (a) => a.hostId ?? a.userId ?? "",
    getOwnerUserId: (a, s) =>
      a.hostId ? ownerUserIdForHost(s, a.hostId) : (a.userId ?? null),
  },
  async (args, service) => {
    const parsed = setProductSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { productId, charge } = parsed.data;

    // Resolve the host — provisioning one from the user (guest → host) if needed
    // so a guest account can be sold a subscription/product.
    let hostId = parsed.data.hostId ?? null;
    if (!hostId && parsed.data.userId) {
      hostId = await ensureHostForUser(service, parsed.data.userId);
    }
    if (!hostId) throw new Error("No account to attach the product to.");

    const { data: product } = await service
      .from("products")
      .select(
        "id, name, slug, product_type, billing_cycle, plan_key, price, currency",
      )
      .eq("id", productId)
      .maybeSingle();
    if (!product) throw new Error("Product not found.");
    if (product.product_type === "product") {
      throw new Error(
        "Once-off products are purchased, not activated as a subscription.",
      );
    }
    const isMembership = product.product_type === "membership";
    const newPrice = Number(product.price ?? 0);
    const currency = product.currency ?? "ZAR";

    // Find THIS product's subscription (renew it) rather than assuming one row.
    const { data: existing } = await service
      .from("subscriptions")
      .select("id, plan, current_period_start, current_period_end")
      .eq("host_id", hostId)
      .eq("product_id", productId)
      .maybeSingle();

    // Switching membership (no row yet for this product): find the active
    // membership being replaced — its price + billing window drive the pro-rated
    // UPGRADE charge (bill only the unused difference) and the new sub inherits
    // that window so the cycle continues rather than resetting.
    let carryStart: string | null = null;
    let carryEnd: string | null = null;
    let oldPrice = 0;
    let oldSubId: string | null = null;
    let switchingMembership = false;
    if (isMembership) {
      // The membership being REPLACED = the host's current active membership on
      // a DIFFERENT product. Its price + window drive the pro-rated upgrade delta
      // and the new sub inherits that window. Runs whether or not a (cancelled)
      // row already exists for the target product.
      const { data: activeMems } = await service
        .from("subscriptions")
        .select(
          "id, product_id, current_period_start, current_period_end, product:products ( product_type, price )",
        )
        .eq("host_id", hostId)
        .in("status", ["trialing", "active", "past_due"]);
      const oldMem = (activeMems ?? []).find(
        (r) =>
          r.product_id !== productId &&
          (r.product as { product_type?: string } | null)?.product_type ===
            "membership",
      );
      if (oldMem) {
        switchingMembership = true;
        oldSubId = oldMem.id;
        carryStart = oldMem.current_period_start;
        carryEnd = oldMem.current_period_end;
        oldPrice = Number(
          (oldMem.product as { price?: number } | null)?.price ?? 0,
        );
      }
    }

    const plan = await derivePlanKey(
      service,
      product,
      existing?.plan ?? "free",
    );
    const cycle = product.billing_cycle === "annual" ? "annual" : "monthly";
    const now = new Date().toISOString();

    // ─── End-of-cycle SWITCH: schedule the membership change for the current
    // membership's period end (the cron applies it) instead of switching now.
    // Only for a real membership switch with a future period end; otherwise it
    // falls through to an immediate change below.
    if (
      parsed.data.timing === "end_of_cycle" &&
      switchingMembership &&
      oldSubId &&
      carryEnd &&
      new Date(carryEnd).getTime() > Date.now()
    ) {
      const admin = await requirePermission("subscriptions.edit");
      await service
        .from("subscription_scheduled_changes")
        .update({ status: "superseded" })
        .eq("subscription_id", oldSubId)
        .eq("status", "pending");
      const { error: schErr } = await service
        .from("subscription_scheduled_changes")
        .insert({
          subscription_id: oldSubId,
          host_id: hostId,
          kind: "switch",
          target_product_id: product.id,
          effective_at: carryEnd,
          created_by: admin.userId,
        });
      if (schErr) throw new Error(schErr.message);
      // A switch isn't a cancellation — clear any stale cancel-at-period-end flag
      // (e.g. if this superseded a scheduled cancel).
      await service
        .from("subscriptions")
        .update({ cancel_at_period_end: false, updated_at: now })
        .eq("id", oldSubId);
      revalidatePath(`/admin/users`);
      return {
        result: { ok: true },
        after: { hostId, scheduledSwitch: product.id },
      };
    }
    // Same-product re-activation: PRESERVE the live billing window so the
    // per-period credit grant stays idempotent — re-clicking "Activate" on an
    // already-active membership mid-period must not reset current_period_start to
    // today and re-mint the plan's credits (sweep finding #3). Only a genuinely
    // ended period advances to a fresh window (and legitimately re-grants).
    let renewStart: string | null = null;
    let renewEnd: string | null = null;
    if (existing && !switchingMembership) {
      const endMs = existing.current_period_end
        ? new Date(existing.current_period_end).getTime()
        : 0;
      if (endMs > Date.now()) {
        renewStart = existing.current_period_start;
        renewEnd = existing.current_period_end;
      }
    }

    // A mid-cycle membership upgrade (switch) keeps the OLD membership's window; a
    // same-product re-activation keeps its own live window; a fresh activation /
    // service add / ended-period renewal starts a new one.
    const patch = {
      product_id: product.id,
      plan,
      billing_cycle: cycle,
      status: "active" as const,
      current_period_start: carryStart ?? renewStart ?? now,
      current_period_end:
        carryEnd ?? renewEnd ?? addMonthsIso(cycle === "annual" ? 12 : 1),
      updated_at: now,
    };

    // "paylink" DEFERS activation: the tier only becomes active once the buyer
    // pays the link (the settle path activates it), so we skip the subscription
    // write here and just create the order + inbox card below. Every other mode
    // activates immediately.
    if (charge !== "paylink") {
      // Activating a membership must respect the one-per-host rule whether we're
      // renewing/reactivating an existing (possibly cancelled) row OR inserting a
      // new one — retire any OTHER active membership first, else the DB trigger
      // rejects the write.
      if (isMembership) {
        await retireOtherMemberships(service, hostId, productId);
      }
      if (existing) {
        const { error } = await service
          .from("subscriptions")
          .update(patch)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await service
          .from("subscriptions")
          .insert({ host_id: hostId, ...patch });
        if (error) throw new Error(error.message);
      }

      // Immediate activation grants the plan's per-cycle Wielo Credits (idempotent
      // per product+period) — same as a real purchase settling. "paylink" is
      // excluded above: its credits are granted by the settle path once paid.
      await grantSubscriptionCredits(service, {
        hostId,
        productId: product.id,
        periodStart: patch.current_period_start,
      });
    }

    // ─── Auto-ledger: a paid upgrade/add records the money for the pro-rated
    // delta. Delta = (new − old) × unused fraction for a mid-cycle membership
    // upgrade, else the full new price for a fresh activation / service add /
    // renewal. Server-recomputed (never trusts the client's preview). "paid"
    // posts a COMPLETED charge (invoice mints via trigger). "paylink" creates a
    // custom-amount order that ACTIVATES the plan on payment + drops an upgrade
    // card into the buyer's Wielo inbox with a Pay button.
    let payUrl: string | undefined;
    if ((charge === "paid" || charge === "paylink") && newPrice > 0) {
      const chargeAmount = switchingMembership
        ? proratedAmount(Math.max(0, newPrice - oldPrice), carryStart, carryEnd)
        : round2(newPrice);
      if (chargeAmount > 0) {
        const label = switchingMembership
          ? `Pro-rated upgrade to ${product.name}`
          : `Activated ${product.name}`;
        const { data: hostRow } = await service
          .from("hosts")
          .select("user_id")
          .eq("id", hostId)
          .maybeSingle();
        const admin = await requirePermission("subscriptions.edit");

        if (charge === "paid") {
          const { data: led, error: ledErr } = await service
            .from("platform_ledger")
            .insert({
              user_id: hostRow?.user_id ?? null,
              host_id: hostId,
              product_id: product.id,
              type: "charge",
              status: "completed",
              amount: chargeAmount,
              currency,
              provider: "manual",
              reason: label,
              created_by: admin.userId,
              paid_at: now,
            })
            .select("id")
            .single();
          if (ledErr) throw new Error(ledErr.message);
          // A charge against a referred host accrues affiliate commission too
          // (idempotent RPC; no-ops for an unreferred payer) + notifies them.
          if (led?.id) {
            await accrueAffiliateAndNotify(service, led.id);
          }
        } else {
          // paylink: the tier is NOT active yet — create a custom-amount order
          // for the delta that ACTIVATES the plan when the buyer pays it, then
          // drop an upgrade card (with the Pay button) into their Wielo inbox.
          if (!hostRow?.user_id) {
            throw new Error("This host has no owner account to bill.");
          }
          const { data: prof } = await service
            .from("user_profiles")
            .select("email")
            .eq("id", hostRow.user_id)
            .maybeSingle();
          const email = prof?.email;
          if (!email) {
            throw new Error("This host has no email to send a pay-link to.");
          }
          const order = await createProductOrder(
            {
              productId: product.id,
              email,
              createdBy: admin.userId,
              amountOverride: chargeAmount,
              label,
              // Payment activates the plan (deferred activation).
              activateOnPay: true,
            },
            publicPayBase(),
          );
          if (!order.ok) throw new Error(order.error);
          payUrl = order.url;

          // Beautiful upgrade card in the buyer's Wielo inbox with a Pay button.
          await adminPostUpgradeCardToHostThread(service, {
            host: { id: hostId, userId: hostRow.user_id },
            url: order.url,
            productName: product.name ?? "your new plan",
            amount: chargeAmount,
            currency,
            isUpgrade: switchingMembership,
          });
        }
      }
    }

    revalidatePath(`/admin/users`);
    revalidatePath("/admin/subscriptions/revenue");
    return { result: { ok: true, payUrl }, after: { hostId, ...patch } };
  },
);

// ─── Cancel a pending scheduled subscription change ──────────────────
// Voids an "apply at end of cycle" change before it fires. If it was a
// scheduled cancellation, the sub's cancel_at_period_end flag is cleared too.
const cancelSchedSchema = z.object({
  hostId: z.string().uuid(),
  changeId: z.string().uuid(),
  reason: z.string().optional(),
});

export const cancelScheduledChangeAction = withAdminAudit<
  z.infer<typeof cancelSchedSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "user.cancel_scheduled_change",
    targetType: "subscription",
    getTargetId: (a) => a.hostId,
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
  },
  async (args, service) => {
    const parsed = cancelSchedSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { hostId, changeId } = parsed.data;
    const { data: chg } = await service
      .from("subscription_scheduled_changes")
      .select("id, subscription_id, kind, status")
      .eq("id", changeId)
      .eq("host_id", hostId)
      .maybeSingle();
    if (!chg || chg.status !== "pending") {
      throw new Error("No pending scheduled change to cancel.");
    }
    const { error } = await service
      .from("subscription_scheduled_changes")
      .update({ status: "cancelled" })
      .eq("id", changeId);
    if (error) throw new Error(error.message);
    if (chg.kind === "cancel") {
      await service
        .from("subscriptions")
        .update({
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chg.subscription_id);
    }
    revalidatePath(`/admin/users`);
    return { result: { ok: true }, after: { changeId } };
  },
);

// ─── Sell a ONCE-OFF product to a user (not a subscription) ──────────
// A `product` (once-off) is purchased, not activated: "paid" records a completed
// sale (paid order + completed charge → invoice mints); "paylink" creates a
// pending order + pay-link and drops it into the buyer's Wielo inbox (hosts).
const sellSchema = z.object({
  hostId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  mode: z.enum(["paid", "paylink"]),
  reason: z.string().optional(),
});

export const sellProductAction = withAdminAudit<
  z.infer<typeof sellSchema>,
  { ok: true; payUrl?: string }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "user.sell_product",
    targetType: "user",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    const parsed = sellSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { userId, hostId, productId, mode } = parsed.data;

    const { data: product } = await service
      .from("products")
      .select("id, name, price, currency, product_type, is_active")
      .eq("id", productId)
      .maybeSingle();
    if (!product || !product.is_active) {
      throw new Error("Product not found or inactive.");
    }
    if (product.product_type !== "product") {
      throw new Error("Use the subscription flow for memberships / services.");
    }

    const { data: prof } = await service
      .from("user_profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const email = prof?.email;
    if (!email) throw new Error("This user has no email on file.");

    const price = Number(product.price ?? 0);
    const currency = product.currency ?? "ZAR";
    const admin = await requirePermission("subscriptions.edit");
    const now = new Date().toISOString();

    if (mode === "paylink") {
      const order = await createProductOrder(
        { productId, email, createdBy: admin.userId },
        publicPayBase(),
      );
      if (!order.ok) throw new Error(order.error);
      // Drop a pay card into the buyer's Wielo inbox (hosts have a thread).
      if (hostId) {
        try {
          await adminPostPaymentLinkToHostThread(service, {
            host: { id: hostId, userId },
            url: order.url,
            body: `${product.name} — ${currency} ${price.toFixed(2)} due`,
          });
        } catch {
          // best-effort — the link is still returned to the admin
        }
      }
      revalidatePath(`/admin/users`);
      return {
        result: { ok: true, payUrl: order.url },
        after: { userId, productId },
      };
    }

    // mode "paid": record a completed sale.
    const token = crypto.randomUUID().replace(/-/g, "");
    const { error: ordErr } = await service.from("product_orders").insert({
      product_id: product.id,
      product_name: product.name,
      payer_email: email,
      payer_user_id: userId,
      amount: price,
      currency,
      status: "paid",
      paid_at: now,
      pay_token: token,
      created_by: admin.userId,
    });
    if (ordErr) throw new Error(ordErr.message);

    if (price > 0) {
      const { data: led, error: ledErr } = await service
        .from("platform_ledger")
        .insert({
          user_id: userId,
          host_id: hostId ?? null,
          product_id: product.id,
          type: "charge",
          status: "completed",
          amount: price,
          currency,
          provider: "manual",
          reason: `Product sale · ${product.name}`,
          created_by: admin.userId,
          paid_at: now,
        })
        .select("id")
        .single();
      if (ledErr) throw new Error(ledErr.message);
      if (led?.id) {
        await accrueAffiliateAndNotify(service, led.id);
      }
    }

    revalidatePath(`/admin/users`);
    revalidatePath("/admin/subscriptions/revenue");
    return { result: { ok: true }, after: { userId, productId } };
  },
);

// ─── Share a Wielo document (invoice / credit note / refund) with the user ──
// From the user's Wielo ledger: post the doc link into their Wielo inbox thread,
// or email it to them. Mirrors the booking ledger's "send link / email" actions.
const docShareSchema = z.object({
  userId: z.string().uuid(),
  url: z.string().url(),
  label: z.string().trim().min(1).max(120),
  reason: z.string().optional(),
});

export const sendWieloDocToInboxAction = withAdminAudit<
  z.infer<typeof docShareSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "user.send_doc_inbox",
    targetType: "user",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    const parsed = docShareSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { userId, url, label } = parsed.data;
    const { data: host } = await service
      .from("hosts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!host)
      throw new Error("This user has no inbox thread (not a host yet).");
    await adminPostToHostThread(service, {
      host: { id: host.id, userId },
      body: `Here's your ${label}: ${url}`,
    });
    return { result: { ok: true }, after: { userId } };
  },
);

export const emailWieloDocAction = withAdminAudit<
  z.infer<typeof docShareSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "user.email_doc",
    targetType: "user",
    getTargetId: (a) => a.userId,
  },
  async (args, service) => {
    const parsed = docShareSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { userId, url, label } = parsed.data;
    const { data: prof } = await service
      .from("user_profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();
    const to = prof?.email;
    if (!to) throw new Error("This user has no email on file.");
    const name = (prof?.full_name ?? "there").split(" ")[0] || "there";
    const res = await sendTransactionalEmail({
      to,
      subject: `Your ${label}`,
      html: `<p>Hi ${name},</p><p>Here's your ${label}:</p><p><a href="${url}">${url}</a></p><p>— Wielo</p>`,
    });
    if (!res.ok) throw new Error(res.error ?? "Couldn't send the email.");
    return { result: { ok: true }, after: { userId } };
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
    getOwnerUserId: (a, s) => ownerUserIdForBusiness(s, a.businessId),
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
    getOwnerUserId: (a, s) => ownerUserIdForAffiliate(s, a.affiliateId),
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
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
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
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
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
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
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
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
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
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
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
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
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
    getOwnerUserId: (a, s) => ownerUserIdForHost(s, a.hostId),
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
  hostId?: string;
  userId?: string;
  productId: string;
  charge?: "paid" | "paylink" | "none";
  timing?: "now" | "end_of_cycle";
}): Promise<{ ok: true; payUrl?: string } | { ok: false; error: string }> {
  try {
    const r = await setUserProductAction(input);
    return { ok: true, payUrl: r.payUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
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
  billingCycle?: "monthly" | "annual" | null;
  status:
    | "trialing"
    | "active"
    | "past_due"
    | "restricted"
    | "paused"
    | "cancelled"
    | "expired";
  refundDoc?: "credit" | "refund";
  timing?: "now" | "end_of_cycle";
}) {
  return wrap(() => adminUpdateSubscriptionAction(input));
}

export async function cancelScheduledChange(input: {
  hostId: string;
  changeId: string;
}) {
  return wrap(() => cancelScheduledChangeAction(input));
}

export async function sellProduct(input: {
  hostId?: string;
  userId: string;
  productId: string;
  mode: "paid" | "paylink";
}): Promise<{ ok: true; payUrl?: string } | { ok: false; error: string }> {
  try {
    const r = await sellProductAction(input);
    return { ok: true, payUrl: r.payUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function sendWieloDocToInbox(input: {
  userId: string;
  url: string;
  label: string;
}) {
  return wrap(() => sendWieloDocToInboxAction(input));
}

export async function emailWieloDoc(input: {
  userId: string;
  url: string;
  label: string;
}) {
  return wrap(() => emailWieloDocAction(input));
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

// Wielo → Host statement (F4). Mints an ephemeral signed link over the host's
// platform (Wielo) ledger — a running billing statement. Read-only; the existing
// sendWieloDocToInbox / emailWieloDoc handle delivery with the returned path.
const wieloStatementSchema = z.object({
  userId: z.string().uuid(),
  from: z.string().datetime().nullable().optional(),
  to: z.string().datetime().nullable().optional(),
});

export async function buildWieloHostStatement(input: {
  userId: string;
  from?: string | null;
  to?: string | null;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const parsed = wieloStatementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    await requirePermission("payments.view");
  } catch {
    return { ok: false, error: "Not allowed." };
  }

  const service = createAdminClient();
  const { data: host } = await service
    .from("hosts")
    .select("id")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  const issuedAt = new Date().toISOString();
  const token: StatementToken = {
    v: 1,
    ctx: "wielo_host",
    hostId: (host?.id as string | undefined) ?? parsed.data.userId,
    userId: parsed.data.userId,
    from: parsed.data.from ?? null,
    to: parsed.data.to ?? issuedAt,
    issuedAt,
    currency: "ZAR",
  };
  // Locale-prefixed so window.open resolves — /statement lives under [locale].
  return {
    ok: true,
    path: `/${routing.defaultLocale}/statement/${signStatementToken(token)}`,
  };
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

// Client-callable wrapper (the withAdminAudit const isn't a directly-invocable
// server action — a real exported async function is).
export async function setHostAccess(input: {
  userId: string;
  accountKind?: "host" | "quote_only";
  quoteAccess?: boolean;
  platformAccess?: boolean;
}) {
  try {
    await setHostAccessAction(input);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Could not update access.",
    };
  }
}

// Client-callable wrapper for the admin "Add user" dialog. Returns the new
// user's id (to redirect to their record) + an optional magic sign-in link.
export async function createUser(input: {
  email: string;
  fullName?: string | null;
  accountType: "guest" | "host" | "quote_only";
}): Promise<
  { ok: true; userId: string; loginUrl?: string } | { ok: false; error: string }
> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    const r = await createUserAction(parsed.data);
    return { ok: true, userId: r.userId, loginUrl: r.loginUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not create the user.",
    };
  }
}

export async function restoreUser(input: { userId: string; reason: string }) {
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await restoreUserAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function purgeUser(input: { userId: string; reason: string }) {
  const parsed = purgeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await purgeUserAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
