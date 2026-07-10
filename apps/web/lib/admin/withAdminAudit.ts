import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

import { AdminReasonRequired } from "./errors";
import { getActiveImpersonationTargetId } from "./impersonation";
import { type PermissionKey, requirePermission } from "./requirePermission";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `admin_audit_log.ip_address` is a Postgres `inet`, which only accepts a bare
// IPv4/IPv6 address. `x-forwarded-for` can carry a :port, a hostname or a comma
// list (esp. in dev / behind proxies) — any of which make the insert fail. Return
// a clean address or null so the audit write never breaks on it.
function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  const m4 = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::\d+)?$/);
  if (m4) {
    const octets = m4.slice(1, 5);
    return octets.every((o) => Number(o) <= 255) ? octets.join(".") : null;
  }
  if (v.includes(":") && /^[0-9a-fA-F:]+(?:\.\d{1,3}){0,3}$/.test(v)) return v;
  return null;
}

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
  | "marketing_asset"
  | "special_category";

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

    const h = headers();
    const ip = normalizeIp(
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
    );
    const userAgent = h.get("user-agent");
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

    const row = {
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
      user_agent: userAgent,
    };
    // Never silently drop an audit write. If the inet cast still fails on an odd
    // forwarded value, retry once without the ip so the row is still recorded.
    const { error: auditErr } = await service
      .from("admin_audit_log")
      .insert({ ...row, ip_address: ip });
    if (auditErr) {
      const { error: retryErr } = await service
        .from("admin_audit_log")
        .insert(row);
      if (retryErr) {
        console.error(
          `[admin-audit] failed to record ${config.actionName}: ${retryErr.message}`,
        );
      }
    }

    return result;
  };
}
