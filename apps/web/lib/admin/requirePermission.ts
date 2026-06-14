import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AdminAccessDenied } from "./errors";
import { type AdminContext, requireAdmin } from "./requireAdmin";

export type PermissionKey =
  | "users.view"
  | "users.edit"
  | "users.role"
  | "users.delete"
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
 * Resolves to the admin context if the caller holds `permissionKey`. On denial
 * (no session, not a staff member, missing permission, or RPC failure) writes
 * a `permission_denied` row to admin_audit_log and REDIRECTS the user — to
 * /login on missing-session, to /admin/no-access on a real permission denial.
 *
 * Why redirect instead of throw: in production Next.js sanitizes server-thrown
 * errors before passing them to the route's error boundary, so the boundary
 * can't tell "permission denied" apart from a real 500 and shows a generic
 * error. `redirect()` uses NEXT_REDIRECT under the hood which Next handles
 * cleanly, so every admin page that calls this gets a usable UX without
 * per-page try/catch.
 *
 * Server actions that call this from inside a client mutation get the same
 * redirect — the action's caller sees the redirect resolve on the client,
 * which is acceptable for the edge case of an action firing after the page
 * lost its permission.
 *
 * Always call requireAdmin() implicitly first.
 */
export async function requirePermission(
  permissionKey: PermissionKey,
): Promise<AdminContext> {
  let admin: AdminContext;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAccessDenied) {
      redirect("/login?next=/admin&reason=admin_required");
    }
    throw err;
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("has_admin_permission", {
    p_key: permissionKey,
  });

  if (error || data !== true) {
    // Surface the underlying cause in Vercel server logs so a misconfigured
    // DB (missing function, AAL2 still enforced via the un-applied
    // 20260525000009 migration, missing seed row) is diagnosable. The user
    // lands on /admin/no-access either way.
    if (error) {
      console.error("[admin:requirePermission] RPC failed", {
        permissionKey,
        adminUserId: admin.userId,
        rpcError: error.message,
      });
    } else {
      console.warn("[admin:requirePermission] permission denied", {
        permissionKey,
        adminUserId: admin.userId,
      });
    }
    await logDeniedAttempt(admin.userId, permissionKey);
    redirect(
      `/admin/no-access?key=${encodeURIComponent(permissionKey)}${
        error ? "&reason=rpc_error" : ""
      }`,
    );
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
