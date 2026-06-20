import "server-only";

import { headers } from "next/headers";

import type { Json } from "@vilo/types";

import { createAdminClient } from "@/lib/supabase/admin";

import { AdminReasonRequired } from "./errors";
import { getActiveImpersonationTargetId } from "./impersonation";
import { type PermissionKey, requirePermission } from "./requirePermission";

type AuditTargetType =
  | "host"
  | "guest"
  | "user"
  | "booking"
  | "listing"
  | "business"
  | "addon"
  | "policy"
  | "review"
  | "subscription"
  | "plan"
  | "plan_feature"
  | "platform_service"
  | "product"
  | "product_feature"
  | "platform_ledger"
  | "feature_override"
  | "platform_setting"
  | "platform_staff"
  | "staff_member"
  | "impersonation"
  | "help_article"
  | "help_video"
  | "help_faq"
  | "help_category"
  | "help_status"
  | "help_settings"
  | "help_article_suggestion"
  | "broadcast"
  | "notification_send"
  | "listing_category"
  | "amenity_group"
  | "amenity_catalog"
  | "affiliate"
  | "affiliate_payout"
  | "affiliate_settings"
  | "marketing_asset";

export type AuditConfig<TArgs> = {
  /** Permission key the caller must hold. */
  permissionKey: PermissionKey;
  /** Short, machine-readable action name (e.g. "listing.update_basic"). */
  actionName: string;
  /** target_type for the audit row. */
  targetType: AuditTargetType;
  /** Derive the target row id from action arguments. */
  getTargetId: (args: TArgs) => string;
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

    const h = headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    const userAgent = h.get("user-agent");
    const impersonating = getActiveImpersonationTargetId();

    await service.from("admin_audit_log").insert({
      admin_id: admin.userId,
      impersonating,
      action: config.actionName,
      target_type: config.targetType,
      target_id: config.getTargetId(args),
      payload: {
        before,
        after,
        args,
        reason: args.reason ?? null,
      } as unknown as Json,
      ip_address: ip,
      user_agent: userAgent,
    });

    return result;
  };
}
