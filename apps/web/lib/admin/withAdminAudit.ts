import "server-only";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

import { writeAuditRow } from "./auditWrite";
import { AdminReasonRequired } from "./errors";
import { getActiveImpersonationTargetId } from "./impersonation";
import { type PermissionKey, requirePermission } from "./requirePermission";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every audit `target_type` the app writes. Single source of truth — the DB
 * CHECK constraint on admin_audit_log.target_type is kept a superset of this
 * (see migration 20260710130000), and the /admin/audit filter dropdown is
 * driven off this array so it never drifts behind the values in use.
 *
 * `permission_denied` is included because requirePermission() writes it
 * directly (outside withAdminAudit) — it's still a real, filterable target.
 */
export const AUDIT_TARGET_TYPES = [
  "host",
  "guest",
  "user",
  "booking",
  "listing",
  "business",
  "addon",
  "policy",
  "review",
  "subscription",
  "plan",
  "plan_feature",
  "platform_service",
  "product",
  "product_feature",
  "platform_ledger",
  "platform_coupon",
  "feature_override",
  "platform_setting",
  "platform_staff",
  "staff_member",
  "impersonation",
  "help_article",
  "help_video",
  "help_faq",
  "help_category",
  "help_status",
  "help_settings",
  "help_article_suggestion",
  "broadcast",
  "notification_send",
  "listing_category",
  "amenity_group",
  "amenity_catalog",
  "affiliate",
  "affiliate_payout",
  "affiliate_settings",
  "affiliate_campaign",
  "affiliate_campaign_enrollment",
  "marketing_asset",
  "special_category",
  "looking_for_requirement_group",
  "looking_for_requirement_option",
  "looking_for_post",
  "feature_request",
  "changelog_entry",
  "permission_denied",
] as const;

type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export type AuditConfig<TArgs> = {
  /** Permission key the caller must hold. */
  permissionKey: PermissionKey;
  /** Short, machine-readable action name (e.g. "listing.update_basic"). */
  actionName: string;
  /** target_type for the audit row. */
  targetType: AuditTargetType;
  /** Derive the target row id from action arguments. */
  getTargetId: (args: TArgs) => string;
  /**
   * Optional: resolve the user_profiles id of the user who OWNS the target row
   * (e.g. the host behind a hostId, or the owner behind a businessId/affiliateId).
   * Written as a top-level `payload.owner_user_id` so the per-user History tab
   * — which matches `payload->>owner_user_id` — surfaces actions that target
   * something the user owns rather than the user row itself. Without this, a
   * host-scoped action (add-on/policy/subscription/business edit) is audited but
   * invisible in the owner's History.
   */
  getOwnerUserId?: (
    args: TArgs,
    service: ReturnType<typeof createAdminClient>,
  ) => string | null | Promise<string | null>;
  /** Require args.reason to be a non-empty string. */
  requireReason?: boolean;
  /**
   * Optional before-state snapshot. Use sparingly — RETURNING * inside the
   * mutation is preferred for capturing after-state without drift.
   */
  captureBefore?: (
    service: ReturnType<typeof createAdminClient>,
    args: TArgs,
  ) => Promise<unknown>;
};

export type AuditedAction<TResult> = {
  result: TResult;
  /** What changed — captured from RETURNING * in the mutation. */
  after?: unknown;
};

/**
 * Wraps a server action with auth + permission + audit-log writes.
 *
 * Pattern: the inner function performs the mutation using the supplied
 * service-role client and returns `{ result, after }` where `after` is the
 * RETURNING * row (or any equivalent snapshot). The wrapper writes the audit
 * row AFTER the mutation succeeds, capturing before/after, ip, user-agent,
 * impersonation context, and the supplied args.
 *
 * For finance/moderation actions (refunds, cancellations, subscription edits),
 * route the mutation through a Supabase Edge Function so the audit insert
 * happens in the same transaction. Use this wrapper only when eventual
 * consistency is acceptable.
 */
export function withAdminAudit<TArgs extends { reason?: string }, TResult>(
  config: AuditConfig<TArgs>,
  fn: (
    args: TArgs,
    service: ReturnType<typeof createAdminClient>,
  ) => Promise<AuditedAction<TResult>>,
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs) => {
    if (config.requireReason && !args.reason?.trim()) {
      throw new AdminReasonRequired();
    }

    const admin = await requirePermission(config.permissionKey);
    const service = createAdminClient();

    const before = config.captureBefore
      ? await config.captureBefore(service, args)
      : undefined;

    const { result, after } = await fn(args, service);

    const impersonating = getActiveImpersonationTargetId();
    // target_id is a uuid column. `getTargetId` can return a value that arrives
    // Promise-wrapped (server-action arg passing) — resolve it, then coerce a
    // non-uuid (email/slug) or non-string to null. The real value is always kept
    // in payload.args regardless.
    const resolvedTarget: unknown = await Promise.resolve(
      config.getTargetId(args),
    );
    const targetId =
      typeof resolvedTarget === "string" && UUID_RE.test(resolvedTarget)
        ? resolvedTarget
        : null;

    // Owner of the target (for the per-user History tab). Resolved after the
    // mutation so lookups see committed state. A non-uuid simply never matches
    // the History filter — harmless.
    const resolvedOwner = config.getOwnerUserId
      ? await config.getOwnerUserId(args, service)
      : null;
    const ownerUserId =
      typeof resolvedOwner === "string" && UUID_RE.test(resolvedOwner)
        ? resolvedOwner
        : null;

    // Never silently drop an audit write — writeAuditRow retries without the ip,
    // logs, and throws in dev so a target_type / constraint / RLS mismatch can't
    // hide (exactly how the add-on/policy audit gap went unnoticed).
    await writeAuditRow(
      {
        admin_id: admin.userId,
        impersonating,
        action: config.actionName,
        target_type: config.targetType,
        target_id: targetId,
        payload: {
          before,
          after,
          args,
          reason: args.reason ?? null,
          ...(ownerUserId ? { owner_user_id: ownerUserId } : {}),
        },
      },
      service,
    );

    // Keep the owner's user-record page fresh after a host-scoped action (add-on,
    // policy, subscription, business, affiliate). The per-action revalidatePath
    // calls target the hostId, which is NOT the /admin/users/[id] route param —
    // revalidate the real owner path here so the History/tabs update.
    if (ownerUserId) revalidatePath(`/admin/users/${ownerUserId}`);

    return result;
  };
}
