"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  closeImpersonationSession,
  openImpersonationSession,
  requirePermission,
  writeAuditRow,
} from "@/lib/admin";

export async function startImpersonationAction(formData: FormData) {
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!targetUserId) throw new Error("targetUserId required.");
  if (!reason) throw new Error("Reason required to start impersonation.");

  const admin = await requirePermission("users.impersonate");

  // Validate the target before opening a session: it must exist, not be the
  // caller, and not be another active staff member (separation of duties — no
  // staff-on-staff impersonation / lateral privilege movement).
  if (targetUserId === admin.userId) {
    throw new Error("You cannot impersonate yourself.");
  }
  const guardClient = createAdminClient();
  const [{ data: targetProfile }, { data: targetStaff }] = await Promise.all([
    guardClient
      .from("user_profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle(),
    guardClient
      .from("platform_staff")
      .select("user_id, is_active")
      .eq("user_id", targetUserId)
      .maybeSingle(),
  ]);
  if (!targetProfile) throw new Error("Target user not found.");
  if (targetStaff?.is_active) {
    throw new Error("You cannot impersonate another staff member.");
  }

  const ctx = await openImpersonationSession(admin.userId, targetUserId);

  await writeAuditRow({
    admin_id: admin.userId,
    impersonating: targetUserId,
    action: "impersonation.start",
    target_type: "impersonation",
    target_id: ctx.sessionId,
    payload: { reason, target_user_id: targetUserId },
  });

  redirect(`/admin/as/${targetUserId}/dashboard`);
}

export async function endImpersonationAction() {
  const admin = await requirePermission("users.impersonate");
  const sessionId = await closeImpersonationSession();

  if (sessionId) {
    await writeAuditRow({
      admin_id: admin.userId,
      action: "impersonation.end",
      target_type: "impersonation",
      target_id: sessionId,
      payload: {},
    });
  }

  redirect("/admin");
}
