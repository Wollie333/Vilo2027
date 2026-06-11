"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  closeImpersonationSession,
  openImpersonationSession,
  requirePermission,
} from "@/lib/admin";

export async function startImpersonationAction(formData: FormData) {
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!targetUserId) throw new Error("targetUserId required.");
  if (!reason) throw new Error("Reason required to start impersonation.");

  const admin = await requirePermission("users.impersonate");
  const ctx = await openImpersonationSession(admin.userId, targetUserId);

  const h = headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  const userAgent = h.get("user-agent");

  const service = createAdminClient();
  await service.from("admin_audit_log").insert({
    admin_id: admin.userId,
    impersonating: targetUserId,
    action: "impersonation.start",
    target_type: "impersonation",
    target_id: ctx.sessionId,
    payload: { reason, target_user_id: targetUserId },
    ip_address: ip,
    user_agent: userAgent,
  });

  redirect(`/admin/as/${targetUserId}/dashboard`);
}

export async function endImpersonationAction() {
  const admin = await requirePermission("users.impersonate");
  const sessionId = await closeImpersonationSession();

  if (sessionId) {
    const h = headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    const userAgent = h.get("user-agent");

    const service = createAdminClient();
    await service.from("admin_audit_log").insert({
      admin_id: admin.userId,
      action: "impersonation.end",
      target_type: "impersonation",
      target_id: sessionId,
      payload: {},
      ip_address: ip,
      user_agent: userAgent,
    });
  }

  redirect("/admin");
}
