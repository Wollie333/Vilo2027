import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// Fan a single in-app notification out to the relevant STAFF members' bells.
//
// Why this exists: end-user notifications go through dispatchEvent (registry +
// prefs + email/push). Staff pings for money moments (a partner requested a
// payout, a competition closed, a clawback landed) just need to reach the right
// admins' notification bell — the same in_app_notifications table + NotificationBell
// the host/guest use, scoped by RLS to each staff user. So we write in-app rows
// directly via the service-role enqueue RPC (exactly like the affiliate-commission
// DB trigger already does), targeting active platform_staff.
//
// `permission` restricts delivery to staff whose role holds that permission key
// (super_admin always included) so, e.g., a payout ping reaches finance + super
// admins but not content moderators. Omit it to notify every active staff member.
//
// Best-effort: a single enqueue failure never throws — a staff notification must
// not roll back the money action that triggered it. Returns how many were sent.

type Db = ReturnType<typeof createAdminClient>;

export type StaffNotification = {
  kind: string;
  title: string;
  body?: string | null;
  /** Deep link into the admin surface where the staff member acts on it. */
  link?: string | null;
  /** Only staff whose role has this permission key receive it (super_admin always does). */
  permission?: string;
  /** notification_categories id — drives the bell tab. Defaults to payments_refunds. */
  category?: string;
  /** in_app_notifications.severity CHECK: info | default | high | critical. */
  severity?: "info" | "default" | "high" | "critical";
  payload?: Record<string, unknown>;
};

export async function notifyStaff(
  admin: Db,
  n: StaffNotification,
): Promise<number> {
  try {
    const { data: staff } = await admin
      .from("platform_staff")
      .select("user_id, role_id")
      .eq("is_active", true);
    if (!staff?.length) return 0;

    let allowedRoles: Set<string> | null = null;
    if (n.permission) {
      const { data: perms } = await admin
        .from("admin_role_permissions")
        .select("role_id")
        .eq("permission_key", n.permission);
      allowedRoles = new Set((perms ?? []).map((p) => p.role_id as string));
      allowedRoles.add("super_admin"); // super admins see everything
    }

    const recipients = staff.filter(
      (s) => !allowedRoles || allowedRoles.has(s.role_id as string),
    );
    if (!recipients.length) return 0;

    let sent = 0;
    for (const r of recipients) {
      const { error } = await admin.rpc("enqueue_in_app_notification", {
        p_user_id: r.user_id as string,
        p_kind: n.kind,
        p_title: n.title,
        p_body: n.body ?? null,
        p_link: n.link ?? null,
        p_payload: n.payload ?? {},
        p_category_id: n.category ?? "payments_refunds",
        p_severity: n.severity ?? "high",
      });
      if (!error) sent += 1;
    }
    return sent;
  } catch {
    // A notification failure must never break the caller's money path.
    return 0;
  }
}
