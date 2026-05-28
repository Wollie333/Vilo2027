import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AdminPermissionDenied } from "./errors";
import { type AdminContext, requireAdmin } from "./requireAdmin";

export type PermissionKey =
  | "users.view"
  | "users.edit"
  | "users.suspend"
  | "users.impersonate"
  | "hosts.verify"
  | "listings.edit"
  | "listings.moderate"
  | "bookings.edit"
  | "bookings.cancel"
  | "payments.view"
  | "payments.refund"
  | "subscriptions.edit"
  | "reviews.moderate"
  | "platform.settings"
  | "platform.features"
  | "platform.staff"
  | "audit.view"
  | "help.manage"
  | "taxonomy.manage"
  | "notifications.broadcast"
  | "notifications.send_individual"
  | "notifications.view_history";

/**
 * Resolves to the admin context if the caller holds `permissionKey`. On denial,
 * writes a `permission_denied` row to admin_audit_log (so probing is visible)
 * and throws AdminPermissionDenied.
 *
 * Always call requireAdmin() implicitly first.
 */
export async function requirePermission(
  permissionKey: PermissionKey,
): Promise<AdminContext> {
  const admin = await requireAdmin();
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc("has_admin_permission", {
    p_key: permissionKey,
  });

  if (error || data !== true) {
    // Surface the RPC failure in server logs so a misconfigured DB
    // (missing function, AAL2 still enforced, missing seed row) doesn't
    // silently look like "permission denied". The user-facing UX is the
    // same — they hit the admin error boundary either way.
    if (error) {
      console.error("[admin:requirePermission] RPC failed", {
        permissionKey,
        adminUserId: admin.userId,
        rpcError: error.message,
      });
    }
    await logDeniedAttempt(admin.userId, permissionKey);
    throw new AdminPermissionDenied(permissionKey);
  }

  return admin;
}

/**
 * Non-throwing variant for conditional UI rendering. Returns false on denial
 * but does NOT log — UI checks happen on every render and would flood the log.
 */
export async function hasPermission(
  permissionKey: PermissionKey,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase.rpc("has_admin_permission", {
    p_key: permissionKey,
  });
  return data === true;
}

async function logDeniedAttempt(adminId: string, permissionKey: string) {
  try {
    const h = headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    const userAgent = h.get("user-agent");

    const service = createAdminClient();
    await service.from("admin_audit_log").insert({
      admin_id: adminId,
      action: "permission_denied",
      target_type: "permission_denied",
      payload: { permission_key: permissionKey },
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch {
    // Swallow — never let an audit-log failure mask the underlying denial.
  }
}
